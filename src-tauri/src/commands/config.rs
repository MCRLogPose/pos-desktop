use crate::commands::auth::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_operating_mode(state: State<'_, AppState>) -> Result<String, String> {
    state.config_service.get_operating_mode().await
}

#[tauri::command]
pub async fn set_operating_mode(state: State<'_, AppState>, mode: String) -> Result<(), String> {
    state.config_service.set_operating_mode(&mode).await
}

#[tauri::command]
pub async fn get_app_config(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    state.config_service.get_config(&key).await
}

#[tauri::command]
pub async fn set_app_config(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    state.config_service.set_config(&key, &value).await
}
