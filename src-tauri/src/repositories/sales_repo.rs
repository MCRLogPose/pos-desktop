use crate::models::sales::{CreateOrderPayload, OrderItemExport, Sale, SaleDetail, SaleItem};
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
            INSERT INTO orders (user_id, client_document, client_phone, client_name, payment_method, subtotal, igv, total, cash_session_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        .bind(payload.cash_session_id)
        .execute(&mut *tx)
        .await?
        .last_insert_rowid();

        // 3. Update cash session balance
        if payload.payment_method == "cash" {
            sqlx::query("UPDATE cash_sessions SET expected_closing_cash = expected_closing_cash + ? WHERE id = ?")
                .bind(payload.total)
                .bind(payload.cash_session_id)
                .execute(&mut *tx)
                .await?;
        } else {
            sqlx::query("UPDATE cash_sessions SET expected_closing_virtual = expected_closing_virtual + ? WHERE id = ?")
                .bind(payload.total)
                .bind(payload.cash_session_id)
                .execute(&mut *tx)
                .await?;
        }

        // 2. Insert each item and decrement stock
        for item in &payload.items {
            // Validate stock before decrementing
            let current_stock: i64 =
                sqlx::query_scalar("SELECT stock FROM products WHERE id = ? AND is_active = 1")
                    .bind(item.product_id)
                    .fetch_one(&mut *tx)
                    .await?;

            if current_stock < item.quantity {
                return Err(sqlx::Error::RowNotFound);
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

    /// Returns all sales ordered by date descending, joining with users for the seller name.
    pub async fn get_sales(&self) -> Result<Vec<Sale>, sqlx::Error> {
        sqlx::query_as::<_, Sale>(
            r#"
            SELECT
                o.id,
                o.user_id,
                u.username AS user_name,
                o.client_document,
                o.client_phone,
                o.client_name,
                o.payment_method,
                CAST(o.subtotal AS REAL) AS subtotal,
                CAST(o.igv AS REAL) AS igv,
                CAST(o.total AS REAL) AS total,
                o.created_at
            FROM orders o
            LEFT JOIN users u ON u.id = o.user_id
            ORDER BY o.created_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await
    }

    /// Returns a single sale with its items.
    pub async fn get_sale_detail(&self, sale_id: i64) -> Result<Option<SaleDetail>, sqlx::Error> {
        let sale = sqlx::query_as::<_, Sale>(
            r#"
            SELECT
                o.id,
                o.user_id,
                u.username AS user_name,
                o.client_document,
                o.client_phone,
                o.client_name,
                o.payment_method,
                CAST(o.subtotal AS REAL) AS subtotal,
                CAST(o.igv AS REAL) AS igv,
                CAST(o.total AS REAL) AS total,
                o.created_at
            FROM orders o
            LEFT JOIN users u ON u.id = o.user_id
            WHERE o.id = ?
            "#,
        )
        .bind(sale_id)
        .fetch_optional(&self.pool)
        .await?;

        match sale {
            None => Ok(None),
            Some(s) => {
                let items = sqlx::query_as::<_, SaleItem>(
                    r#"
                    SELECT
                        id,
                        product_id,
                        product_name,
                        CAST(unit_price AS REAL) AS unit_price,
                        quantity,
                        CAST(subtotal AS REAL) AS subtotal
                    FROM order_items
                    WHERE order_id = ?
                    ORDER BY id ASC
                    "#,
                )
                .bind(sale_id)
                .fetch_all(&self.pool)
                .await?;

                Ok(Some(SaleDetail { sale: s, items }))
            }
        }
    }

    /// Returns all order items joined with order info for the detailed items CSV export.
    pub async fn get_all_order_items(&self) -> Result<Vec<OrderItemExport>, sqlx::Error> {
        sqlx::query_as::<_, OrderItemExport>(
            r#"
            SELECT
                o.id AS order_id,
                o.created_at,
                o.client_name,
                o.client_document,
                o.payment_method,
                oi.product_name,
                CAST(oi.unit_price AS REAL) AS unit_price,
                oi.quantity,
                CAST(oi.subtotal AS REAL) AS subtotal
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            ORDER BY o.created_at DESC, oi.id ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await
    }
}
