use crate::commands::auth::AppState;
use crate::models::sales::{
    AnulacionResult, CreateOrderItemPayload, CreateOrderPayload, ItemAnuladoExport,
    OrderItemExport, Sale, SaleDetail, VentaAnuladaExport,
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
    store_id: i64,
) -> Result<i64, String> {
    state.config_service.reject_in_primary().await?;
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
        store_id,
    };
    state.sales_service.create_order(payload).await
}

#[tauri::command]
pub async fn get_sales(state: State<'_, AppState>, store_id: i64) -> Result<Vec<Sale>, String> {
    state.sales_service.get_sales(store_id).await
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
    store_id: i64,
) -> Result<Vec<OrderItemExport>, String> {
    state.sales_service.get_all_order_items(store_id).await
}

/// Anula una venta: la borra fisicamente (orders + order_items) y registra la
/// justificacion y los items eliminados para auditoria y sincronizacion.
/// Solo en Replica/Hybrid; en Primary las ventas solo llegan por sync.
#[tauri::command]
pub async fn anular_venta(
    state: State<'_, AppState>,
    sale_id: i64,
    user_id: i64,
    reason: String,
    cash_session_id: Option<i64>,
) -> Result<AnulacionResult, String> {
    state.config_service.reject_in_primary().await?;
    state.sales_service.anular_venta(sale_id, user_id, reason, cash_session_id).await
}

/// Listado de ventas anuladas (historial).
#[tauri::command]
pub async fn get_anulaciones(
    state: State<'_, AppState>,
    store_id: i64,
) -> Result<Vec<VentaAnuladaExport>, String> {
    state.sales_service.get_anulaciones(store_id).await
}

/// Items anulados (detalle/export CSV).
#[tauri::command]
pub async fn get_all_items_anulados(
    state: State<'_, AppState>,
    store_id: i64,
) -> Result<Vec<ItemAnuladoExport>, String> {
    state.sales_service.get_all_items_anulados(store_id).await
}
