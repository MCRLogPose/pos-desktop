use crate::models::sales::{
    AnulacionResult, CreateOrderItemPayload, CreateOrderPayload, CreateOrderPaymentPayload,
    ItemAnuladoExport, OrderItemExport, OrderPayment, PaymentMethodTotal, Sale, SaleDetail, SaleItem,
    VentaAnuladaExport,
};
use crate::sync::payloads::{ItemAnuladoSync, PaymentSync, SaleItemSync, SaleSync, VentaAnuladaSync};
use crate::sync::queue::SyncQueue;
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
        let order_uuid = uuid::Uuid::new_v4().to_string();

        // Si el payload no trae fracciones explicitas, deriva una sola con el total
        // en el metodo principal (compatibilidad con clientes antiguos).
        let payments = if payload.payments.is_empty() {
            vec![CreateOrderPaymentPayload {
                payment_method: payload.payment_method.clone(),
                amount: payload.total,
            }]
        } else {
            payload.payments.clone()
        };

        // Validar que las fracciones sumen el total (tolerancia de centimos).
        let sum_payments: f64 = payments.iter().map(|p| p.amount).sum();
        if (sum_payments - payload.total).abs() > 0.01 {
            return Err(sqlx::Error::Protocol(
                "la suma de los metodos de pago no coincide con el total de la venta".into(),
            ));
        }

        let order_id = sqlx::query(
            r#"
            INSERT INTO orders (uuid, user_id, client_document, client_phone, client_name, payment_method, subtotal, igv, total, cash_session_id, store_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
            "#,
        )
        .bind(&order_uuid)
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

        // 2. Registrar cada fraccion de pago y acumular en los esperados de caja.
        //    Solo las fracciones en 'cash' suman al esperado en efectivo; el resto
        //    (tarjeta/yape) suma al esperado virtual.
        let mut total_cash = 0.0f64;
        let mut total_virtual = 0.0f64;
        for payment in &payments {
            sqlx::query(
                r#"
                INSERT INTO order_payments (uuid, order_id, payment_method, amount)
                VALUES (?, ?, ?, ?)
                "#,
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(order_id)
            .bind(&payment.payment_method)
            .bind(payment.amount)
            .execute(&mut *tx)
            .await?;

            if payment.payment_method == "cash" {
                total_cash += payment.amount;
            } else {
                total_virtual += payment.amount;
            }
        }

        if payload.cash_session_id > 0 {
            sqlx::query("UPDATE cash_sessions SET expected_closing_cash = expected_closing_cash + ?, expected_closing_virtual = expected_closing_virtual + ? WHERE id = ?")
                .bind(total_cash)
                .bind(total_virtual)
                .bind(payload.cash_session_id)
                .execute(&mut *tx)
                .await?;
        }

        // 3. Insert each item and decrement stock
        // Asignacion por prenda: si el payload trae montos explicitos (ajuste
        // manual del cajero) se persisten tal cual; de lo contrario se calcula
        // waterfall/FIFO repartiendo el total proporcional al subtotal de cada
        // item (incluye la parte proporcional de IGV).
        let has_explicit = !payload.items.is_empty()
            && payload
                .items
                .iter()
                .all(|i| i.cash_amount + i.card_amount + i.yape_amount > 0.0);
        let allocations = if has_explicit {
            payload
                .items
                .iter()
                .map(|i| (i.cash_amount, i.card_amount, i.yape_amount))
                .collect::<Vec<_>>()
        } else {
            waterfall_allocations(&payload.items, &payments, payload.total)
        };

        for (i, item) in payload.items.iter().enumerate() {
            // Validate stock before decrementing
            let current_stock: i64 =
                sqlx::query_scalar("SELECT stock FROM products WHERE id = ? AND is_active = 1")
                    .bind(item.product_id)
                    .fetch_one(&mut *tx)
                    .await?;

            if current_stock < item.quantity {
                return Err(sqlx::Error::RowNotFound);
            }

            let (cash_amount, card_amount, yape_amount) = allocations[i];

            // Insert order item
            sqlx::query(
                r#"
                INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal, cash_amount, card_amount, yape_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(order_id)
            .bind(item.product_id)
            .bind(&item.product_name)
            .bind(item.unit_price)
            .bind(item.quantity)
            .bind(item.subtotal)
            .bind(cash_amount)
            .bind(card_amount)
            .bind(yape_amount)
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

        // Encolar en segundo plano (no bloquea la confirmacion de la venta).
        let pool = self.pool.clone();
        let mut payload_for_sync = payload.clone();
        payload_for_sync.payments = payments;
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_sale(&pool, &payload_for_sync, order_id, &order_uuid).await {
                log::warn!("[sync] no se pudo encolar la venta {order_id}: {e}");
            }
        });

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
                o.cash_session_id,
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
                o.cash_session_id,
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
                        oi.id,
                        oi.product_id,
                        oi.product_name,
                        p.display_name,
                        CAST(oi.unit_price AS REAL) AS unit_price,
                        oi.quantity,
                        CAST(oi.subtotal AS REAL) AS subtotal
                    FROM order_items oi
                    LEFT JOIN products p ON p.id = oi.product_id
                    WHERE oi.order_id = ?
                    ORDER BY oi.id ASC
                    "#,
                )
                .bind(sale_id)
                .fetch_all(&self.pool)
                .await?;

                let payments = sqlx::query_as::<_, OrderPayment>(
                    r#"
                    SELECT
                        id,
                        payment_method,
                        CAST(amount AS REAL) AS amount
                    FROM order_payments
                    WHERE order_id = ?
                    ORDER BY id ASC
                    "#,
                )
                .bind(sale_id)
                .fetch_all(&self.pool)
                .await?;

                Ok(Some(SaleDetail { sale: s, items, payments }))
            }
        }
    }

    /// Returns all order items joined with order info for the detailed items CSV export.
    /// Usa la asignacion de pagos persistida por item (waterfall o ajuste manual).
    /// Para ventas historicas sin persistencia (columnas en 0) recalcula waterfall.
    pub async fn get_all_order_items(&self, store_id: i64) -> Result<Vec<OrderItemExport>, sqlx::Error> {
        let mut items = sqlx::query_as::<_, OrderItemExport>(
            r#"
            SELECT
                o.id AS order_id,
                o.created_at,
                o.client_name,
                o.client_document,
                o.payment_method,
                oi.product_name,
                p.display_name,
                CAST(oi.unit_price AS REAL) AS unit_price,
                oi.quantity,
                CAST(oi.subtotal AS REAL) AS subtotal,
                o.store_id,
                CAST(oi.cash_amount AS REAL) AS cash_amount,
                CAST(oi.card_amount AS REAL) AS card_amount,
                CAST(oi.yape_amount AS REAL) AS yape_amount
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE o.store_id = ?
            ORDER BY o.created_at DESC, oi.id ASC
            "#,
        )
        .bind(store_id)
        .fetch_all(&self.pool)
        .await?;

        // Fracciones de pago por orden (en el orden en que el cajero las eligio: op.id ASC).
        #[derive(sqlx::FromRow)]
        struct PaymentRow {
            order_id: i64,
            payment_method: String,
            amount: f64,
        }
        let payments: Vec<PaymentRow> = sqlx::query_as::<_, PaymentRow>(
            r#"
            SELECT
                op.order_id,
                op.payment_method,
                CAST(op.amount AS REAL) AS amount
            FROM order_payments op
            INNER JOIN orders o ON o.id = op.order_id
            WHERE o.store_id = ?
            ORDER BY op.order_id ASC, op.id ASC
            "#,
        )
        .bind(store_id)
        .fetch_all(&self.pool)
        .await?;

        // Indexar factores de pago e items por orden conservando su orden de insercion.
        let mut pay_by_order: std::collections::HashMap<i64, Vec<(String, f64)>> =
            std::collections::HashMap::new();
        for p in payments {
            pay_by_order
                .entry(p.order_id)
                .or_default()
                .push((p.payment_method, p.amount));
        }
        let mut item_idx_by_order: std::collections::HashMap<i64, Vec<usize>> =
            std::collections::HashMap::new();
        for (i, item) in items.iter().enumerate() {
            item_idx_by_order.entry(item.order_id).or_default().push(i);
        }

        // Recalcular waterfall solo para ordenes sin persistencia (legacy).
        // Cada item absorbe su parte proporcional del total (subtotal * total/suma_subtotales)
        // de modo que la suma de las partes del reporte coincida con el total de la orden.
        let round2 = |n: f64| (n * 100.0).round() / 100.0;
        for (order_id, indices) in &item_idx_by_order {
            let Some(fractions) = pay_by_order.get(order_id) else {
                continue;
            };

            let stored_sum: f64 = indices
                .iter()
                .map(|&i| items[i].cash_amount + items[i].card_amount + items[i].yape_amount)
                .sum();
            if stored_sum > 0.001 {
                continue;
            }

            let subtotals_sum: f64 = indices.iter().map(|&i| items[i].subtotal).sum();
            let payments_total: f64 = fractions.iter().map(|(_, a)| a).sum();
            let ratio = if subtotals_sum > 0.0 {
                payments_total / subtotals_sum
            } else {
                1.0
            };

            let mut pi = 0usize;
            let mut consumed = 0.0f64;
            for &i in indices {
                let mut remaining = items[i].subtotal * ratio;
                while remaining > 0.001 {
                    let Some((method, amount)) = fractions.get(pi) else {
                        break;
                    };
                    let available = amount - consumed;
                    let take = available.min(remaining);
                    match method.as_str() {
                        "cash" => items[i].cash_amount += take,
                        "card" => items[i].card_amount += take,
                        "yape" => items[i].yape_amount += take,
                        _ => {}
                    }
                    consumed += take;
                    remaining -= take;
                    if amount - consumed <= 0.001 {
                        pi += 1;
                        consumed = 0.0;
                    }
                }
            }
        }

        for item in &mut items {
            item.cash_amount = round2(item.cash_amount);
            item.card_amount = round2(item.card_amount);
            item.yape_amount = round2(item.yape_amount);
        }

        Ok(items)
    }

    /// Totales por método de pago de las ventas de una sesión de caja.
    /// Las anulaciones borran la orden, así que solo quedan ventas vigentes.
    pub async fn get_session_payment_totals(
        &self,
        session_id: i64,
    ) -> Result<Vec<PaymentMethodTotal>, sqlx::Error> {
        sqlx::query_as::<_, PaymentMethodTotal>(
            r#"
            SELECT
                op.payment_method,
                CAST(SUM(op.amount) AS REAL) AS amount
            FROM order_payments op
            INNER JOIN orders o ON o.id = op.order_id
            WHERE o.cash_session_id = ?
            GROUP BY op.payment_method
            ORDER BY op.payment_method ASC
            "#,
        )
        .bind(session_id)
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
        active_cash_session_id: Option<i64>,
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

        // 3. La venta debe pertenecer a la sesion de caja activa (turno actual)
        if let Some(active_session_id) = active_cash_session_id {
            match order.cash_session_id {
                Some(session_id) if session_id != active_session_id => {
                    return Err(sqlx::Error::Protocol(
                        "esta venta pertenece a otro turno y no puede anularse desde aqui".into(),
                    ));
                }
                None => {
                    return Err(sqlx::Error::Protocol(
                        "esta venta no esta asociada a ninguna sesion de caja".into(),
                    ));
                }
                _ => {} // matches
            }
        }

        // 4. Permiso: ADMIN o el vendedor que creo la venta
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

        // 5. Cargar los items antes de borrarlos
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

        // 5b. Cargar las fracciones de pago antes de borrarlas.
        #[derive(sqlx::FromRow)]
        struct PaymentRow {
            payment_method: String,
            amount: f64,
        }

        let payments = sqlx::query_as::<_, PaymentRow>(
            r#"SELECT payment_method, CAST(amount AS REAL) AS amount
               FROM order_payments WHERE order_id = ? ORDER BY id ASC"#,
        )
        .bind(order.id)
        .fetch_all(&mut *tx)
        .await?;

        // Si no hay fracciones (ventas creadas antes de la tabla order_payments),
        // se deriva una sola con el metodo principal y el total.
        let payments = if payments.is_empty() {
            vec![PaymentRow {
                payment_method: order.payment_method.clone(),
                amount: order.total,
            }]
        } else {
            payments
        };

        // 6. Registrar la anulacion (cabecera)
        let venta_anulada_uuid = uuid::Uuid::new_v4().to_string();
        let venta_anulada_id = sqlx::query(
            r#"
            INSERT INTO ventas_anuladas (uuid, order_id, store_id, user_id, reason, payment_method, subtotal, igv, total, cancelled_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
            "#,
        )
        .bind(&venta_anulada_uuid)
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

        // 7. Registrar los items eliminados + revertir stock
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

        // 8. Revertir esperados de caja segun cada fraccion de pago
        if let Some(cash_session_id) = order.cash_session_id {
            let mut revert_cash = 0.0f64;
            let mut revert_virtual = 0.0f64;
            for payment in &payments {
                if payment.payment_method == "cash" {
                    revert_cash += payment.amount;
                } else {
                    revert_virtual += payment.amount;
                }
            }
            sqlx::query("UPDATE cash_sessions SET expected_closing_cash = expected_closing_cash - ?, expected_closing_virtual = expected_closing_virtual - ? WHERE id = ?")
                .bind(revert_cash)
                .bind(revert_virtual)
                .bind(cash_session_id)
                .execute(&mut *tx)
                .await?;
        }

        // 9. Borrar fracciones, items y la orden (FK CASCADE refuerza order_items)
        sqlx::query("DELETE FROM order_payments WHERE order_id = ?")
            .bind(order.id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM order_items WHERE order_id = ?")
            .bind(order.id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM orders WHERE id = ?")
            .bind(order.id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;

        // Encolar la anulacion en segundo plano (no bloquea la UI).
        let pool = self.pool.clone();
        let anulacion_uuid = venta_anulada_uuid.clone();
        let sync_anulacion_id = venta_anulada_id;
        let sync_order_id = order.id;
        let sync_seller = requester_user_id;
        let sync_reason = reason.clone();
        let sync_pm = order.payment_method.clone();
        let sync_subtotal = order.subtotal;
        let sync_igv = order.igv;
        let sync_total = order.total;
        let sync_payments: Vec<(String, f64)> = payments
            .iter()
            .map(|p| (p.payment_method.clone(), p.amount))
            .collect();
        let storage_items: Vec<(i64, String, f64, i64, f64)> = items
            .iter()
            .map(|it| {
                (
                    it.product_id,
                    it.product_name.clone(),
                    it.unit_price,
                    it.quantity,
                    it.subtotal,
                )
            })
            .collect();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_anulacion(
                &pool,
                sync_order_id,
                &sync_pm,
                sync_payments,
                sync_subtotal,
                sync_igv,
                sync_total,
                sync_seller,
                &anulacion_uuid,
                sync_anulacion_id,
                &sync_reason,
                storage_items,
            )
            .await
            {
                log::warn!("[sync] no se pudo encolar la anulacion {sync_anulacion_id}: {e}");
            }
        });

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
                p.display_name,
                CAST(ia.unit_price AS REAL) AS unit_price,
                ia.quantity,
                CAST(ia.subtotal AS REAL) AS subtotal,
                va.store_id
            FROM items_anulados ia
            INNER JOIN ventas_anuladas va ON va.id = ia.venta_anulada_id
            LEFT JOIN products p ON p.id = ia.product_id
            WHERE va.store_id = ?
            ORDER BY va.cancelled_at DESC, ia.id ASC
            "#,
        )
        .bind(store_id)
        .fetch_all(&self.pool)
        .await
    }
}

/// Distribuye las fracciones de pago sobre los items con rule waterfall/FIFO:
/// el primer metodo de pago cubre el primer item y el excedente fluye al
/// siguiente. Cada item absorbe una parte proporcional del total (subtotal *
/// total/suma_subtotales), de modo que la suma de las partes sea el total.
/// Devuelve (cash, card, yape) por item, redondeado a 2 decimales.
pub fn waterfall_allocations(
    items: &[CreateOrderItemPayload],
    payments: &[CreateOrderPaymentPayload],
    total: f64,
) -> Vec<(f64, f64, f64)> {
    let items_sum: f64 = items.iter().map(|i| i.subtotal).sum();
    let ratio = if items_sum > 0.0 { total / items_sum } else { 1.0 };

    let mut allocations = vec![(0.0f64, 0.0f64, 0.0f64); items.len()];
    let mut pi = 0usize;
    let mut consumed = 0.0f64;

    for (i, item) in items.iter().enumerate() {
        let mut remaining = item.subtotal * ratio;
        while remaining > 0.001 {
            let Some(p) = payments.get(pi) else { break };
            let available = p.amount - consumed;
            let take = available.min(remaining);
            match p.payment_method.as_str() {
                "cash" => allocations[i].0 += take,
                "card" => allocations[i].1 += take,
                "yape" => allocations[i].2 += take,
                _ => {}
            }
            consumed += take;
            remaining -= take;
            if p.amount - consumed <= 0.001 {
                pi += 1;
                consumed = 0.0;
            }
        }
    }

    for a in &mut allocations {
        a.0 = (a.0 * 100.0).round() / 100.0;
        a.1 = (a.1 * 100.0).round() / 100.0;
        a.2 = (a.2 * 100.0).round() / 100.0;
    }
    allocations
}

/// Encola una venta en la outbox de sincronizacion. Se invoca en segundo plano
/// (despues del commit) para no bloquear la confirmacion de la venta en la UI.
async fn enqueue_sale(
    pool: &SqlitePool,
    payload: &CreateOrderPayload,
    order_id: i64,
    order_uuid: &str,
) -> Result<(), sqlx::Error> {
    let created_at: String = sqlx::query_scalar("SELECT created_at FROM orders WHERE id = ?")
        .bind(order_id)
        .fetch_one(pool)
        .await?;

    let seller_username: Option<String> =
        sqlx::query_scalar("SELECT username FROM users WHERE id = ?")
            .bind(payload.user_id)
            .fetch_optional(pool)
            .await?;

    let cash_session_uuid: Option<String> =
        sqlx::query_scalar("SELECT uuid FROM cash_sessions WHERE id = ?")
            .bind(payload.cash_session_id)
            .fetch_optional(pool)
            .await?;

    let mut items = Vec::with_capacity(payload.items.len());
    for item in &payload.items {
        let product_code: Option<String> =
            sqlx::query_scalar("SELECT code FROM products WHERE id = ?")
                .bind(item.product_id)
                .fetch_optional(pool)
                .await?;
        let product_display_name: Option<String> =
            sqlx::query_scalar("SELECT display_name FROM products WHERE id = ?")
                .bind(item.product_id)
                .fetch_optional(pool)
                .await?;
        items.push(SaleItemSync {
            product_code,
            product_name: item.product_name.clone(),
            display_name: product_display_name,
            unit_price: item.unit_price,
            quantity: item.quantity,
            subtotal: item.subtotal,
            cash_amount: item.cash_amount,
            card_amount: item.card_amount,
            yape_amount: item.yape_amount,
        });
    }

    let sale_sync = SaleSync {
        sync_uuid: order_uuid.to_string(),
        local_order_id: order_id,
        seller_username,
        client_document: payload.client_document.clone(),
        client_phone: payload.client_phone.clone(),
        client_name: payload.client_name.clone(),
        payment_method: payload.payment_method.clone(),
        payments: payload
            .payments
            .iter()
            .map(|p| PaymentSync {
                payment_method: p.payment_method.clone(),
                amount: p.amount,
            })
            .collect(),
        subtotal: payload.subtotal,
        igv: payload.igv,
        total: payload.total,
        cash_session_uuid,
        created_at,
        items,
    };

    let queue = SyncQueue::new(pool.clone());
    queue
        .enqueue("sales", order_uuid, "order", &order_id.to_string(), &sale_sync)
        .await
}

/// Encola una anulacion en la outbox de sincronizacion. Se invoca en segundo
/// plano (despues del commit) para no bloquear la UI al anular una venta.
#[allow(clippy::too_many_arguments)]
async fn enqueue_anulacion(
    pool: &SqlitePool,
    order_id: i64,
    payment_method: &str,
    payments: Vec<(String, f64)>,
    subtotal: f64,
    igv: f64,
    total: f64,
    requester_user_id: i64,
    anulacion_uuid: &str,
    anulacion_id: i64,
    reason: &str,
    items: Vec<(i64, String, f64, i64, f64)>,
) -> Result<(), sqlx::Error> {
    let cancelled_at: String =
        sqlx::query_scalar("SELECT cancelled_at FROM ventas_anuladas WHERE id = ?")
            .bind(anulacion_id)
            .fetch_one(pool)
            .await?;

    let seller_username: Option<String> =
        sqlx::query_scalar("SELECT username FROM users WHERE id = ?")
            .bind(requester_user_id)
            .fetch_optional(pool)
            .await?;

    let mut sync_items = Vec::with_capacity(items.len());
    for (product_id, product_name, unit_price, quantity, item_subtotal) in items {
        let product_code: Option<String> =
            sqlx::query_scalar("SELECT code FROM products WHERE id = ?")
                .bind(product_id)
                .fetch_optional(pool)
                .await?;
        let product_display_name: Option<String> =
            sqlx::query_scalar("SELECT display_name FROM products WHERE id = ?")
                .bind(product_id)
                .fetch_optional(pool)
                .await?;
        sync_items.push(ItemAnuladoSync {
            product_code,
            product_name,
            display_name: product_display_name,
            unit_price,
            quantity,
            subtotal: item_subtotal,
        });
    }

    let anulacion_sync = VentaAnuladaSync {
        sync_uuid: anulacion_uuid.to_string(),
        local_anulacion_id: anulacion_id,
        order_id: Some(order_id),
        seller_username,
        reason: reason.to_string(),
        payment_method: payment_method.to_string(),
        payments: payments
            .into_iter()
            .map(|(pm, amount)| PaymentSync {
                payment_method: pm,
                amount,
            })
            .collect(),
        subtotal,
        igv,
        total,
        cancelled_at,
        items: sync_items,
    };

    let queue = SyncQueue::new(pool.clone());
    queue
        .enqueue(
            "anulaciones",
            anulacion_uuid,
            "venta_anulada",
            &anulacion_id.to_string(),
            &anulacion_sync,
        )
        .await
}
