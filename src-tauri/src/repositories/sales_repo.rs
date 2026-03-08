use crate::models::sales::CreateOrderPayload;
use sqlx::SqlitePool;

pub struct SalesRepository {
    pool: SqlitePool,
}

impl SalesRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Creates an order + items and decrements stock for each product,
    /// all inside a single SQLite transaction.
    pub async fn create_order(&self, payload: CreateOrderPayload) -> Result<i64, sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        // 1. Insert the order header
        let order_id = sqlx::query(
            r#"
            INSERT INTO orders (user_id, client_document, payment_method, subtotal, igv, total)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(payload.user_id)
        .bind(&payload.client_document)
        .bind(&payload.client_phone)
        .bind(&payload.client_name)
        .bind(&payload.payment_method)
        .bind(payload.subtotal)
        .bind(payload.igv)
        .bind(payload.total)
        .execute(&mut *tx)
        .await?
        .last_insert_rowid();

        // 2. Insert each item and decrement stock
        for item in &payload.items {
            // Validate stock before decrementing
            let current_stock: i64 = sqlx::query_scalar(
                "SELECT stock FROM products WHERE id = ? AND is_active = 1",
            )
            .bind(item.product_id)
            .fetch_one(&mut *tx)
            .await?;

            if current_stock < item.quantity {
                return Err(sqlx::Error::RowNotFound); // Will be mapped to a descriptive error in service
            }

            // Insert order item
            sqlx::query(
                r#"
                INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
                VALUES (?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(order_id)
            .bind(item.product_id)
            .bind(&item.product_name)
            .bind(item.unit_price)
            .bind(item.quantity)
            .bind(item.subtotal)
            .execute(&mut *tx)
            .await?;

            // Decrement stock
            sqlx::query("UPDATE products SET stock = stock - ? WHERE id = ?")
                .bind(item.quantity)
                .bind(item.product_id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;
        Ok(order_id)
    }
}
