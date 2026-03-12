use crate::commands::auth::AppState;
use crate::models::sales::{
    CreateOrderItemPayload, CreateOrderPayload, OrderItemExport, Sale, SaleDetail,
};
use tauri::State;

#[tauri::command]
pub async fn create_sale(
    state: State<'_, AppState>,
    user_id: i64,
    client_document: Option<String>,
    client_phone: Option<String>,
    client_name: Option<String>,
    payment_method: String,
    items: Vec<CreateOrderItemPayload>,
    subtotal: f64,
    igv: f64,
    total: f64,
    cash_session_id: i64,
) -> Result<i64, String> {
    let payload = CreateOrderPayload {
        user_id,
        client_document,
        client_phone,
        client_name,
        payment_method,
        items,
        subtotal,
        igv,
        total,
        cash_session_id,
    };
    state.sales_service.create_order(payload).await
}

#[tauri::command]
pub async fn get_sales(state: State<'_, AppState>) -> Result<Vec<Sale>, String> {
    state.sales_service.get_sales().await
}

#[tauri::command]
pub async fn get_sale_detail(
    state: State<'_, AppState>,
    sale_id: i64,
) -> Result<Option<SaleDetail>, String> {
    state.sales_service.get_sale_detail(sale_id).await
}

#[tauri::command]
pub async fn get_all_order_items(
    state: State<'_, AppState>,
) -> Result<Vec<OrderItemExport>, String> {
    state.sales_service.get_all_order_items().await
}
