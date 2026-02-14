use crate::models::store::Store;
use crate::commands::auth::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_stores(state: State<'_, AppState>) -> Result<Vec<Store>, String> {
    let repo = &state.auth_service.store_repo; // We need to expose store_repo in AuthService or AppState
    repo.find_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_store(
    state: State<'_, AppState>,
    name: String,
    address: Option<String>,
    code: Option<String>,
) -> Result<Store, String> {
    state.auth_service.store_repo.create(&name, address.as_deref(), code.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_store(
    state: State<'_, AppState>,
    id: i64,
    name: String,
    address: Option<String>,
    code: Option<String>,
) -> Result<(), String> {
    state.auth_service.store_repo.update(id, &name, address.as_deref(), code.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_store(
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    // Password verification should happen BEFORE calling this command in a separate step or we can pass password here.
    // The plan said "verify_password" command helper. So here we just delete.
    state.auth_service.store_repo.soft_delete(id)
        .await
        .map_err(|e| e.to_string())
}
