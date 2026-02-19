use crate::models::inventory::{Category, ProductWithCategory};
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
        
        Ok(Category {
            id: result.last_insert_rowid(),
            name: name.to_string(),
        })
    }

    pub async fn update_category(&self, id: i64, name: &str) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE categories SET name = ? WHERE id = ?")
            .bind(name)
            .bind(id)
            .execute(&self.pool)
            .await?;
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
    pub async fn get_products(&self) -> Result<Vec<ProductWithCategory>, sqlx::Error> {
        let sql = r#"
            SELECT 
                p.id, p.code, p.name, p.category_id, c.name as category_name,
                p.price, p.cost, p.stock, p.min_stock, p.unit, p.image_url, p.is_active, p.created_at
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1
            ORDER BY p.name ASC
        "#;
        sqlx::query_as::<_, ProductWithCategory>(sql)
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
    ) -> Result<i64, sqlx::Error> {
        let result = sqlx::query(
            "INSERT INTO products (code, name, category_id, price, cost, stock, unit, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(code)
        .bind(name)
        .bind(category_id)
        .bind(price)
        .bind(cost)
        .bind(stock)
        .bind(unit)
        .bind(image_url)
        .execute(&self.pool)
        .await?;

        Ok(result.last_insert_rowid())
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
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE products SET code=?, name=?, category_id=?, price=?, cost=?, stock=?, unit=?, image_url=? WHERE id=?"
        )
        .bind(code)
        .bind(name)
        .bind(category_id)
        .bind(price)
        .bind(cost)
        .bind(stock)
        .bind(unit)
        .bind(image_url)
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn soft_delete_product(&self, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE products SET is_active = 0 WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
