use crate::commands::auth::AppState;
use crate::models::user::User;
use crate::sync::payloads::UserSync;
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
    state.config_service.reject_in_primary().await?;

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
    let user = repo
        .create_user(
            &username,
            &password_hash,
            Some(&final_cargo),
            email.as_deref(),
            store_id,
        )
        .await
        .map_err(|e| e.to_string())?;

    // Find or create role
    let role = match repo
        .find_role_by_name(&role_name)
        .await
        .map_err(|e| e.to_string())?
    {
        Some(r) => r,
        None => repo
            .create_role(&role_name)
            .await
            .map_err(|e| e.to_string())?,
    };

    // Assign role to user
    repo.assign_role(user.id, role.id)
        .await
        .map_err(|e| e.to_string())?;

    enqueue_user(&state, &user, Some(&role_name)).await;
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
    state.config_service.reject_in_primary().await?;
    let repo = &state.auth_service.user_repo;
    repo.update_user(id, cargo.as_deref(), email.as_deref(), store_id)
        .await
        .map_err(|e| e.to_string())?;

    let user = repo.find_user_by_id(id).await.map_err(|e| e.to_string())?;
    if let Some(user) = user {
        enqueue_user(&state, &user, None).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_user(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.config_service.reject_in_primary().await?;
    let repo = &state.auth_service.user_repo;
    repo.soft_delete_user(id).await.map_err(|e| e.to_string())
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

async fn enqueue_user(state: &State<'_, AppState>, user: &User, role_name: Option<&str>) {
    if user.username.eq_ignore_ascii_case("admin") {
        return;
    }
    let pool = state.auth_service.user_repo.pool();

    let Some(sync_uuid) = sqlx::query_scalar::<_, String>("SELECT uuid FROM users WHERE id = ?")
        .bind(user.id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
    else {
        return;
    };

    let store_code: Option<String> = match user.store_id {
        Some(store_id) => sqlx::query_scalar("SELECT code FROM stores WHERE id = ?")
            .bind(store_id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten(),
        None => None,
    };

    let role_name = match role_name {
        Some(r) => Some(r.to_string()),
        None => sqlx::query_scalar(
            "SELECT r.role_name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?",
        )
        .bind(user.id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten(),
    };

    let created_at: Option<String> =
        sqlx::query_scalar("SELECT created_at FROM users WHERE id = ?")
            .bind(user.id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();

    let payload = UserSync {
        sync_uuid,
        local_user_id: user.id,
        username: user.username.clone(),
        cargo: user.cargo.clone(),
        email: user.email.clone(),
        store_code,
        role_name,
        is_active: user.is_active,
        created_at,
    };

    if let Err(e) = state
        .sync_queue
        .enqueue("catalog", &payload.sync_uuid, "user", &user.id.to_string(), &payload)
        .await
    {
        log::warn!("[sync] no se pudo encolar el usuario {}: {e}", user.id);
    }
}
