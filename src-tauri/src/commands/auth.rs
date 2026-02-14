use crate::models::user::User;
use crate::services::auth_service::AuthService;
use tauri::State; 

// We might need to wrap AuthService in a Mutex or Arc if it has internal mutable state, 
// but currently it only holds UserRepository which holds SqlitePool which is Clone + Send + Sync.
// So AuthService can be Clone if we derive it, or we just wrap it in State.
// Since AuthService implementation doesn't have &mut self methods, we can just share it.
// However, to keep it simple with tauri State, we usually wrap in a struct.

pub struct AppState {
    pub auth_service: AuthService,
}

#[tauri::command]
pub async fn login(
    state: State<'_, AppState>,
    username: String,
    password: String,
) -> Result<User, String> {
    state.auth_service.login(&username, &password).await
}

#[tauri::command]
pub async fn create_user(
    state: State<'_, AppState>,
    username: String,
    password: String,
    email: Option<String>,
) -> Result<User, String> {
    // For now, we allow creating users as requested "ingreso de nuevos usuario".
    state.auth_service.create_user(&username, &password, email.as_deref()).await
}

#[tauri::command]
pub async fn get_users(state: State<'_, AppState>) -> Result<Vec<User>, String> {
    state.auth_service.get_users().await
}

#[tauri::command]
pub async fn verify_password(state: State<'_, AppState>, password: String) -> Result<bool, String> {
    state.auth_service.verify_admin_password(&password).await
}
