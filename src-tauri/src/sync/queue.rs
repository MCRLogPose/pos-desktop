use serde::Serialize;
use sqlx::SqlitePool;

/// Fila pendiente: id + item_uuid + payload + topic.
#[derive(Clone)]
pub struct PendingItem {
    pub id: i64,
    pub topic: String,
    pub item_uuid: String,
    pub payload: serde_json::Value,
}

/// Cola de sincronizacion (outbox) de la Replica -> Primary.
///
/// Cada operacion de escritura en una Replica inserta una fila en `sync_outbox`
/// con su payload JSON y su topic. Al cerrar caja (o sync manual), las filas
/// synced=0 se agrupan por topic y se envian a la Primary.
///
/// El metodo `enqueue` solo persiste si el dispositivo opera en modo `replica`,
/// de modo que Hybrid/Primary no acumulan filas.
pub struct SyncQueue {
    pool: SqlitePool,
}

impl SyncQueue {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// true cuando la maquina opera en modo Replica (la unica que sincroniza hacia Primary).
    pub async fn is_replica(&self) -> bool {
        let mode: Option<String> = sqlx::query_scalar(
            "SELECT value FROM app_config WHERE key = 'operating_mode'",
        )
        .fetch_optional(&self.pool)
        .await
        .ok()
        .flatten();
        mode.as_deref() == Some("replica")
    }

    /// Inserta un item en la outbox si el modo es Replica.
    ///
    /// `topic` usa la forma snake_case ('sales', 'inventory' ... nombre del payload).
    pub async fn enqueue<T: Serialize>(
        &self,
        topic: &str,
        item_uuid: &str,
        entity: &str,
        entity_id: &str,
        payload: &T,
    ) -> Result<(), sqlx::Error> {
        if !self.is_replica().await {
            return Ok(());
        }
        let json = serde_json::to_string(payload)
            .map_err(|e| sqlx::Error::Protocol(format!("serializar payload {topic}: {e}").into()))?;
        sqlx::query(
            "INSERT OR IGNORE INTO sync_outbox (topic, item_uuid, entity, entity_id, payload)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )
        .bind(topic)
        .bind(item_uuid)
        .bind(entity)
        .bind(entity_id)
        .bind(json)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Inserta un item reemplazando cualquier fila previa del mismo item_uuid.
    ///
    /// Se usa cuando una entidad tiene estados que se superponen (p.ej. el cierre
    /// de caja reemplaza a la apertura pendiente del mismo item_uuid), de modo que
    /// el estado final es el unico que se sincroniza a la Primary.
    pub async fn enqueue_replace<T: Serialize>(
        &self,
        topic: &str,
        item_uuid: &str,
        entity: &str,
        entity_id: &str,
        payload: &T,
    ) -> Result<(), sqlx::Error> {
        if !self.is_replica().await {
            return Ok(());
        }
        let json = serde_json::to_string(payload)
            .map_err(|e| sqlx::Error::Protocol(format!("serializar payload {topic}: {e}").into()))?;
        sqlx::query(
            "INSERT OR REPLACE INTO sync_outbox (topic, item_uuid, entity, entity_id, payload)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )
        .bind(topic)
        .bind(item_uuid)
        .bind(entity)
        .bind(entity_id)
        .bind(json)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Fila pendiente, ordenadas por topic y fecha.
    pub async fn pending(&self) -> Result<Vec<PendingItem>, sqlx::Error> {
        let rows = sqlx::query_as::<_, (i64, String, String, String)>(
            "SELECT id, topic, item_uuid, payload FROM sync_outbox
             WHERE synced = 0 ORDER BY topic ASC, id ASC",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .filter_map(|(id, topic, item_uuid, payload)| {
                let payload: serde_json::Value = serde_json::from_str(&payload).ok()?;
                Some(PendingItem {
                    id,
                    topic,
                    item_uuid,
                    payload,
                })
            })
            .collect())
    }

    /// Marca como sincronizados los items dados (ack accepted o duplicate).
    pub async fn mark_synced(&self, item_uuids: &[String]) -> Result<(), sqlx::Error> {
        for u in item_uuids {
            sqlx::query(
                "UPDATE sync_outbox SET synced = 1, updated_at = datetime('now','localtime')
                 WHERE item_uuid = ?",
            )
            .bind(u)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    /// Registra que un item fue rechazado (se conserva pendiente y se guarda el motivo).
    pub async fn mark_failed(&self, item_uuid: &str, error: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE sync_outbox SET last_error = ?1, updated_at = datetime('now','localtime')
             WHERE item_uuid = ?2",
        )
        .bind(error)
        .bind(item_uuid)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
