use serde::Serialize;
use sqlx::SqlitePool;

/// Fila pendiente: id + item_uuid + payload + topic + entidad de origen.
#[derive(Clone)]
pub struct PendingItem {
    pub id: i64,
    pub topic: String,
    /// Entidad logica de la fila ('product', 'category', 'expense',
    /// 'stock_movement' ...). Es lo que decide en que lista del batch va el
    /// payload: sin ella habia que adivinarlo intentando deserializar el item
    /// contra todos los tipos del topic, y dos tipos compatibles entre si
    /// terminaban duplicados (un gasto entrava tambien como ingreso).
    pub entity: String,
    pub item_uuid: String,
    /// Version del payload tal como se leyo de la cola. Se devuelve con el ACK
    /// para no marcar como sincronizada una version mas nueva.
    pub revision: i64,
    pub payload: serde_json::Value,
}

/// Fila de la outbox tal como se muestra en la UI: que falta por enviar y por
/// que.
///
/// Sin esto el unico dato que habia era un contador, y un contador no deja
/// distinguir "no hay nada pendiente" de "tres cosas lleva dias fallando".
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncQueueItem {
    pub id: i64,
    pub topic: String,
    pub entity: Option<String>,
    pub entity_id: Option<String>,
    pub item_uuid: String,
    /// Veces que el payload de esta fila fue reemplazado por uno mas nuevo.
    pub revision: i64,
    pub last_error: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
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

    /// Encola un item para enviarlo a la Primary.
    ///
    /// `item_uuid` es la identidad del item y hay un indice UNIQUE sobre el, asi
    /// que una fila ya existente se REFRESCA en vez de ignorarse. Ese detalle es
    /// lo que hace que el catalogo se mantenga vivo: con `INSERT OR IGNORE`, la
    /// segunda edicion de un producto caia contra la fila ya sincronizada y se
    /// descartaba en silencio, de modo que la Primary se quedaba con la primera
    /// version para siempre (categoria, precio o nombre viejos).
    ///
    /// Refrescar tambien reabre el envio (`synced = 0`): si el item ya habia sido
    /// aceptado, la Primary lo vuelve a aplicar y responde `duplicate`, que el
    /// cliente trata igual que `accepted`.
    ///
    /// `topic` usa la forma snake_case ('sales', 'inventory' ... nombre del payload)
    /// y `entity` el nombre de la entidad logica ('product', 'stock_movement' ...),
    /// que es por donde el cliente decide a que lista del batch va el payload.
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
            "INSERT INTO sync_outbox (topic, item_uuid, entity, entity_id, payload)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(item_uuid) DO UPDATE SET
                topic = excluded.topic,
                entity = excluded.entity,
                entity_id = excluded.entity_id,
                payload = excluded.payload,
                revision = sync_outbox.revision + 1,
                synced = 0,
                last_error = NULL,
                updated_at = datetime('now','localtime')",
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

    /// Cantidad de filas que todavia no han sido aceptadas por la Primary.
    pub async fn pending_count(&self) -> Result<i64, sqlx::Error> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE synced = 0")
            .fetch_one(&self.pool)
            .await?;
        Ok(count)
    }

    /// Filas que todavia no llegaron a la Primary: o nunca se enviaron, o la
    /// Primary las rechazo y siguen esperando con su motivo.
    pub async fn failed_count(&self) -> Result<i64, sqlx::Error> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sync_outbox WHERE synced = 0 AND last_error IS NOT NULL",
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(count)
    }

    /// Total de filas ya confirmadas por la Primary. La outbox no se poda: es el
    /// historial de lo que salio de esta maquina, y por eso el total crece para
    /// siempre.
    pub async fn synced_count(&self) -> Result<i64, sqlx::Error> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE synced = 1")
            .fetch_one(&self.pool)
            .await?;
        Ok(count)
    }

    /// Detalle de lo pendiente, para que la UI pueda mostrar que falta y por que.
    /// Solo trae `synced = 0`: lo ya confirmado no aporta nada y son miles de
    /// filas.
    pub async fn pending_items(&self, limit: i64) -> Result<Vec<SyncQueueItem>, sqlx::Error> {
        let rows = sqlx::query_as::<_, (i64, String, Option<String>, Option<String>, String, i64, Option<String>, Option<String>, Option<String>)>(
            "SELECT id, topic, entity, entity_id, item_uuid, revision, last_error, created_at, updated_at
               FROM sync_outbox
              WHERE synced = 0
           ORDER BY CASE WHEN last_error IS NULL THEN 1 ELSE 0 END, id ASC
              LIMIT ?",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(
                |(id, topic, entity, entity_id, item_uuid, revision, last_error, created_at, updated_at)| {
                    SyncQueueItem {
                        id,
                        topic,
                        entity,
                        entity_id,
                        item_uuid,
                        revision,
                        last_error,
                        created_at,
                        updated_at,
                    }
                },
            )
            .collect())
    }

    /// Fila pendiente, ordenadas por topic y fecha.
    pub async fn pending(&self) -> Result<Vec<PendingItem>, sqlx::Error> {
        let rows = sqlx::query_as::<_, (i64, String, String, String, i64, String)>(
            "SELECT id, topic, COALESCE(entity, ''), item_uuid, revision, payload FROM sync_outbox
             WHERE synced = 0 ORDER BY topic ASC, id ASC",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .filter_map(|(id, topic, entity, item_uuid, revision, payload)| {
                let payload: serde_json::Value = serde_json::from_str(&payload).ok()?;
                Some(PendingItem {
                    id,
                    topic,
                    entity,
                    item_uuid,
                    revision,
                    payload,
                })
            })
            .collect())
    }

    /// Marca como sincronizados los items dados (ack accepted o duplicate).
    /// Marca como sincronizado lo que la Primary acepto, **solo si la fila sigue
    /// siendo la version que se envio**.
    ///
    /// Sin esta condicion, editar un producto mientras su catalogo viaja en un
    /// POST hace que el ACK de la version vieja marque como sincronizada la
    /// version nueva (mismo `item_uuid`): el cambio se pierde en silencio y no
    /// aparece hasta que alguien pide un reenvio completo. Con la condicion la
    /// fila nueva sigue `synced = 0` y sale en el siguiente sync.
    pub async fn mark_synced(
        &self,
        accepted: &[(String, i64)],
    ) -> Result<(), sqlx::Error> {
        for (item_uuid, sent_revision) in accepted {
            sqlx::query(
                "UPDATE sync_outbox
                    SET synced = 1, last_error = NULL, updated_at = datetime('now','localtime')
                  WHERE item_uuid = ? AND revision = ?",
            )
            .bind(item_uuid)
            .bind(sent_revision)
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
