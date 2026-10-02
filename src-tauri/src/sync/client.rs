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

            let orphans = orphan_uuids(topic, &items);
            for uuid in &orphans {
                let _ = self
                    .queue
                    .mark_failed(
                        uuid,
                        "el payload encolado no corresponde a este topic de sincronizacion",
                    )
                    .await;
            }

            let envelope = build_envelope_for_topic(
                topic,
                device_id.clone(),
                store_code.clone(),
                &items,
            );

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
                "{}: {} items ({} ok{})",
                topic_str(topic),
                parsed.acks.len(),
                accepted.len(),
                if orphans.is_empty() {
                    String::new()
                } else {
                    format!(", {} descartados", orphans.len())
                }
            ));
        }

        Ok(summary.join("\n"))
    }

    /// Comprueba que la Primary configurada responde en `/health`.
    ///
    /// Se usa desde la UI de Configuracion para que el administrador confirme la
    /// IP y el token antes de operar, sin tener que sincronizar datos reales.
    pub async fn test_connection(&self) -> Result<String, String> {
        let (base, token) = self.read_url_and_token().await?;
        let endpoint = format!("{base}/health");
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(|e| e.to_string())?;
        // `/health` esta detras del mismo middleware que `/sync/*`: sin el token
        // la Primary responde 401 aunque la IP y el puerto sean correctos.
        let resp = client
            .get(&endpoint)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| format!("No se pudo conectar con {endpoint}: {e}"))?;
        let status = resp.status();
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(format!(
                "{endpoint} respondio 401: el token de sincronizacion no coincide con el de la Primary"
            ));
        }
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

    /// URL de la Primary y token compartido, ambos obligatorios para hablar con ella.
    async fn read_url_and_token(&self) -> Result<(String, String), String> {
        let primary_url = self.get_config("primary_url").await;
        if primary_url.trim().is_empty() {
            return Err("falta configuracion primary_url en la Replica".to_string());
        }
        let token = self.get_config("sync_token").await;
        if token.trim().is_empty() {
            return Err("falta configuracion sync_token en la Replica".to_string());
        }
        Ok((primary_url, token))
    }

    async fn read_config(&self) -> Result<(String, String, String, Option<String>), String> {
        let (primary_url, token) = self.read_url_and_token().await?;
        let device_id = self.get_config("device_id").await;
        if device_id.is_empty() {
            return Err("falta configuracion device_id".to_string());
        }
        let store_code = {
            let v = self.get_config("store_code").await;
            if v.is_empty() {
                None
            } else {
                Some(v)
            }
        };
        Ok((primary_url, token, device_id, store_code))
    }

    async fn get_config(&self, key: &str) -> String {
        let pool = self.pool.clone();
        sqlx::query_scalar::<_, String>("SELECT value FROM app_config WHERE key = ?")
            .bind(key)
            .fetch_optional(&pool)
            .await
            .ok()
            .flatten()
            .unwrap_or_default()
    }
}

/// Orden de envio. `Catalog` va primero a proposito: es el topic que da de alta
/// la sede del administrador y el resto de topics la resuelven por `store_code`
/// (ver `apply::upsert_store`). Si las ventas llegaran antes, la Primary no
/// tendria donde colgarlas.
const ALL_TOPICS: [SyncTopic; 6] = [
    SyncTopic::Catalog,
    SyncTopic::Sales,
    SyncTopic::Anulaciones,
    SyncTopic::Inventory,
    SyncTopic::Purchases,
    SyncTopic::Cash,
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

/// Tipo de payload que espera cada entidad dentro de un topic.
///
/// Es el unico lugar donde se decide a que lista del batch va cada fila. Antes
/// se armaba cada lista intentando deserializar TODAS las filas del topic contra
/// TODOS los tipos del lote y se guardaba la que coincidia: funcionaba solo
/// porque los tipos exigian campos distintos, pero en `cash` `OtherIncomeSync` es
/// un subconjunto de `ExpenseSync`, asi que cada gasto se colaba tambien como
/// ingreso y el cierre de caja en la Primary cuadraba mal.
fn payload_type_of(topic: SyncTopic, entity: &str) -> Option<&'static str> {
    match (topic, entity) {
        (SyncTopic::Sales, "order") => Some("order"),
        (SyncTopic::Anulaciones, "venta_anulada") => Some("venta_anulada"),
        (SyncTopic::Inventory, "category") => Some("category"),
        (SyncTopic::Inventory, "product") => Some("product"),
        (SyncTopic::Inventory, "stock_movement") => Some("stock_movement"),
        (SyncTopic::Purchases, "purchase_order") => Some("purchase_order"),
        (SyncTopic::Cash, "cash_session") => Some("cash_session"),
        (SyncTopic::Cash, "expense") => Some("expense"),
        (SyncTopic::Cash, "other_income") => Some("other_income"),
        (SyncTopic::Catalog, "store") => Some("store"),
        (SyncTopic::Catalog, "user") => Some("user"),
        _ => None,
    }
}

/// `item_uuid` de las filas que no se pueden enviar: entidad desconocida para el
/// topic, o payload que no se deja convertir al tipo de esa lista.
///
/// Antes esas filas se descartaban en silencio y quedaban `synced = 0` para
/// siempre, reenviendose en cada sync sin que nadie lo notara.
fn orphan_uuids(topic: SyncTopic, items: &[PendingItem]) -> Vec<String> {
    items
        .iter()
        .filter(|i| {
            payload_type_of(topic, &i.entity).is_none() || !payload_matches(topic, i)
        })
        .map(|i| i.item_uuid.clone())
        .collect()
}

fn payload_matches(topic: SyncTopic, item: &PendingItem) -> bool {
    macro_rules! ok {
        ($ty:ty) => {
            parse_item::<$ty>(item).is_some()
        };
    }
    match payload_type_of(topic, &item.entity) {
        Some("order") => ok!(SaleSync),
        Some("venta_anulada") => ok!(VentaAnuladaSync),
        Some("category") => ok!(CategorySync),
        Some("product") => ok!(ProductUpsertSync),
        Some("stock_movement") => ok!(StockMovementSync),
        Some("purchase_order") => ok!(PurchaseOrderSync),
        Some("cash_session") => ok!(CashSessionSync),
        Some("expense") => ok!(ExpenseSync),
        Some("other_income") => ok!(OtherIncomeSync),
        Some("store") => ok!(StoreSync),
        Some("user") => ok!(UserSync),
        _ => false,
    }
}

fn build_envelope_for_topic(
    topic: SyncTopic,
    device_id: String,
    store_code: Option<String>,
    items: &[PendingItem],
) -> SyncEnvelope<serde_json::Value> {
    use serde_json::json;
    let mut sale = Vec::new();
    let mut venta_anulada = Vec::new();
    let mut category = Vec::new();
    let mut product = Vec::new();
    let mut stock_movement = Vec::new();
    let mut purchase_order = Vec::new();
    let mut cash_session = Vec::new();
    let mut expense = Vec::new();
    let mut other_income = Vec::new();
    let mut store = Vec::new();
    let mut user = Vec::new();

    macro_rules! push {
        ($entity:expr, $ty:ty, $bucket:ident) => {
            for item in items.iter().filter(|i| i.entity == $entity) {
                if let Some(v) = parse_item::<$ty>(item) {
                    $bucket.push(v);
                }
            }
        };
    }

    push!("order", SaleSync, sale);
    push!("venta_anulada", VentaAnuladaSync, venta_anulada);
    push!("category", CategorySync, category);
    push!("product", ProductUpsertSync, product);
    push!("stock_movement", StockMovementSync, stock_movement);
    push!("purchase_order", PurchaseOrderSync, purchase_order);
    push!("cash_session", CashSessionSync, cash_session);
    push!("expense", ExpenseSync, expense);
    push!("other_income", OtherIncomeSync, other_income);
    push!("store", StoreSync, store);
    push!("user", UserSync, user);

    let payload = match topic {
        SyncTopic::Sales => json!({ "sales": sale }),
        SyncTopic::Anulaciones => json!({ "anulaciones": venta_anulada }),
        SyncTopic::Inventory => json!({
            "categories": category,
            "product_upserts": product,
            "stock_movements": stock_movement
        }),
        SyncTopic::Purchases => json!({ "purchase_orders": purchase_order }),
        SyncTopic::Cash => json!({
            "sessions": cash_session,
            "expenses": expense,
            "incomes": other_income
        }),
        SyncTopic::Catalog => json!({ "stores": store, "users": user }),
    };

    SyncEnvelope::new(
        device_id,
        store_code,
        topic,
        chrono::Local::now().to_rfc3339(),
        payload,
    )
}


#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn item(id: i64, entity: &str, payload: serde_json::Value) -> PendingItem {
        PendingItem {
            id,
            topic: "".into(),
            entity: entity.into(),
            item_uuid: format!("uuid-{id}"),
            payload,
        }
    }

    /// Gasto que se cuela tambien como ingreso.
    ///
    /// `OtherIncomeSync` exige menos campos que `ExpenseSync`, asi que un mismo
    /// payload de gasto se deserializa como ambos tipos. Con la clasificacion
    /// anterior (probar cada fila contra todos los tipos del topic y quedarse con
    /// la primera coincidencia) cada gasto de la replica aparecia ADEMAS como
    /// ingreso en la Primary y el cierre de caja cuadraba con el doble de la
    /// salida.
    ///
    /// El `source` extra es justamente lo que hace que los dos tipos no sean
    /// intercambiables, pero `serde` lo ignora por defecto al deserializar.
    #[test]
    fn un_gasto_no_viaja_tambien_como_otro_ingreso() {
        let gasto = json!({
            "sync_uuid": "exp-0001",
            "cash_session_uuid": null,
            "source": "purchase",
            "description": "Compra Lote viernes",
            "amount": 300.0,
            "payment_method": "cash",
            "category": "Mercaderia",
            "supplier": "Textiles SAC",
            "created_at": "2026-08-23 11:00:00"
        });

        // El payload es valido como los dos tipos: por eso la entidad decide.
        assert!(parse_item::<ExpenseSync>(&item(1, "expense", gasto.clone())).is_some());
        assert!(parse_item::<OtherIncomeSync>(&item(2, "other_income", gasto.clone())).is_some());

        let envelope = build_envelope_for_topic(SyncTopic::Cash, "dev-1".into(), None, &[item(3, "expense", gasto)]);
        let payload = envelope.payload;
        assert_eq!(payload["expenses"].as_array().unwrap().len(), 1);
        assert_eq!(
            payload["incomes"].as_array().unwrap().len(),
            0,
            "el gasto no puede aparecer tambien como ingreso: {payload}"
        );
        assert_eq!(payload["sessions"].as_array().unwrap().len(), 0);
    }

    /// La ficha y la cantidad viajan en el mismo topic pero en listas distintas.
    ///
    /// Mezclarlas hacia que la Primary creara el producto con la cantidad de
    /// otra fila, o que perdiera el movimiento.
    #[test]
    fn el_lote_de_inventario_separa_ficha_y_movimiento() {
        let items = vec![
            item(1, "product", json!({
                "sync_uuid": "prod-1",
                "local_product_id": 7,
                "code": "ZAP-1",
                "name": "Zapato",
                "display_name": null,
                "category_name": "Calzados",
                "price": 120.0,
                "cost": 60.0,
                "min_stock": 2,
                "unit": null,
                "image_url": null,
                "is_active": true,
                "occurred_at": "2026-08-23 14:00:00"
            })),
            item(2, "stock_movement", json!({
                "sync_uuid": "mov-1",
                "product_code": "ZAP-1",
                "product_name": "Zapato",
                "delta": 12,
                "reason": "purchase",
                "reference_uuid": null,
                "resulting_stock": 12,
                "occurred_at": "2026-08-23 14:00:05"
            })),
            item(3, "category", json!({
                "sync_uuid": "cat-1",
                "local_category_id": 4,
                "name": "Calzados"
            })),
        ];

        let envelope = build_envelope_for_topic(SyncTopic::Inventory, "dev-1".into(), None, &items);
        let p = envelope.payload;
        assert_eq!(p["product_upserts"].as_array().unwrap().len(), 1);
        assert_eq!(p["stock_movements"].as_array().unwrap().len(), 1);
        assert_eq!(p["categories"].as_array().unwrap().len(), 1);
        assert_eq!(p["stock_movements"][0]["delta"].as_i64(), Some(12));
        assert_eq!(p["product_upserts"][0]["name"].as_str(), Some("Zapato"));
    }

    /// Una fila que no se puede convertir no queda reenviandose para siempre.
    ///
    /// Antes se descartaba en silencio, se quedaba `synced = 0` y volvia a
    /// intentarse en cada sync, sin que nada lo indicara.
    #[test]
    fn una_fila_rota_o_desconocida_queda_reportada_como_huerfana() {
        let items = vec![
            item(1, "expense", json!({ "sync_uuid": "exp-roto" })),
            item(2, "inventario", json!({ "sync_uuid": "lo-que-sea" })),
            item(3, "other_income", json!({
                "sync_uuid": "ing-1",
                "cash_session_uuid": null,
                "description": "Propina",
                "amount": 5.0,
                "payment_method": "cash",
                "created_at": "2026-08-23 11:00:00"
            })),
        ];

        let huerfanos = orphan_uuids(SyncTopic::Cash, &items);
        assert_eq!(huerfanos, vec!["uuid-1".to_string(), "uuid-2".to_string()]);
    }
}
