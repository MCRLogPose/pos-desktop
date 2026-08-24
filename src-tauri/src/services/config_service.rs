use sqlx::SqlitePool;

pub struct ConfigService {
    pool: SqlitePool,
}

impl ConfigService {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn get_config(&self, key: &str) -> Result<Option<String>, String> {
        let result: Option<(String,)> = sqlx::query_as("SELECT value FROM app_config WHERE key = ?")
            .bind(key)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(result.map(|r| r.0))
    }

    pub async fn set_config(&self, key: &str, value: &str) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) 
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
        )
        .bind(key)
        .bind(value)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn get_operating_mode(&self) -> Result<String, String> {
        match self.get_config("operating_mode").await? {
            Some(mode) => Ok(mode),
            None => Ok("hybrid".to_string()),
        }
    }

    pub async fn has_config(&self) -> Result<bool, String> {
        let result: Option<(String,)> = sqlx::query_as("SELECT value FROM app_config WHERE key = 'operating_mode'")
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(result.is_some())
    }

    pub async fn set_operating_mode(&self, mode: &str) -> Result<(), String> {
        if mode != "primary" && mode != "replica" && mode != "hybrid" {
            return Err("Modo inválido. Debe ser: primary, replica, o hybrid".to_string());
        }
        self.set_config("operating_mode", mode).await
    }

    /// Datos operativos (ventas, caja, inventario, lotes, sedes, usuarios):
    /// en Primary solo llegan por sincronizacion, nunca se crean/editan localmente.
    pub async fn reject_in_primary(&self) -> Result<(), String> {
        self.reject_mode(
            "primary",
            "en modo Primary los datos operativos solo llegan por sincronización",
        )
        .await
    }

    /// Gastos generales (standalone): nacen solo en Primary/Hybrid.
    pub async fn reject_in_replica(&self) -> Result<(), String> {
        self.reject_mode(
            "replica",
            "en modo Replica los gastos generales se registran en el Primary",
        )
        .await
    }

    async fn reject_mode(&self, blocked: &str, reason: &str) -> Result<(), String> {
        let current =
            self.get_operating_mode()
                .await
                .unwrap_or_else(|_| "hybrid".to_string());
        if current == blocked {
            return Err(format!("Operación no permitida: {reason}"));
        }
        Ok(())
    }
}
