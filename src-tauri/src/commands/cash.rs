use tauri::State;
use crate::commands::auth::AppState;
use crate::models::cash::{CashSession, OpenCashPayload, CloseCashPayload};

#[tauri::command]
pub async fn get_active_cash_session(state: State<'_, AppState>) -> Result<Option<CashSession>, String> {
    state.cash_service.get_active_session().await
}

#[tauri::command]
pub async fn get_last_closed_cash_session(state: State<'_, AppState>) -> Result<Option<CashSession>, String> {
    state.cash_service.get_last_closed_session().await
}

#[tauri::command]
pub async fn open_cash_session(
    state: State<'_, AppState>,
    payload: OpenCashPayload,
) -> Result<i64, String> {
    state.cash_service.open_session(payload).await
}

#[tauri::command]
pub async fn close_cash_session(
    state: State<'_, AppState>,
    session_id: i64,
    payload: CloseCashPayload,
) -> Result<(), String> {
    state.cash_service.close_session(session_id, payload).await
}

#[tauri::command]
pub async fn add_cash_expense(
    state: State<'_, AppState>,
    session_id: i64,
    description: String,
    amount: f64,
    payment_method: String,
) -> Result<i64, String> {
    state.cash_service.add_expense(session_id, description, amount, payment_method).await
}

#[tauri::command]
pub async fn add_cash_other_income(
    state: State<'_, AppState>,
    session_id: i64,
    description: String,
    amount: f64,
    payment_method: String,
) -> Result<i64, String> {
    state.cash_service.add_other_income(session_id, description, amount, payment_method).await
}

#[tauri::command]
pub async fn get_cash_session_transactions(
    state: State<'_, AppState>,
    session_id: i64,
) -> Result<Vec<serde_json::Value>, String> {
    state.cash_service.get_session_transactions(session_id).await
}
