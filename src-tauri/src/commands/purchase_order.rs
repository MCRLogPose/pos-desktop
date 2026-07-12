use crate::commands::auth::AppState;
use crate::models::purchase_order::{CreatePurchaseOrderPayload, PurchaseOrder, PurchaseOrderWithItems};
use tauri::State;

#[tauri::command]
pub async fn create_purchase_order(
    state: State<'_, AppState>,
    payload: CreatePurchaseOrderPayload,
) -> Result<PurchaseOrderWithItems, String> {
    state
        .purchase_order_service
        .create_purchase_order(payload)
        .await
}

#[tauri::command]
pub async fn get_purchase_orders(
    state: State<'_, AppState>,
    store_id: i64,
) -> Result<Vec<PurchaseOrder>, String> {
    state
        .purchase_order_service
        .get_purchase_orders(store_id)
        .await
}

#[tauri::command]
pub async fn get_purchase_order_detail(
    state: State<'_, AppState>,
    id: i64,
) -> Result<Option<PurchaseOrderWithItems>, String> {
    state
        .purchase_order_service
        .get_purchase_order_detail(id)
        .await
}
