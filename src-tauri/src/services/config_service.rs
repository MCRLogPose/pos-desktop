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

    pub async fn set_operating_mode(&self, mode: &str) -> Result<(), String> {
        if mode != "primary" && mode != "replica" && mode != "hybrid" {
            return Err("Modo inválido. Debe ser: primary, replica, o hybrid".to_string());
        }
        self.set_config("operating_mode", mode).await
    }
}
