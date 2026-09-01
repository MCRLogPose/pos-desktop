use crate::commands::auth::AppState;
use tauri::State;

/// Fuerza la sincronizacion manual Replica -> Primary.
///
/// Envía todas las filas pendientes de la outbox a la Primary. Solamente tiene
/// efecto en modo Replica; en Primary/Hybrid devuelve un mensaje informativo.
#[tauri::command]
pub async fn force_sync_now(state: State<'_, AppState>) -> Result<String, String> {
    state.sync_client.sync_all().await
}
