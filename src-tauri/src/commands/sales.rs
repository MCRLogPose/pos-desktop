use tauri::State;
use crate::commands::auth::AppState;
use crate::models::sales::{CreateOrderPayload, CreateOrderItemPayload};

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
    };
    state.sales_service.create_order(payload).await
}
