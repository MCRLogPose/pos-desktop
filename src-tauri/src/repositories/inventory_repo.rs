use crate::models::inventory::{Category, ProductWithCategory};
use crate::models::inventory::Product;
use crate::sync::payloads::{CategorySync, ProductUpsertSync};
use crate::sync::queue::SyncQueue;
use sqlx::SqlitePool;

pub struct InventoryRepository {
    pool: SqlitePool,
}

/// Resultado de reponer mercadería sobre un producto existente.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddStockOutcome {
    pub product_id: i64,
    pub new_stock: i64,
    pub expense_id: i64,
    pub expense_amount: f64,
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
                p.id, p.code, p.name, p.display_name, p.category_id, c.name as category_name,
                p.price, p.cost, p.stock, p.min_stock, p.unit, p.image_url, p.is_active, p.store_id, p.created_at,
                p.supplier_name, u.username as created_by_name,
                s.name as store_name,
                p.origin_device_id, p.origin_username
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN stores s ON p.store_id = s.id
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
        display_name: Option<&str>,
        category_id: Option<i64>,
        price: f64,
        cost: f64,
        stock: i64,
        unit: Option<&str>,
        image_url: Option<&str>,
        store_id: i64,
        supplier_name: Option<&str>,
        created_by: Option<i64>,
    ) -> Result<i64, sqlx::Error> {
        let result = sqlx::query(
            "INSERT INTO products (code, name, display_name, category_id, price, cost, stock, unit, image_url, store_id, supplier_name, created_by, origin_device_id, origin_username)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT value FROM app_config WHERE key = 'device_id'), (SELECT u.username FROM users u WHERE u.id = ?))"
        )
        .bind(code)
        .bind(name)
        .bind(display_name)
        .bind(category_id)
        .bind(price)
        .bind(cost)
        .bind(stock)
        .bind(unit)
        .bind(image_url)
        .bind(store_id)
        .bind(supplier_name)
        .bind(created_by)
        .bind(created_by)
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
        display_name: Option<&str>,
        category_id: Option<i64>,
        price: f64,
        cost: f64,
        stock: i64,
        unit: Option<&str>,
        image_url: Option<&str>,
        store_id: i64,
        supplier_name: Option<&str>,
        created_by: Option<i64>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE products SET code=?, name=?, display_name=?, category_id=?, price=?, cost=?, stock=?, unit=?, image_url=?, store_id=?, supplier_name=COALESCE(?, supplier_name), created_by=COALESCE(?, created_by) WHERE id=?"
        )
        .bind(code)
        .bind(name)
        .bind(display_name)
        .bind(category_id)
        .bind(price)
        .bind(cost)
        .bind(stock)
        .bind(unit)
        .bind(image_url)
        .bind(store_id)
        .bind(supplier_name)
        .bind(created_by)
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

    /// Reposicion de un producto existente: suma stock, actualiza el costo al
    /// precio de compra actual y registra el gasto por `unit_cost * quantity`,
    /// todo en una sola transaccion.
    ///
    /// El stock se suma en SQL (`stock = stock + ?`) a proposito: calcularlo en
    /// el cliente con `stock + qty` sobre un snapshot viejo pisaba las ventas
    /// que ocurrieran mientras el modal estaba abierto. Y el gasto va en la misma
    /// transaccion porque antes eran dos comandos independientes: si el segundo
    /// fallaba, el stock ya habia subido sin gasto que lo respaldara.
    pub async fn add_stock_to_product(
        &self,
        id: i64,
        quantity: i64,
        unit_cost: f64,
        store_id: i64,
        supplier_name: Option<&str>,
        payment_method: &str,
        expense_uuid: &str,
    ) -> Result<AddStockOutcome, String> {
        if quantity <= 0 {
            return Err("la cantidad debe ser mayor a 0".into());
        }
        if unit_cost <= 0.0 {
            return Err(
                "ingresa el costo de compra de esta mercadería: con costo 0 el gasto se \
                 registraría en 0 y las márgenes quedarían infladas"
                    .into(),
            );
        }

        let expense_amount = unit_cost * quantity as f64;
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| format!("no se pudo iniciar la operación: {e}"))?;

        let name: Option<String> =
            sqlx::query_scalar("SELECT name FROM products WHERE id = ? AND is_active = 1")
                .bind(id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| format!("no se pudo leer el producto: {e}"))?;

        let name = name.ok_or_else(|| "el producto no existe o está eliminado".to_string())?;

        sqlx::query("UPDATE products SET stock = stock + ?1, cost = ?2 WHERE id = ?3")
            .bind(quantity)
            .bind(unit_cost)
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("no se pudo actualizar el stock: {e}"))?;

        let new_stock: i64 =
            sqlx::query_scalar("SELECT stock FROM products WHERE id = ?")
                .bind(id)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| format!("no se pudo leer el stock resultante: {e}"))?;

        let description = format!("Ingreso mercadería: {name}");
        let expense_id = sqlx::query(
            "INSERT INTO expenses (uuid, cash_session_id, description, amount, payment_method, category, supplier, store_id, source, created_at)
             VALUES (?, NULL, ?, ?, ?, 'Mercadería', ?, ?, 'standalone', datetime('now', 'localtime'))",
        )
        .bind(expense_uuid)
        .bind(&description)
        .bind(expense_amount)
        .bind(payment_method)
        .bind(supplier_name)
        .bind(store_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("no se pudo registrar el gasto: {e}"))?
        .last_insert_rowid();

        tx.commit()
            .await
            .map_err(|e| format!("no se pudo confirmar la operación: {e}"))?;

        // Los encolados van despues del commit: si fallan, el dato local ya esta
        // y el outbox se recupera en el proximo sync.
        let pool = self.pool.clone();
        let uuid_owned = expense_uuid.to_string();
        let description_owned = description.clone();
        let payment_method_owned = payment_method.to_string();
        let supplier_owned = supplier_name.map(str::to_string);
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_product(&pool, id).await {
                log::warn!("[sync] no se pudo encolar producto {id}: {e}");
            }
            if let Err(e) = crate::repositories::cash_repo::enqueue_expense_standalone(
                &pool,
                &uuid_owned,
                expense_id,
                &description_owned,
                expense_amount,
                &payment_method_owned,
                Some("Mercadería".to_string()),
                supplier_owned,
            )
            .await
            {
                log::warn!("[sync] no se pudo encolar gasto general {expense_id}: {e}");
            }
        });

        Ok(AddStockOutcome {
            product_id: id,
            new_stock,
            expense_id,
            expense_amount,
        })
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
            Option<String>,
            f64,
            f64,
            Option<i64>,
            Option<String>,
            Option<String>,
            bool,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        )> = sqlx::query_as(
            "SELECT p.uuid, p.code, p.name, p.display_name, c.name, p.price, p.cost, p.min_stock, p.unit, p.image_url, p.is_active,
                p.supplier_name, u.username,
                p.origin_device_id, p.origin_username
         FROM products p LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN users u ON p.created_by = u.id
         WHERE p.id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    let Some((
        sync_uuid,
        code,
        name,
        display_name,
        category_name,
        price,
        cost,
        min_stock,
        unit,
        image_url,
        is_active,
        supplier_name,
        created_by_username,
        origin_device_id,
        origin_username,
    )) = row
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
                display_name,
                category_name,
                price,
                cost,
                min_stock,
                unit,
                image_url,
                is_active,
                supplier_name,
                created_by_username,
                origin_device_id,
                origin_username,
                occurred_at: chrono::Local::now().to_rfc3339(),
            },
        )
        .await
}
