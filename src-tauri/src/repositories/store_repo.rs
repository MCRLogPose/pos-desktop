use crate::models::store::Store;
use crate::sync::payloads::StoreSync;
use crate::sync::queue::SyncQueue;
use sqlx::SqlitePool;

pub struct StoreRepository {
    pool: SqlitePool,
}

impl StoreRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn find_all(&self) -> Result<Vec<Store>, sqlx::Error> {
        sqlx::query_as::<_, Store>("SELECT * FROM stores WHERE is_active = 1")
            .fetch_all(&self.pool)
            .await
    }

    pub async fn create(
        &self,
        name: &str,
        address: Option<&str>,
        code: Option<&str>,
    ) -> Result<Store, sqlx::Error> {
        let uuid = uuid::Uuid::new_v4().to_string();
        let result = sqlx::query("INSERT INTO stores (name, address, code, uuid) VALUES (?, ?, ?, ?)")
            .bind(name)
            .bind(address)
            .bind(code)
            .bind(&uuid)
            .execute(&self.pool)
            .await?;

        let id = result.last_insert_rowid();

        let store = Store {
            id,
            name: name.to_string(),
            address: address.map(|s| s.to_string()),
            code: code.map(|s| s.to_string()),
            is_active: true,
            created_at: None, // DB handles default
        };
        let pool = self.pool.clone();
        let sync_store = store.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_store(&pool, &sync_store).await {
                log::warn!("[sync] no se pudo encolar la sede {}: {e}", sync_store.id);
            }
        });
        Ok(store)
    }

    pub async fn update(
        &self,
        id: i64,
        name: &str,
        address: Option<&str>,
        code: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE stores SET name = ?, address = ?, code = ? WHERE id = ?")
            .bind(name)
            .bind(address)
            .bind(code)
            .bind(id)
            .execute(&self.pool)
            .await?;
        let pool = self.pool.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_store_by_id(&pool, id).await {
                log::warn!("[sync] no se pudo encolar la sede {id}: {e}");
            }
        });
        Ok(())
    }

    pub async fn soft_delete(&self, id: i64) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        // Desvincular usuarios antes de dar de baja la sede para no dejarlos huerfanos
        sqlx::query("UPDATE users SET store_id = NULL WHERE store_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE stores SET is_active = 0 WHERE id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(())
    }
}

/// Encola una sede en la outbox de sincronizacion. Se invoca en segundo plano
/// (despues del write) para no bloquear la UI.
async fn enqueue_store(pool: &SqlitePool, store: &Store) -> Result<(), sqlx::Error> {
    let sync_uuid: Option<String> = sqlx::query_scalar("SELECT uuid FROM stores WHERE id = ?")
        .bind(store.id)
        .fetch_optional(pool)
        .await?
        .flatten();
    let Some(sync_uuid) = sync_uuid else {
        return Ok(());
    };
    let created_at: Option<String> =
        sqlx::query_scalar("SELECT created_at FROM stores WHERE id = ?")
            .bind(store.id)
            .fetch_optional(pool)
            .await?
            .flatten();
    let queue = SyncQueue::new(pool.clone());
    queue
        .enqueue(
            "catalog",
            &sync_uuid,
            "store",
            &store.id.to_string(),
            &StoreSync {
                sync_uuid: sync_uuid.clone(),
                local_store_id: store.id,
                code: store.code.clone(),
                name: store.name.clone(),
                address: store.address.clone(),
                is_active: store.is_active,
                created_at,
            },
        )
        .await
}

/// Encola una sede por id (para updates). Se invoca en segundo plano.
async fn enqueue_store_by_id(pool: &SqlitePool, id: i64) -> Result<(), sqlx::Error> {
    let store: Option<Store> = sqlx::query_as::<_, Store>("SELECT * FROM stores WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    if let Some(store) = store {
        enqueue_store(pool, &store).await?;
    }
    Ok(())
}
