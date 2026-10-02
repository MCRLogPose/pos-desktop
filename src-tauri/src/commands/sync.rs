use crate::commands::auth::AppState;
use crate::sync::net::{local_ipv4_addresses, normalize_primary_url};
use crate::sync::DEFAULT_SYNC_PORT;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Estado de la sincronizacion que la UI de Configuracion necesita para mostrar
/// el panel correcto segun el modo de la maquina.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncInfo {
    pub operating_mode: String,
    pub device_id: Option<String>,
    pub sync_port: u16,
    pub primary_url: Option<String>,
    pub store_code: Option<String>,
    /// Nunca se envia el token aqui: se pide explicitamente con `get_sync_token`.
    pub has_token: bool,
    pub pending_count: i64,
    /// Filas que la Primary rechazo y que siguen esperando su reintento.
    pub failed_count: i64,
    /// Historial de lo ya confirmado. La cola no se poda, asi que este numero
    /// solo crece.
    pub synced_count: i64,
    /// Sede con la que la Primary archiva los datos de esta maquina.
    ///
    /// La identidad se deriva del `device_id`, no del nombre de la tienda: sin
    /// esto no hay forma de saber donde buscar los datos de una replica, y
    /// acaba buscandose en la sede equivocada ("no llego nada") cuando en
    /// realidad llego a la sede de al lado.
    pub primary_store_code: Option<String>,
    pub local_ips: Vec<String>,
    /// false cuando la app no levantó el servidor (p. ej. se eligió Primary
    /// después del arranque): hay que reiniciar para que las réplicas conecten.
    pub server_running: bool,
}

/// Campos editables desde la UI. `None` = no tocar ese campo.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SyncSettingsInput {
    pub primary_url: Option<String>,
    pub sync_token: Option<String>,
    pub store_code: Option<String>,
    pub sync_port: Option<u16>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSaveResult {
    /// El puerto y el token solo los lee el servidor de sync al arrancar la app.
    pub restart_required: bool,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncTestResult {
    pub ok: bool,
    pub message: String,
}

/// Configuracion de sincronizacion de esta maquina (solo lectura).
#[tauri::command]
pub async fn get_sync_info(state: State<'_, AppState>) -> Result<SyncInfo, String> {
    let config = &state.config_service;
    let pending_count = state
        .sync_queue
        .pending_count()
        .await
        .map_err(|e| format!("no se pudo leer la cola de sincronizacion: {e}"))?;
    let failed_count = state
        .sync_queue
        .failed_count()
        .await
        .map_err(|e| format!("no se pudo leer la cola de sincronizacion: {e}"))?;
    let synced_count = state
        .sync_queue
        .synced_count()
        .await
        .map_err(|e| format!("no se pudo leer la cola de sincronizacion: {e}"))?;
    let device_id = config.get_config_non_empty("device_id").await?;
    // `ipconfig` es un proceso bloqueante: se ejecuta fuera del runtime async.
    let local_ips = tauri::async_runtime::spawn_blocking(local_ipv4_addresses)
        .await
        .unwrap_or_default();
    let server_running = state
        .sync_server_running
        .load(std::sync::atomic::Ordering::SeqCst);

    Ok(SyncInfo {
        operating_mode: config.get_operating_mode().await?,
        primary_store_code: device_id
            .as_deref()
            .map(crate::sync::apply::device_store_code),
        device_id,
        sync_port: config
            .get_config_non_empty("sync_port")
            .await?
            .and_then(|v| v.parse().ok())
            .unwrap_or(DEFAULT_SYNC_PORT),
        primary_url: config.get_config_non_empty("primary_url").await?,
        store_code: config.get_config_non_empty("store_code").await?,
        has_token: config
            .get_config_non_empty("sync_token")
            .await?
            .is_some(),
        pending_count,
        failed_count,
        synced_count,
        local_ips,
        server_running,
    })
}

/// Detalle de lo que todavia no llego a la Primary.
///
/// La UI necesita esto para poder distinguir "no hay nada pendiente" de "hay
/// cosas atascadas": un contador no dice *que* ni *por que*.
#[tauri::command]
pub async fn get_sync_queue_items(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<crate::sync::queue::SyncQueueItem>, String> {
    let limit = limit.unwrap_or(200).clamp(1, 1000);
    state
        .sync_queue
        .pending_items(limit)
        .await
        .map_err(|e| format!("no se pudo leer la cola de sincronizacion: {e}"))
}

/// Token de sincronizacion de esta maquina, para compartirlo con las Replicas.
///
/// En modo Primary se genera en el primer arranque; si se perdiera, se regenera
/// aqui y se persiste para que el servidor del proximo arranque lo use.
#[tauri::command]
pub async fn get_sync_token(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let config = &state.config_service;
    if let Some(token) = config.get_config_non_empty("sync_token").await? {
        return Ok(Some(token));
    }

    if config.get_operating_mode().await? != "primary" {
        return Ok(None);
    }

    let token = uuid::Uuid::new_v4().to_string();
    config.set_config("sync_token", &token).await?;
    Ok(Some(token))
}

/// Guarda la configuracion elegida por el administrador.
///
/// Los valores en blanco se borran (quedan "sin configurar"), de modo que la UI
/// puede limpiar un dato sin abrir la base de datos.
#[tauri::command]
pub async fn save_sync_settings(
    state: State<'_, AppState>,
    settings: SyncSettingsInput,
) -> Result<SyncSaveResult, String> {
    let config = &state.config_service;
    let mut saved: Vec<&str> = Vec::new();
    let mut restart_required = false;

    if let Some(input) = settings.primary_url {
        let value = input.trim();
        if value.is_empty() {
            config.delete_config("primary_url").await?;
        } else {
            let url = normalize_primary_url(value, DEFAULT_SYNC_PORT)?;
            config.set_config("primary_url", &url).await?;
        }
        saved.push("Dirección de la Primary");
    }

    if let Some(input) = settings.sync_token {
        let value = input.trim();
        if value.is_empty() {
            config.delete_config("sync_token").await?;
        } else {
            config.set_config("sync_token", value).await?;
        }
        saved.push("Token");
        restart_required = true;
    }

    if let Some(input) = settings.store_code {
        let value = input.trim();
        if value.is_empty() {
            config.delete_config("store_code").await?;
        } else {
            config.set_config("store_code", value).await?;
        }
        saved.push("Código de tienda");
    }

    if let Some(port) = settings.sync_port {
        if port == 0 {
            return Err("El puerto debe ser un número mayor que 0".to_string());
        }
        config.set_config("sync_port", &port.to_string()).await?;
        saved.push("Puerto");
        restart_required = true;
    }

    let message = if saved.is_empty() {
        "No hubo cambios que guardar".to_string()
    } else {
        format!("Guardado: {}", saved.join(", "))
    };

    Ok(SyncSaveResult {
        restart_required,
        message,
    })
}

/// Verifica que la Primary configurada responde, sin enviar datos de la outbox.
#[tauri::command]
pub async fn test_sync_connection(state: State<'_, AppState>) -> Result<SyncTestResult, String> {
    match state.sync_client.test_connection().await {
        Ok(message) => Ok(SyncTestResult { ok: true, message }),
        Err(message) => Ok(SyncTestResult { ok: false, message }),
    }
}

/// Fuerza la sincronizacion manual Replica -> Primary.
///
/// Envía todas las filas pendientes de la outbox a la Primary. Solamente tiene
/// efecto en modo Replica; en Primary/Hybrid devuelve un mensaje informativo.
#[tauri::command]
pub async fn force_sync_now(state: State<'_, AppState>) -> Result<String, String> {
    state.sync_client.sync_all().await
}

/// Reencola el catalogo completo y la diferencia de stock, y sincroniza.
///
/// Es la pieza que faltaba para que "importar catalogo" y "pasar de Primary a
/// Replica" sean operaciones seguras: la outbox es un log de cambios, asi que un
/// producto que nunca se encolo (creado antes de que existiera el encolado, o
/// mientras la maquina operaba como Primary) no llegaria nunca por mas syncs
/// manuales que se lancen.
///
/// Es idempotente: el catalogo se reaplica sobre las mismas filas y el stock solo
/// manda la diferencia entre lo que hay y lo que ya se le comunico a la Primary.
#[tauri::command]
pub async fn force_full_inventory_sync(
    state: State<'_, AppState>,
) -> Result<FullSyncResult, String> {
    state.config_service.reject_in_primary().await?;
    let report = state
        .inventory_service
        .reconcile_with_primary()
        .await?;
    let summary = state.sync_client.sync_all().await?;
    Ok(FullSyncResult {
        categories: report.categories,
        products: report.products,
        stock_movements: report.stock_movements,
        summary,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FullSyncResult {
    pub categories: usize,
    pub products: usize,
    pub stock_movements: usize,
    pub summary: String,
}
