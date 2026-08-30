use crate::models::sales::{
    AnulacionResult, CreateOrderPayload, ItemAnuladoExport, OrderItemExport, Sale, SaleDetail,
    SaleItem, VentaAnuladaExport,
};
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

        // 1. Insert the order header (hora local Peru, CURRENT_TIMESTAMP guardaria UTC)
        let order_id = sqlx::query(
            r#"
            INSERT INTO orders (user_id, client_document, client_phone, client_name, payment_method, subtotal, igv, total, cash_session_id, store_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
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
        .bind(payload.store_id)
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
    pub async fn get_sales(&self, store_id: i64) -> Result<Vec<Sale>, sqlx::Error> {
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
                o.store_id,
                o.created_at
            FROM orders o
            LEFT JOIN users u ON u.id = o.user_id
            WHERE o.store_id = ?
            ORDER BY o.created_at DESC
            "#,
        )
        .bind(store_id)
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
                o.store_id,
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
    pub async fn get_all_order_items(&self, store_id: i64) -> Result<Vec<OrderItemExport>, sqlx::Error> {
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
                CAST(oi.subtotal AS REAL) AS subtotal,
                o.store_id
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            WHERE o.store_id = ?
            ORDER BY o.created_at DESC, oi.id ASC
            "#,
        )
        .bind(store_id)
        .fetch_all(&self.pool)
        .await
    }

    /// Anula una venta de forma fisica (borra order_items + orders) y registra
    /// la justificacion en ventas_anuladas + items_anulados para auditoria y sync.
    ///
    /// Reglas:
    /// - La venta no debe haber sido sincronizada a la Primary (orders.synced = 0).
    /// - Solo el vendedor que la creo o un usuario ADMIN puede anularla.
    /// - Revierte el stock de cada producto y los esperados de caja asociados.
    ///
    /// Todo ocurre en una sola transaccion.
    pub async fn anular_venta(
        &self,
        sale_id: i64,
        requester_user_id: i64,
        reason: String,
    ) -> Result<AnulacionResult, sqlx::Error> {
        if reason.trim().is_empty() {
            return Err(sqlx::Error::Protocol(
                "la justificacion es obligatoria para anular una venta".into(),
            ));
        }

        let mut tx = self.pool.begin().await?;

        // 1. Cargar la venta a anular
        #[derive(sqlx::FromRow)]
        struct OrderRow {
            id: i64,
            user_id: i64,
            store_id: i64,
            payment_method: String,
            subtotal: f64,
            igv: f64,
            total: f64,
            cash_session_id: Option<i64>,
            synced: bool,
        }

        let order = sqlx::query_as::<_, OrderRow>(
            r#"
            SELECT id, user_id, store_id, payment_method, subtotal, igv, total, cash_session_id, synced
            FROM orders WHERE id = ?
            "#,
        )
        .bind(sale_id)
        .fetch_optional(&mut *tx)
        .await?;

        let order = match order {
            Some(o) => o,
            None => return Err(sqlx::Error::RowNotFound),
        };

        // 2. La venta ya sincronizada no puede eliminarse localmente
        if order.synced {
            return Err(sqlx::Error::Protocol(
                "esta venta ya fue sincronizada a la Primary y no puede eliminarse localmente".into(),
            ));
        }

        // 3. Permiso: ADMIN o el vendedor que creo la venta
        let requester_cargo: Option<String> = sqlx::query_scalar(
            "SELECT cargo FROM users WHERE id = ?",
        )
        .bind(requester_user_id)
        .fetch_optional(&mut *tx)
        .await?;

        let is_admin = requester_cargo
            .as_deref()
            .map(|c| c.eq_ignore_ascii_case("ADMIN"))
            .unwrap_or(false);

        if !is_admin && requester_user_id != order.user_id {
            return Err(sqlx::Error::Protocol(
                "solo el vendedor que creó la venta o un ADMIN puede anularla".into(),
            ));
        }

        // 4. Cargar los items antes de borrarlos
        #[derive(sqlx::FromRow)]
        struct ItemRow {
            product_id: i64,
            product_name: String,
            unit_price: f64,
            quantity: i64,
            subtotal: f64,
        }

        let items = sqlx::query_as::<_, ItemRow>(
            r#"SELECT product_id, product_name, unit_price, quantity, subtotal
               FROM order_items WHERE order_id = ? ORDER BY id ASC"#,
        )
        .bind(order.id)
        .fetch_all(&mut *tx)
        .await?;

        // 5. Registrar la anulacion (cabecera)
        let venta_anulada_id = sqlx::query(
            r#"
            INSERT INTO ventas_anuladas (uuid, order_id, store_id, user_id, reason, payment_method, subtotal, igv, total, cancelled_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
            "#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(order.id)
        .bind(order.store_id)
        .bind(requester_user_id)
        .bind(&reason)
        .bind(&order.payment_method)
        .bind(order.subtotal)
        .bind(order.igv)
        .bind(order.total)
        .execute(&mut *tx)
        .await?
        .last_insert_rowid();

        // 6. Registrar los items eliminados + revertir stock
        for item in &items {
            sqlx::query(
                r#"
                INSERT INTO items_anulados (uuid, venta_anulada_id, product_id, product_name, unit_price, quantity, subtotal)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(venta_anulada_id)
            .bind(item.product_id)
            .bind(&item.product_name)
            .bind(item.unit_price)
            .bind(item.quantity)
            .bind(item.subtotal)
            .execute(&mut *tx)
            .await?;

            // Devolver stock al inventario
            sqlx::query("UPDATE products SET stock = stock + ? WHERE id = ?")
                .bind(item.quantity)
                .bind(item.product_id)
                .execute(&mut *tx)
                .await?;
        }

        // 7. Revertir esperados de caja si la venta estaba asociada a una sesion
        if let Some(cash_session_id) = order.cash_session_id {
            let col = if order.payment_method == "cash" {
                "expected_closing_cash"
            } else {
                "expected_closing_virtual"
            };
            sqlx::query(&format!(
                "UPDATE cash_sessions SET {col} = {col} - ? WHERE id = ?"
            ))
            .bind(order.total)
            .bind(cash_session_id)
            .execute(&mut *tx)
            .await?;
        }

        // 8. Borrar items y la orden (FK CASCADE refuerza order_items)
        sqlx::query("DELETE FROM order_items WHERE order_id = ?")
            .bind(order.id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM orders WHERE id = ?")
            .bind(order.id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(AnulacionResult {
            id: venta_anulada_id,
            total_anulado: order.total,
            items_count: items.len(),
        })
    }

    /// Devuelve el listado de ventas anuladas (cabecera + usuario que anulo),
    /// ordenado de mas reciente a mas antigua.
    pub async fn get_anulaciones(
        &self,
        store_id: i64,
    ) -> Result<Vec<VentaAnuladaExport>, sqlx::Error> {
        sqlx::query_as::<_, VentaAnuladaExport>(
            r#"
            SELECT
                va.id,
                va.order_id,
                va.store_id,
                va.reason,
                va.payment_method,
                CAST(va.subtotal AS REAL) AS subtotal,
                CAST(va.igv AS REAL) AS igv,
                CAST(va.total AS REAL) AS total,
                u.username AS cancelled_by,
                va.cancelled_at
            FROM ventas_anuladas va
            LEFT JOIN users u ON u.id = va.user_id
            WHERE va.store_id = ?
            ORDER BY va.cancelled_at DESC, va.id DESC
            "#,
        )
        .bind(store_id)
        .fetch_all(&self.pool)
        .await
    }

    /// Devuelve todos los items anulados junto a la cabecera de su anulacion,
    /// para el detalle y la exportacion CSV.
    pub async fn get_all_items_anulados(
        &self,
        store_id: i64,
    ) -> Result<Vec<ItemAnuladoExport>, sqlx::Error> {
        sqlx::query_as::<_, ItemAnuladoExport>(
            r#"
            SELECT
                va.id AS anulacion_id,
                va.cancelled_at,
                va.reason,
                ia.product_name,
                CAST(ia.unit_price AS REAL) AS unit_price,
                ia.quantity,
                CAST(ia.subtotal AS REAL) AS subtotal,
                va.store_id
            FROM items_anulados ia
            INNER JOIN ventas_anuladas va ON va.id = ia.venta_anulada_id
            WHERE va.store_id = ?
            ORDER BY va.cancelled_at DESC, ia.id ASC
            "#,
        )
        .bind(store_id)
        .fetch_all(&self.pool)
        .await
    }
}
