use super::payloads::{
    CashSessionSync, CategorySync, ExpenseSync, OtherIncomeSync, ProductUpsertSync,
    PurchaseOrderSync, SaleSync, StockMovementSync, StoreSync, UserSync, VentaAnuladaSync,
};
use super::queue::{PendingItem, SyncQueue};
use super::{SyncEnvelope, SyncItemStatus, SyncResponse, SyncTopic};
use serde::de::DeserializeOwned;
use sqlx::SqlitePool;

/// Cliente HTTP de sincronizacion de la Replica hacia la Primary.
///
/// Recopila las filas pendientes de la outbox, las agrupa por topic y envia
/// un `SyncEnvelope` por cada topic que tenga cambios. Interpreta los acks y
/// marca las filas como sincronizadas o con error.
pub struct SyncClient {
    pool: SqlitePool,
    queue: SyncQueue,
}

impl SyncClient {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool: pool.clone(),
            queue: SyncQueue::new(pool),
        }
    }

    /// Envia todos los topics con cambios pendientes a la Primary.
    pub async fn sync_all(&self) -> Result<String, String> {
        if !self.queue.is_replica().await {
            return Ok("modo no replica: sin sincronizacion".to_string());
        }

        let (primary_url, token, device_id, store_code) = self.read_config().await?;
        let pending = self.queue.pending().await.map_err(|e| e.to_string())?;
        if pending.is_empty() {
            return Ok("nada que sincronizar".to_string());
        }

        let client = reqwest::Client::new();
        let mut summary = Vec::new();

        for topic in ALL_TOPICS {
            let items: Vec<PendingItem> = pending
                .iter()
                .filter(|p| p.topic == topic_str(topic))
                .cloned()
                .collect();
            if items.is_empty() {
                continue;
            }

            let envelope = match build_envelope_for_topic(
                topic,
                device_id.clone(),
                store_code.clone(),
                &items,
            ) {
                Some(env) => env,
                None => {
                    // Payload malformado: se marca como fallido para no bloquear el resto.
                    for it in &items {
                        let _ = self
                            .queue
                            .mark_failed(&it.item_uuid, "payload malformado")
                            .await;
                    }
                    continue;
                }
            };

            let endpoint = format!("{primary_url}/sync/{}", topic_str(topic));
            let resp = client
                .post(&endpoint)
                .bearer_auth(&token)
                .json(&envelope)
                .send()
                .await
                .map_err(|e| format!("fallo HTTP a {endpoint}: {e}"))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!(
                    "Primary respondio {status} en /sync/{}: {body}",
                    topic_str(topic)
                ));
            }

            let parsed: SyncResponse = resp
                .json()
                .await
                .map_err(|e| format!("respuesta invalida de /sync/{}: {e}", topic_str(topic)))?;

            let mut accepted = Vec::new();
            for ack in &parsed.acks {
                match ack.status {
                    SyncItemStatus::Accepted | SyncItemStatus::Duplicate => {
                        accepted.push(ack.item_uuid.clone());
                    }
                    SyncItemStatus::Rejected => {
                        self.queue
                            .mark_failed(
                                &ack.item_uuid,
                                ack.message
                                    .as_deref()
                                    .unwrap_or("rechazado por la Primary"),
                            )
                            .await
                            .ok();
                    }
                }
            }
            let _ = self.queue.mark_synced(&accepted).await;

            summary.push(format!(
                "{}: {} items ({} ok)",
                topic_str(topic),
                parsed.acks.len(),
                accepted.len()
            ));
        }

        Ok(summary.join("\n"))
    }

    /// Comprueba que la Primary configurada responde en `/health`.
    ///
    /// Se usa desde la UI de Configuracion para que el administrador confirme la
    /// IP y el token antes de operar, sin tener que sincronizar datos reales.
    pub async fn test_connection(&self) -> Result<String, String> {
        let base = self.read_primary_url().await?;
        let endpoint = format!("{base}/health");
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(|e| e.to_string())?;
        let resp = client
            .get(&endpoint)
            .send()
            .await
            .map_err(|e| format!("No se pudo conectar con {endpoint}: {e}"))?;
        let status = resp.status();
        if !status.is_success() {
            return Err(format!("{endpoint} respondio {status}"));
        }
        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("Respuesta inesperada de {endpoint}: {e}"))?;
        let service = body
            .get("service")
            .and_then(|v| v.as_str())
            .unwrap_or("vestikpos-sync");
        Ok(format!("Conexion correcta con {service} en {base}"))
    }

    async fn read_primary_url(&self) -> Result<String, String> {
        let pool = self.pool.clone();
        let url: Option<String> = sqlx::query_scalar("SELECT value FROM app_config WHERE key = 'primary_url'")
            .fetch_optional(&pool)
            .await
            .ok()
            .flatten();
        match url {
            Some(url) if !url.trim().is_empty() => Ok(url),
            _ => Err("falta configuracion primary_url en la Replica".to_string()),
        }
    }

    async fn read_config(&self) -> Result<(String, String, String, Option<String>), String> {        async fn get(pool: &SqlitePool, key: &str) -> String {
            sqlx::query_scalar::<_, String>("SELECT value FROM app_config WHERE key = ?")
                .bind(key)
                .fetch_optional(pool)
                .await
                .ok()
                .flatten()
                .unwrap_or_default()
        }
        let primary_url = get(&self.pool, "primary_url").await;
        if primary_url.is_empty() {
            return Err("falta configuracion primary_url en la Replica".to_string());
        }
        let token = get(&self.pool, "sync_token").await;
        if token.is_empty() {
            return Err("falta configuracion sync_token en la Replica".to_string());
        }
        let device_id = get(&self.pool, "device_id").await;
        if device_id.is_empty() {
            return Err("falta configuracion device_id".to_string());
        }
        let store_code = {
            let v = get(&self.pool, "store_code").await;
            if v.is_empty() {
                None
            } else {
                Some(v)
            }
        };
        Ok((primary_url, token, device_id, store_code))
    }
}

const ALL_TOPICS: [SyncTopic; 6] = [
    SyncTopic::Sales,
    SyncTopic::Anulaciones,
    SyncTopic::Inventory,
    SyncTopic::Purchases,
    SyncTopic::Cash,
    SyncTopic::Catalog,
];

fn topic_str(t: SyncTopic) -> &'static str {
    match t {
        SyncTopic::Sales => "sales",
        SyncTopic::Inventory => "inventory",
        SyncTopic::Purchases => "purchases",
        SyncTopic::Cash => "cash",
        SyncTopic::Catalog => "catalog",
        SyncTopic::Anulaciones => "anulaciones",
    }
}

fn parse_item<T: DeserializeOwned>(item: &PendingItem) -> Option<T> {
    serde_json::from_value(item.payload.clone()).ok()
}

fn build_envelope_for_topic(
    topic: SyncTopic,
    device_id: String,
    store_code: Option<String>,
    items: &[PendingItem],
) -> Option<SyncEnvelope<serde_json::Value>> {
    use serde_json::json;
    let payload = match topic {
        SyncTopic::Sales => {
            let sales: Vec<SaleSync> = items.iter().filter_map(|i| parse_item(i)).collect();
            json!({ "sales": sales })
        }
        SyncTopic::Anulaciones => {
            let anulaciones: Vec<VentaAnuladaSync> =
                items.iter().filter_map(|i| parse_item(i)).collect();
            json!({ "anulaciones": anulaciones })
        }
        SyncTopic::Inventory => {
            let categories: Vec<CategorySync> =
                items.iter().filter_map(|i| parse_item(i)).collect();
            let product_upserts: Vec<ProductUpsertSync> =
                items.iter().filter_map(|i| parse_item(i)).collect();
            let stock_movements: Vec<StockMovementSync> =
                items.iter().filter_map(|i| parse_item(i)).collect();
            json!({
                "categories": categories,
                "product_upserts": product_upserts,
                "stock_movements": stock_movements
            })
        }
        SyncTopic::Purchases => {
            let purchase_orders: Vec<PurchaseOrderSync> =
                items.iter().filter_map(|i| parse_item(i)).collect();
            json!({ "purchase_orders": purchase_orders })
        }
        SyncTopic::Cash => {
            let sessions: Vec<CashSessionSync> =
                items.iter().filter_map(|i| parse_item(i)).collect();
            let expenses: Vec<ExpenseSync> =
                items.iter().filter_map(|i| parse_item(i)).collect();
            let incomes: Vec<OtherIncomeSync> =
                items.iter().filter_map(|i| parse_item(i)).collect();
            json!({ "sessions": sessions, "expenses": expenses, "incomes": incomes })
        }
        SyncTopic::Catalog => {
            let stores: Vec<StoreSync> = items.iter().filter_map(|i| parse_item(i)).collect();
            let users: Vec<UserSync> = items.iter().filter_map(|i| parse_item(i)).collect();
            json!({ "stores": stores, "users": users })
        }
    };
    Some(SyncEnvelope::new(
        device_id,
        store_code,
        topic,
        chrono::Local::now().to_rfc3339(),
        payload,
    ))
}

