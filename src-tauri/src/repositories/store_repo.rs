use crate::models::store::Store;
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

    pub async fn create(&self, name: &str, address: Option<&str>, code: Option<&str>) -> Result<Store, sqlx::Error> {
        let result = sqlx::query("INSERT INTO stores (name, address, code) VALUES (?, ?, ?)")
            .bind(name)
            .bind(address)
            .bind(code)
            .execute(&self.pool)
            .await?;

        let id = result.last_insert_rowid();

        Ok(Store {
            id,
            name: name.to_string(),
            address: address.map(|s| s.to_string()),
            code: code.map(|s| s.to_string()),
            is_active: true,
            created_at: None, // DB handles default
        })
    }

    pub async fn update(&self, id: i64, name: &str, address: Option<&str>, code: Option<&str>) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE stores SET name = ?, address = ?, code = ? WHERE id = ?")
            .bind(name)
            .bind(address)
            .bind(code)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn soft_delete(&self, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE stores SET is_active = 0 WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
