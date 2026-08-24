use super::apply;
use super::payloads::{
    CashBatch, CatalogBatch, InventoryBatch, PurchasesBatch, SalesBatch,
};
use super::{SyncEnvelope, SyncItemAck, SyncResponse, SyncTopic, SYNC_SCHEMA_VERSION};
use axum::extract::{Json, Request, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::routing::{get, post};
use axum::Router;
use serde_json::json;
use sqlx::SqlitePool;
use std::net::SocketAddr;
use std::sync::Arc;

/// Token compartido que toda replica debe presentar como `Authorization: Bearer <token>`.
#[derive(Clone)]
struct SyncToken(Arc<String>);

fn constant_time_eq(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    a.iter()
        .zip(b.iter())
        .fold(0u8, |acc, (x, y)| acc | (x ^ y))
        == 0
}

async fn authorize(
    State(expected): State<SyncToken>,
    headers: HeaderMap,
    req: Request,
    next: Next,
) -> Result<Response, (StatusCode, &'static str)> {
    let provided = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(|token| constant_time_eq(token, expected.0.as_str()))
        .unwrap_or(false);

    if provided {
        Ok(next.run(req).await)
    } else {
        Err((
            StatusCode::UNAUTHORIZED,
            "token de sincronizacion ausente o invalido",
        ))
    }
}

trait SyncBatch {
    fn item_uuids(&self) -> Vec<String>;
}

impl SyncBatch for SalesBatch {
    fn item_uuids(&self) -> Vec<String> {
        self.sales.iter().map(|s| s.sync_uuid.clone()).collect()
    }
}

impl SyncBatch for InventoryBatch {
    fn item_uuids(&self) -> Vec<String> {
        self.categories
            .iter()
            .map(|c| c.sync_uuid.clone())
            .chain(self.product_upserts.iter().map(|p| p.sync_uuid.clone()))
            .chain(self.stock_movements.iter().map(|m| m.sync_uuid.clone()))
            .collect()
    }
}

impl SyncBatch for PurchasesBatch {
    fn item_uuids(&self) -> Vec<String> {
        self.purchase_orders
            .iter()
            .map(|p| p.sync_uuid.clone())
            .collect()
    }
}

impl SyncBatch for CashBatch {
    fn item_uuids(&self) -> Vec<String> {
        self.sessions
            .iter()
            .map(|s| s.sync_uuid.clone())
            .chain(self.expenses.iter().map(|e| e.sync_uuid.clone()))
            .chain(self.incomes.iter().map(|i| i.sync_uuid.clone()))
            .collect()
    }
}

impl SyncBatch for CatalogBatch {
    fn item_uuids(&self) -> Vec<String> {
        self.stores
            .iter()
            .map(|s| s.sync_uuid.clone())
            .chain(self.users.iter().map(|u| u.sync_uuid.clone()))
            .collect()
    }
}

async fn health(State(pool): State<SqlitePool>) -> Json<serde_json::Value> {
    let db_ok = sqlx::query("SELECT 1").fetch_optional(&pool).await.is_ok();
    Json(json!({
        "status": if db_ok { "ok" } else { "degraded" },
        "service": "vestikpos-sync",
        "schema_version": SYNC_SCHEMA_VERSION,
        "topics": ["sales", "inventory", "purchases", "cash", "catalog"]
    }))
}

fn schema_mismatch_response<T: SyncBatch>(envelope: &SyncEnvelope<T>) -> SyncResponse {
    log::warn!(
        "[sync] schema_version incompatible: {} (esperado {})",
        envelope.schema_version,
        SYNC_SCHEMA_VERSION
    );
    SyncResponse {
        sync_id: envelope.sync_id.clone(),
        topic: envelope.topic,
        acks: envelope
            .payload
            .item_uuids()
            .into_iter()
            .map(|u| {
                SyncItemAck::rejected(
                    u,
                    format!("schema_version incompatible, se espera {SYNC_SCHEMA_VERSION}"),
                )
            })
            .collect(),
    }
}

async fn log_sync_result(
    pool: &SqlitePool,
    envelope_sync_id: &str,
    device_id: &str,
    store_code: Option<&str>,
    topic: SyncTopic,
    response: &SyncResponse,
) {
    let count_status =
        |want: super::SyncItemStatus| -> i64 {
            response
                .acks
                .iter()
                .filter(|a| a.status == want)
                .count() as i64
        };
    let topic_str = serde_json::to_value(topic)
        .ok()
        .and_then(|v| v.as_str().map(str::to_string))
        .unwrap_or_default();
    let _ = sqlx::query("INSERT INTO sync_log (sync_id, device_id, store_code, topic, item_count, accepted_count, duplicate_count, rejected_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
        .bind(envelope_sync_id)
        .bind(device_id)
        .bind(store_code)
        .bind(topic_str)
        .bind(response.acks.len() as i64)
        .bind(count_status(super::SyncItemStatus::Accepted))
        .bind(count_status(super::SyncItemStatus::Duplicate))
        .bind(count_status(super::SyncItemStatus::Rejected))
        .execute(pool)
        .await
        .inspect_err(|e| log::warn!("[sync] no se pudo registrar sync_log: {e}"));
}

macro_rules! sync_endpoint {
    ($name:ident, $batch:ty, $topic:expr, $applier:path) => {
        async fn $name(
            State(pool): State<SqlitePool>,
            Json(envelope): Json<SyncEnvelope<$batch>>,
        ) -> Json<SyncResponse> {
            if envelope.schema_version != SYNC_SCHEMA_VERSION {
                return Json(schema_mismatch_response(&envelope));
            }

            log::info!(
                "[sync] recibido sync_id={} topic={:?} store={:?} device={} items={}",
                envelope.sync_id,
                $topic,
                envelope.store_code,
                envelope.device_id,
                envelope.payload.item_uuids().len()
            );

            let acks = $applier(
                &pool,
                &envelope.payload,
                &envelope.device_id,
                envelope.store_code.as_deref(),
            )
            .await;

            let response = SyncResponse {
                sync_id: envelope.sync_id.clone(),
                topic: $topic,
                acks,
            };
            log_sync_result(
                &pool,
                &envelope.sync_id,
                &envelope.device_id,
                envelope.store_code.as_deref(),
                $topic,
                &response,
            )
            .await;
            Json(response)
        }
    };
}

sync_endpoint!(sync_sales, SalesBatch, SyncTopic::Sales, apply::apply_sales_batch);
sync_endpoint!(sync_inventory, InventoryBatch, SyncTopic::Inventory, apply::apply_inventory_batch);
sync_endpoint!(sync_purchases, PurchasesBatch, SyncTopic::Purchases, apply::apply_purchases_batch);
sync_endpoint!(sync_cash, CashBatch, SyncTopic::Cash, apply::apply_cash_batch);
sync_endpoint!(sync_catalog, CatalogBatch, SyncTopic::Catalog, apply::apply_catalog_batch);

pub async fn run_server(pool: SqlitePool, port: u16, sync_token: String) -> Result<(), String> {
    let app = Router::new()
        .route("/health", get(health))
        .route("/sync/sales", post(sync_sales))
        .route("/sync/inventory", post(sync_inventory))
        .route("/sync/purchases", post(sync_purchases))
        .route("/sync/cash", post(sync_cash))
        .route("/sync/catalog", post(sync_catalog))
        .with_state(pool)
        .layer(middleware::from_fn_with_state(
            SyncToken(Arc::new(sync_token)),
            authorize,
        ));

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("no se pudo vincular el puerto {port}: {e}"))?;

    log::info!("[sync] servidor HTTP activo en 0.0.0.0:{port}");

    axum::serve(listener, app)
        .await
        .map_err(|e| format!("servidor sync finalizado con error: {e}"))
}
