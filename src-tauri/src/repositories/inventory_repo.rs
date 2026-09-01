use crate::models::inventory::{Category, ProductWithCategory};
use crate::models::inventory::Product;
use crate::sync::payloads::{CategorySync, ProductUpsertSync};
use crate::sync::queue::SyncQueue;
use sqlx::SqlitePool;

pub struct InventoryRepository {
    pool: SqlitePool,
}

impl InventoryRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    // Categories
    pub async fn get_categories(&self) -> Result<Vec<Category>, sqlx::Error> {
        sqlx::query_as::<_, Category>("SELECT * FROM categories ORDER BY name ASC")
            .fetch_all(&self.pool)
            .await
    }

    pub async fn create_category(&self, name: &str) -> Result<Category, sqlx::Error> {
        let result = sqlx::query("INSERT INTO categories (name) VALUES (?)")
            .bind(name)
            .execute(&self.pool)
            .await?;

        let id = result.last_insert_rowid();

        let pool = self.pool.clone();
        let name_owned = name.to_string();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_category(&pool, id, name_owned).await {
                log::warn!("[sync] no se pudo encolar categoria {id}: {e}");
            }
        });

        Ok(Category {
            id,
            name: name.to_string(),
        })
    }

    pub async fn update_category(&self, id: i64, name: &str) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE categories SET name = ? WHERE id = ?")
            .bind(name)
            .bind(id)
            .execute(&self.pool)
            .await?;

        let pool = self.pool.clone();
        let name_owned = name.to_string();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_category(&pool, id, name_owned).await {
                log::warn!("[sync] no se pudo encolar categoria {id}: {e}");
            }
        });
        Ok(())
    }

    pub async fn delete_category(&self, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM categories WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // Products
    pub async fn get_products(&self, store_id: i64) -> Result<Vec<ProductWithCategory>, sqlx::Error> {
        let sql = r#"
            SELECT 
                p.id, p.code, p.name, p.category_id, c.name as category_name,
                p.price, p.cost, p.stock, p.min_stock, p.unit, p.image_url, p.is_active, p.store_id, p.created_at
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1 AND p.store_id = ?
            ORDER BY p.name ASC
        "#;
        sqlx::query_as::<_, ProductWithCategory>(sql)
            .bind(store_id)
            .fetch_all(&self.pool)
            .await
    }

    pub async fn create_product(
        &self,
        code: Option<&str>,
        name: &str,
        category_id: Option<i64>,
        price: f64,
        cost: f64,
        stock: i64,
        unit: Option<&str>,
        image_url: Option<&str>,
        store_id: i64,
    ) -> Result<i64, sqlx::Error> {
        let result = sqlx::query(
            "INSERT INTO products (code, name, category_id, price, cost, stock, unit, image_url, store_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(code)
        .bind(name)
        .bind(category_id)
        .bind(price)
        .bind(cost)
        .bind(stock)
        .bind(unit)
        .bind(image_url)
        .bind(store_id)
        .execute(&self.pool)
        .await?;

        let id = result.last_insert_rowid();

        let pool = self.pool.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_product(&pool, id).await {
                log::warn!("[sync] no se pudo encolar producto {id}: {e}");
            }
        });

        Ok(id)
    }

    pub async fn update_product(
        &self,
        id: i64,
        code: Option<&str>,
        name: &str,
        category_id: Option<i64>,
        price: f64,
        cost: f64,
        stock: i64,
        unit: Option<&str>,
        image_url: Option<&str>,
        store_id: i64,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE products SET code=?, name=?, category_id=?, price=?, cost=?, stock=?, unit=?, image_url=?, store_id=? WHERE id=?"
        )
        .bind(code)
        .bind(name)
        .bind(category_id)
        .bind(price)
        .bind(cost)
        .bind(stock)
        .bind(unit)
        .bind(image_url)
        .bind(store_id)
        .bind(id)
        .execute(&self.pool)
        .await?;

        let pool = self.pool.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_product(&pool, id).await {
                log::warn!("[sync] no se pudo encolar producto {id}: {e}");
            }
        });
        Ok(())
    }

    pub async fn soft_delete_product(&self, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE products SET is_active = 0 WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Devuelve true si el usuario tiene cargo ADMIN.
    pub async fn user_is_admin(&self, user_id: i64) -> Result<bool, sqlx::Error> {
        let cargo: Option<String> =
            sqlx::query_scalar("SELECT cargo FROM users WHERE id = ?")
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(cargo
            .as_deref()
            .map(|c| c.eq_ignore_ascii_case("ADMIN"))
            .unwrap_or(false))
    }

    pub async fn find_by_code(
        &self,
        code: &str,
        store_id: i64,
    ) -> Result<Option<Product>, sqlx::Error> {
        sqlx::query_as::<_, Product>(
            "SELECT * FROM products WHERE code = ? AND store_id = ? AND is_active = 1",
        )
        .bind(code)
        .bind(store_id)
        .fetch_optional(&self.pool)
        .await
    }
}

async fn enqueue_category(pool: &SqlitePool, id: i64, name: String) -> Result<(), sqlx::Error> {
    let queue = SyncQueue::new(pool.clone());
    let sync_uuid: Option<String> =
        sqlx::query_scalar("SELECT uuid FROM categories WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
    let Some(sync_uuid) = sync_uuid else {
        return Ok(());
    };
    queue
        .enqueue(
            "inventory",
            &sync_uuid,
            "category",
            &id.to_string(),
            &CategorySync {
                sync_uuid: sync_uuid.clone(),
                local_category_id: id,
                name,
            },
        )
        .await
}

async fn enqueue_product(pool: &SqlitePool, id: i64) -> Result<(), sqlx::Error> {
    let queue = SyncQueue::new(pool.clone());
    let row: Option<(
        String,
        Option<String>,
        String,
        Option<String>,
        f64,
        f64,
        Option<i64>,
        Option<String>,
        Option<String>,
        bool,
    )> = sqlx::query_as(
        "SELECT p.uuid, p.code, p.name, c.name, p.price, p.cost, p.min_stock, p.unit, p.image_url, p.is_active
         FROM products p LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    let Some((sync_uuid, code, name, category_name, price, cost, min_stock, unit, image_url, is_active)) = row
    else {
        return Ok(());
    };
    queue
        .enqueue(
            "inventory",
            &sync_uuid,
            "product",
            &id.to_string(),
            &ProductUpsertSync {
                sync_uuid: sync_uuid.clone(),
                local_product_id: id,
                code,
                name,
                category_name,
                price,
                cost,
                min_stock,
                unit,
                image_url,
                is_active,
                occurred_at: chrono::Local::now().to_rfc3339(),
            },
        )
        .await
}
