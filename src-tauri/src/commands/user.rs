use crate::models::user::User;
use crate::commands::auth::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_all_users(state: State<'_, AppState>) -> Result<Vec<User>, String> {
    let repo = &state.auth_service.user_repo;
    repo.find_all_users().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_staff_user(
    state: State<'_, AppState>,
    username: String,
    password: String,
    cargo: Option<String>,
    email: Option<String>,
    store_id: Option<i64>,
    role_name: String, // "VENDEDOR" or "GERENTE" only
) -> Result<User, String> {
    // Validate role - only allow VENDEDOR or GERENTE
    if role_name != "VENDEDOR" && role_name != "GERENTE" {
        return Err("Solo se permiten roles VENDEDOR o GERENTE".to_string());
    }

    let repo = &state.auth_service.user_repo;
    
    // Hash the password
    let password_hash = bcrypt::hash(&password, bcrypt::DEFAULT_COST)
        .map_err(|e| format!("Error hashing password: {}", e))?;

    // Use role_name for cargo if not explicitly provided
    let final_cargo = cargo.unwrap_or_else(|| role_name.clone());

    // Create user
    let user = repo.create_user(
        &username,
        &password_hash,
        Some(&final_cargo),
        email.as_deref(),
        store_id
    ).await.map_err(|e| e.to_string())?;

    // Find or create role
    let role = match repo.find_role_by_name(&role_name).await.map_err(|e| e.to_string())? {
        Some(r) => r,
        None => repo.create_role(&role_name).await.map_err(|e| e.to_string())?
    };

    // Assign role to user
    repo.assign_role(user.id, role.id).await.map_err(|e| e.to_string())?;

    Ok(user)
}

#[tauri::command]
pub async fn update_user(
    state: State<'_, AppState>,
    id: i64,
    cargo: Option<String>,
    email: Option<String>,
    store_id: Option<i64>,
) -> Result<(), String> {
    let repo = &state.auth_service.user_repo;
    repo.update_user(id, cargo.as_deref(), email.as_deref(), store_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_user(
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    let repo = &state.auth_service.user_repo;
    repo.soft_delete_user(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_users_by_store(
    state: State<'_, AppState>,
    store_id: i64,
) -> Result<Vec<User>, String> {
    let repo = &state.auth_service.user_repo;
    repo.get_users_by_store(store_id)
        .await
        .map_err(|e| e.to_string())
}
