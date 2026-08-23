use super::payloads::{
    CashBatch, CashSessionSync, CatalogBatch, CategorySync, ExpenseSync, InventoryBatch,
    OtherIncomeSync, ProductUpsertSync, PurchaseOrderSync, PurchasesBatch, SaleSync, SalesBatch,
    StockMovementSync, StoreSync, UserSync,
};
use super::SyncItemAck;
use sqlx::{Row, Sqlite, SqlitePool, Transaction};

type Tx = Transaction<'static, Sqlite>;

async fn claim_append_item(
    tx: &mut Tx,
    sync_uuid: &str,
    topic: &str,
    device_id: &str,
) -> Result<bool, String> {
    let res = sqlx::query(
        "INSERT OR IGNORE INTO sync_applied_items (sync_uuid, topic, device_id) VALUES (?1, ?2, ?3)",
    )
    .bind(sync_uuid)
    .bind(topic)
    .bind(device_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| format!("error de base de datos: {e}"))?;
    Ok(res.rows_affected() > 0)
}

async fn scalar_opt(tx: &mut Tx, sql: &str, key: &str) -> Option<i64> {
    let row = sqlx::query(sql)
        .bind(key)
        .fetch_optional(&mut **tx)
        .await
        .ok()?;
    let row = row?;
    row.try_get::<i64, _>(0).ok()
}

async fn last_insert_rowid(tx: &mut Tx) -> Option<i64> {
    sqlx::query_scalar("SELECT last_insert_rowid()")
        .fetch_one(&mut **tx)
        .await
        .ok()
}

pub async fn resolve_store_id_tx(tx: &mut Tx, store_code: Option<&str>) -> Option<i64> {
    match store_code {
        Some(code) => scalar_opt(tx, "SELECT id FROM stores WHERE code = ?1 LIMIT 1", code).await,
        None => {
            let row = sqlx::query("SELECT id FROM stores ORDER BY id LIMIT 1")
                .fetch_optional(&mut **tx)
                .await
                .ok()?;
            let row = row?;
            row.try_get::<i64, _>(0).ok()
        }
    }
}

async fn resolve_user_id(tx: &mut Tx, username: &str) -> Option<i64> {
    scalar_opt(tx, "SELECT id FROM users WHERE username = ?1", username).await
}

async fn resolve_cash_session_id(tx: &mut Tx, session_uuid: &str) -> Option<i64> {
    scalar_opt(
        tx,
        "SELECT id FROM cash_sessions WHERE uuid = ?1",
        session_uuid,
    )
    .await
}

async fn latest_session_for_store(tx: &mut Tx, store_id: i64) -> Option<i64> {
    let row = sqlx::query(
        "SELECT id FROM cash_sessions WHERE store_id = ?1 ORDER BY opened_at DESC, id DESC LIMIT 1",
    )
    .bind(store_id)
    .fetch_optional(&mut **tx)
    .await
    .ok()?;
    let row = row?;
    row.try_get::<i64, _>(0).ok()
}

async fn resolve_product_id(
    tx: &mut Tx,
    store_id: i64,
    code: Option<&str>,
    name: &str,
) -> Option<i64> {
    if let Some(c) = code {
        let found = sqlx::query("SELECT id FROM products WHERE store_id = ?1 AND code = ?2 LIMIT 1")
            .bind(store_id)
            .bind(c)
            .fetch_optional(&mut **tx)
            .await
            .ok()?
            .and_then(|row| row.try_get::<i64, _>(0).ok());
        if found.is_some() {
            return found;
        }
    }
    let row =
        sqlx::query("SELECT id FROM products WHERE store_id = ?1 AND name = ?2 LIMIT 1")
            .bind(store_id)
            .bind(name)
            .fetch_optional(&mut **tx)
            .await
            .ok()?;
    let row = row?;
    row.try_get::<i64, _>(0).ok()
}

async fn ensure_category_id(tx: &mut Tx, name: &str) -> Result<i64, String> {
    if let Some(id) = scalar_opt(tx, "SELECT id FROM categories WHERE name = ?1", name).await {
        return Ok(id);
    }
    sqlx::query("INSERT INTO categories (name) VALUES (?1)")
        .bind(name)
        .execute(&mut **tx)
        .await
        .map_err(|e| format!("no se pudo crear la categoria '{name}': {e}"))?;
    last_insert_rowid(tx)
        .await
        .ok_or_else(|| "no se pudo leer el id de la categoria".to_string())
}

async fn resolve_or_create_product_id(
    tx: &mut Tx,
    store_id: i64,
    code: Option<&str>,
    name: &str,
    price: f64,
    cost: f64,
) -> Result<i64, String> {
    if let Some(id) = resolve_product_id(tx, store_id, code, name).await {
        return Ok(id);
    }
    sqlx::query("INSERT INTO products (code, name, price, cost, stock, min_stock, unit, is_active, store_id, created_at) VALUES (?1, ?2, ?3, ?4, 0, 5, 'Unidades', 1, ?5, datetime('now','localtime'))")
        .bind(code)
        .bind(name)
        .bind(price)
        .bind(cost)
        .bind(store_id)
        .execute(&mut **tx)
        .await
        .map_err(|e| format!("no se pudo crear el producto '{name}': {e}"))?;
    last_insert_rowid(tx)
        .await
        .ok_or_else(|| "no se pudo leer el id del producto creado".to_string())
}

macro_rules! with_txn {
    ($pool:expr, $uuid:expr, |$tx:ident| $body:expr) => {{
        let uuid_str: String = $uuid.clone();
        match $pool.begin().await {
            Ok(mut transaction) => {
                let result = {
                    let $tx: &mut Tx = &mut transaction;
                    $body.await
                };
                match result {
                    Ok(ack) => match transaction.commit().await {
                        Ok(_) => ack,
                        Err(e) => SyncItemAck::rejected(uuid_str, format!("commit fallo: {e}")),
                    },
                    Err(msg) => SyncItemAck::rejected(uuid_str, msg),
                }
            }
            Err(e) => SyncItemAck::rejected(
                uuid_str,
                format!("no se pudo abrir transaccion: {e}"),
            ),
        }
    }};
}

pub async fn apply_sales_batch(
    pool: &SqlitePool,
    batch: &SalesBatch,
    device_id: &str,
    store_code: Option<&str>,
) -> Vec<SyncItemAck> {
    let mut acks = Vec::with_capacity(batch.sales.len());
    for sale in &batch.sales {
        let sc = store_code.map(str::to_string);
        let ack = with_txn!(pool, sale.sync_uuid, |tx| apply_one_sale(
            tx, sale, device_id, sc.as_deref()
        ));
        acks.push(ack);
    }
    acks
}

async fn apply_one_sale(
    tx: &mut Tx,
    sale: &SaleSync,
    device_id: &str,
    store_code: Option<&str>,
) -> Result<SyncItemAck, String> {
    if !claim_append_item(tx, &sale.sync_uuid, "sales", device_id).await? {
        return Ok(SyncItemAck::duplicate(sale.sync_uuid.clone()));
    }

    let store_id = resolve_store_id_tx(tx, store_code)
        .await
        .ok_or_else(|| format!("sede desconocida '{store_code:?}'"))?;

    let seller_username = sale
        .seller_username
        .as_deref()
        .ok_or("venta sin vendedor")?;
    let user_id = resolve_user_id(tx, seller_username)
        .await
        .ok_or_else(|| format!("vendedor desconocido '{seller_username}'"))?;

    let cash_session_id = match sale.cash_session_uuid.as_deref() {
        Some(u) => resolve_cash_session_id(tx, u).await,
        None => None,
    };

    sqlx::query("INSERT INTO orders (user_id, store_id, client_document, client_phone, client_name, payment_method, subtotal, igv, total, created_at, cash_session_id, uuid) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)")
        .bind(user_id)
        .bind(store_id)
        .bind(&sale.client_document)
        .bind(&sale.client_phone)
        .bind(&sale.client_name)
        .bind(&sale.payment_method)
        .bind(sale.subtotal)
        .bind(sale.igv)
        .bind(sale.total)
        .bind(&sale.created_at)
        .bind(cash_session_id)
        .bind(&sale.sync_uuid)
        .execute(&mut **tx)
        .await
        .map_err(|e| format!("no se pudo registrar la venta: {e}"))?;
    let order_id = last_insert_rowid(tx)
        .await
        .ok_or("no se pudo leer el id de la venta")?;

    for item in &sale.items {
        let product_id = resolve_or_create_product_id(
            tx,
            store_id,
            item.product_code.as_deref(),
            &item.product_name,
            item.unit_price,
            0.0,
        )
        .await?;
        sqlx::query("INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
            .bind(order_id)
            .bind(product_id)
            .bind(&item.product_name)
            .bind(item.unit_price)
            .bind(item.quantity)
            .bind(item.subtotal)
            .execute(&mut **tx)
            .await
            .map_err(|e| {
                format!(
                    "no se pudo registrar el item '{}': {e}",
                    item.product_name
                )
            })?;
    }

    Ok(SyncItemAck::accepted(&sale.sync_uuid, Some(order_id)))
}

pub async fn apply_inventory_batch(
    pool: &SqlitePool,
    batch: &InventoryBatch,
    device_id: &str,
    store_code: Option<&str>,
) -> Vec<SyncItemAck> {
    let mut acks = Vec::new();

    for cat in &batch.categories {
        let ack = with_txn!(pool, cat.sync_uuid, |tx| upsert_category(tx, cat));
        acks.push(ack);
    }

    for p in &batch.product_upserts {
        let sc = store_code.map(str::to_string);
        let ack = with_txn!(pool, p.sync_uuid, |tx| upsert_product(
            tx,
            p,
            sc.as_deref()
        ));
        acks.push(ack);
    }

    for m in &batch.stock_movements {
        let sc = store_code.map(str::to_string);
        let ack = with_txn!(pool, m.sync_uuid, |tx| apply_stock_movement(
            tx,
            m,
            device_id,
            sc.as_deref()
        ));
        acks.push(ack);
    }

    acks
}

async fn upsert_category(
    tx: &mut Tx,
    cat: &CategorySync,
) -> Result<SyncItemAck, String> {
    if let Some(existing) =
        scalar_opt(tx, "SELECT id FROM categories WHERE name = ?1", &cat.name).await
    {
        sqlx::query("UPDATE categories SET uuid = COALESCE(uuid, ?1) WHERE id = ?2")
            .bind(&cat.sync_uuid)
            .bind(existing)
            .execute(&mut **tx)
            .await
            .map_err(|e| format!("error actualizando categoria: {e}"))?;
        return Ok(SyncItemAck::accepted(&cat.sync_uuid, Some(existing)));
    }
    sqlx::query("INSERT INTO categories (name, uuid) VALUES (?1, ?2)")
        .bind(&cat.name)
        .bind(&cat.sync_uuid)
        .execute(&mut **tx)
        .await
        .map_err(|e| format!("no se pudo crear la categoria '{}': {e}", cat.name))?;
    let id = last_insert_rowid(tx).await.ok_or("sin id de categoria")?;
    Ok(SyncItemAck::accepted(&cat.sync_uuid, Some(id)))
}

async fn upsert_product(
    tx: &mut Tx,
    p: &ProductUpsertSync,
    store_code: Option<&str>,
) -> Result<SyncItemAck, String> {
    let store_id = resolve_store_id_tx(tx, store_code)
        .await
        .ok_or_else(|| format!("sede desconocida '{store_code:?}'"))?;

    let category_id = match p.category_name.as_deref() {
        Some(name) => Some(ensure_category_id(tx, name).await?),
        None => None,
    };

    let existing = match p.code.as_deref() {
        Some(code) => sqlx::query(
            "SELECT id FROM products WHERE store_id = ?1 AND code = ?2 LIMIT 1",
        )
        .bind(store_id)
        .bind(code)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|e| format!("error buscando producto: {e}"))?
        .and_then(|r| r.try_get::<i64, _>(0).ok()),
        None => None,
    };
    let existing = existing.or(resolve_product_id(tx, store_id, None, &p.name).await);

    if let Some(id) = existing {
        sqlx::query("UPDATE products SET name = ?1, category_id = ?2, price = ?3, cost = ?4, min_stock = ?5, unit = ?6, image_url = ?7, is_active = ?8, uuid = COALESCE(uuid, ?9) WHERE id = ?10")
            .bind(&p.name)
            .bind(category_id)
            .bind(p.price)
            .bind(p.cost)
            .bind(p.min_stock)
            .bind(&p.unit)
            .bind(&p.image_url)
            .bind(p.is_active)
            .bind(&p.sync_uuid)
            .bind(id)
            .execute(&mut **tx)
            .await
            .map_err(|e| format!("no se pudo actualizar el producto '{}': {e}", p.name))?;
        return Ok(SyncItemAck::accepted(&p.sync_uuid, Some(id)));
    }

    sqlx::query("INSERT INTO products (code, name, category_id, price, cost, stock, min_stock, unit, image_url, is_active, store_id, created_at, uuid) VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7, ?8, ?9, ?10, ?11, ?12)")
        .bind(&p.code)
        .bind(&p.name)
        .bind(category_id)
        .bind(p.price)
        .bind(p.cost)
        .bind(p.min_stock)
        .bind(&p.unit)
        .bind(&p.image_url)
        .bind(p.is_active)
        .bind(store_id)
        .bind(&p.occurred_at)
        .bind(&p.sync_uuid)
        .execute(&mut **tx)
        .await
        .map_err(|e| format!("no se pudo crear el producto '{}': {e}", p.name))?;

    let id = last_insert_rowid(tx).await.ok_or("sin id de producto")?;
    Ok(SyncItemAck::accepted(&p.sync_uuid, Some(id)))
}

async fn apply_stock_movement(
    tx: &mut Tx,
    m: &StockMovementSync,
    device_id: &str,
    store_code: Option<&str>,
) -> Result<SyncItemAck, String> {
    let store_id = resolve_store_id_tx(tx, store_code)
        .await
        .ok_or_else(|| format!("sede desconocida '{store_code:?}'"))?;

    if !claim_append_item(tx, &m.sync_uuid, "inventory", device_id).await? {
        return Ok(SyncItemAck::duplicate(m.sync_uuid.clone()));
    }

    let product_id = resolve_product_id(tx, store_id, m.product_code.as_deref(), &m.product_name)
        .await
        .ok_or_else(|| {
            format!(
                "producto desconocido '{}' en sede {store_code:?}",
                m.product_name
            )
        })?;

    sqlx::query("UPDATE products SET stock = stock + ?1 WHERE id = ?2")
        .bind(m.delta)
        .bind(product_id)
        .execute(&mut **tx)
        .await
        .map_err(|e| format!("no se pudo aplicar el movimiento de stock: {e}"))?;

    Ok(SyncItemAck::accepted(&m.sync_uuid, Some(product_id)))
}

pub async fn apply_purchases_batch(
    pool: &SqlitePool,
    batch: &PurchasesBatch,
    device_id: &str,
    store_code: Option<&str>,
) -> Vec<SyncItemAck> {
    let mut acks = Vec::with_capacity(batch.purchase_orders.len());
    for po in &batch.purchase_orders {
        let sc = store_code.map(str::to_string);
        let ack = with_txn!(pool, po.sync_uuid, |tx| apply_one_purchase(
            tx, po, device_id, sc.as_deref()
        ));
        acks.push(ack);
    }
    acks
}

async fn apply_one_purchase(
    tx: &mut Tx,
    po: &PurchaseOrderSync,
    device_id: &str,
    store_code: Option<&str>,
) -> Result<SyncItemAck, String> {
    if !claim_append_item(tx, &po.sync_uuid, "purchases", device_id).await? {
        return Ok(SyncItemAck::duplicate(po.sync_uuid.clone()));
    }

    let store_id = resolve_store_id_tx(tx, store_code)
        .await
        .ok_or_else(|| format!("sede desconocida '{store_code:?}'"))?;

    let created_by = match po.created_by_username.as_deref() {
        Some(u) => resolve_user_id(tx, u).await,
        None => None,
    };

    sqlx::query("INSERT INTO purchase_orders (uuid, store_id, supplier_name, batch_date, alias, total_cost, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
        .bind(&po.sync_uuid)
        .bind(store_id)
        .bind(&po.supplier_name)
        .bind(&po.batch_date)
        .bind(&po.alias)
        .bind(po.total_cost)
        .bind(created_by)
        .bind(&po.created_at)
        .execute(&mut **tx)
        .await
        .map_err(|e| format!("no se pudo registrar el lote: {e}"))?;
    let po_id = last_insert_rowid(tx).await.ok_or("sin id de lote")?;

    for item in &po.items {
        let product_id = match item.product_code.as_deref() {
            Some(_) => Some(
                resolve_or_create_product_id(
                    tx,
                    store_id,
                    item.product_code.as_deref(),
                    &item.product_name,
                    item.unit_price,
                    item.unit_cost,
                )
                .await?,
            ),
            None => None,
        };
        let category_id = match item.category_name.as_deref() {
            Some(name) => Some(ensure_category_id(tx, name).await?),
            None => None,
        };
        sqlx::query("INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, sku, category_id, quantity, unit_cost, unit_price, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)")
            .bind(po_id)
            .bind(product_id)
            .bind(&item.product_name)
            .bind(&item.sku)
            .bind(category_id)
            .bind(item.quantity)
            .bind(item.unit_cost)
            .bind(item.unit_price)
            .bind(&po.created_at)
            .execute(&mut **tx)
            .await
            .map_err(|e| {
                format!(
                    "no se pudo registrar el item del lote '{}': {e}",
                    item.product_name
                )
            })?;
    }

    if let Some(expense) = &po.generated_expense {
        insert_expense_if_new(tx, expense, store_id).await?;
    }

    Ok(SyncItemAck::accepted(&po.sync_uuid, Some(po_id)))
}

pub async fn apply_cash_batch(
    pool: &SqlitePool,
    batch: &CashBatch,
    device_id: &str,
    store_code: Option<&str>,
) -> Vec<SyncItemAck> {
    let mut acks = Vec::new();

    for s in &batch.sessions {
        let sc = store_code.map(str::to_string);
        let ack = with_txn!(pool, s.sync_uuid, |tx| apply_one_session(
            tx, s, device_id, sc.as_deref()
        ));
        acks.push(ack);
    }

    for e in &batch.expenses {
        let sc = store_code.map(str::to_string);
        let ack = with_txn!(pool, e.sync_uuid, |tx| apply_one_expense(
            tx, e, device_id, sc.as_deref()
        ));
        acks.push(ack);
    }

    for i in &batch.incomes {
        let sc = store_code.map(str::to_string);
        let ack = with_txn!(pool, i.sync_uuid, |tx| apply_one_income(
            tx, i, device_id, sc.as_deref()
        ));
        acks.push(ack);
    }

    acks
}

async fn apply_one_session(
    tx: &mut Tx,
    s: &CashSessionSync,
    device_id: &str,
    store_code: Option<&str>,
) -> Result<SyncItemAck, String> {
    if !claim_append_item(tx, &s.sync_uuid, "cash", device_id).await? {
        return Ok(SyncItemAck::duplicate(s.sync_uuid.clone()));
    }

    let store_id = resolve_store_id_tx(tx, store_code)
        .await
        .ok_or_else(|| format!("sede desconocida '{store_code:?}'"))?;

    let fallback_admin = s.opened_by_username.is_none();
    let opened_by = s.opened_by_username.as_deref().unwrap_or("admin");
    let opened_by_id = resolve_user_id(tx, opened_by)
        .await
        .ok_or_else(|| format!("usuario de apertura desconocido '{opened_by}'"))?;
    let closed_by = match s.closed_by_username.as_deref() {
        Some(u) => resolve_user_id(tx, u).await,
        None => None,
    };

    sqlx::query("INSERT INTO cash_sessions (uuid, store_id, opened_by, opened_at, closed_by, closed_at, opening_cash, opening_virtual, expected_closing_cash, expected_closing_virtual, real_closing_cash, real_closing_virtual, difference, justification, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)")
        .bind(&s.sync_uuid)
        .bind(store_id)
        .bind(opened_by_id)
        .bind(&s.opened_at)
        .bind(closed_by)
        .bind(&s.closed_at)
        .bind(s.opening_cash)
        .bind(s.opening_virtual)
        .bind(s.expected_closing_cash)
        .bind(s.expected_closing_virtual)
        .bind(s.real_closing_cash)
        .bind(s.real_closing_virtual)
        .bind(s.difference)
        .bind(&s.justification)
        .bind(&s.status)
        .execute(&mut **tx)
        .await
        .map_err(|e| format!("no se pudo registrar la sesion de caja: {e}"))?;

    let id = last_insert_rowid(tx).await.ok_or("sin id de sesion")?;
    let mut ack = SyncItemAck::accepted(&s.sync_uuid, Some(id));
    if fallback_admin {
        ack.message = Some("sin usuario de apertura; se asigno a 'admin'".to_string());
    }
    Ok(ack)
}

async fn apply_one_expense(
    tx: &mut Tx,
    e: &ExpenseSync,
    device_id: &str,
    store_code: Option<&str>,
) -> Result<SyncItemAck, String> {
    if !claim_append_item(tx, &e.sync_uuid, "cash", device_id).await? {
        return Ok(SyncItemAck::duplicate(e.sync_uuid.clone()));
    }

    let store_id = resolve_store_id_tx(tx, store_code)
        .await
        .ok_or_else(|| format!("sede desconocida '{store_code:?}'"))?;

    insert_expense_if_new(tx, e, store_id).await?;
    Ok(SyncItemAck::accepted(&e.sync_uuid, None))
}

async fn insert_expense_if_new(
    tx: &mut Tx,
    e: &ExpenseSync,
    store_id: i64,
) -> Result<(), String> {
    let already = sqlx::query("SELECT id FROM expenses WHERE uuid = ?1")
        .bind(&e.sync_uuid)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|er| format!("error buscando gasto: {er}"))?
        .is_some();
    if already {
        return Ok(());
    }

    let cash_session_id = match e.cash_session_uuid.as_deref() {
        Some(u) => resolve_cash_session_id(tx, u).await,
        None => None,
    };
    let category = e.category.clone().unwrap_or_else(|| "General".to_string());

    sqlx::query("INSERT INTO expenses (uuid, cash_session_id, description, amount, payment_method, category, supplier, store_id, created_at, source) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)")
        .bind(&e.sync_uuid)
        .bind(cash_session_id)
        .bind(&e.description)
        .bind(e.amount)
        .bind(&e.payment_method)
        .bind(category)
        .bind(&e.supplier)
        .bind(store_id)
        .bind(&e.created_at)
        .bind(&e.source)
        .execute(&mut **tx)
        .await
        .map_err(|er| format!("no se pudo registrar el gasto: {er}"))?;
    Ok(())
}

async fn apply_one_income(
    tx: &mut Tx,
    i: &OtherIncomeSync,
    device_id: &str,
    store_code: Option<&str>,
) -> Result<SyncItemAck, String> {
    if !claim_append_item(tx, &i.sync_uuid, "cash", device_id).await? {
        return Ok(SyncItemAck::duplicate(i.sync_uuid.clone()));
    }

    let store_id = resolve_store_id_tx(tx, store_code)
        .await
        .ok_or_else(|| format!("sede desconocida '{store_code:?}'"))?;

    let by_uuid = match i.cash_session_uuid.as_deref() {
        Some(u) => resolve_cash_session_id(tx, u).await,
        None => None,
    };
    let session_id = match by_uuid {
        Some(id) => Some(id),
        None => latest_session_for_store(tx, store_id).await,
    }
    .ok_or("ingreso sin sesion de caja asociada y sin sesiones previas")?;

    sqlx::query("INSERT INTO other_income (uuid, cash_session_id, description, amount, payment_method, created_at, store_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
        .bind(&i.sync_uuid)
        .bind(session_id)
        .bind(&i.description)
        .bind(i.amount)
        .bind(&i.payment_method)
        .bind(&i.created_at)
        .bind(store_id)
        .execute(&mut **tx)
        .await
        .map_err(|e| format!("no se pudo registrar el ingreso: {e}"))?;

    let id = last_insert_rowid(tx).await.ok_or("sin id de ingreso")?;
    Ok(SyncItemAck::accepted(&i.sync_uuid, Some(id)))
}

pub async fn apply_catalog_batch(
    pool: &SqlitePool,
    batch: &CatalogBatch,
    _device_id: &str,
    _store_code: Option<&str>,
) -> Vec<SyncItemAck> {
    let mut acks = Vec::new();

    for st in &batch.stores {
        let ack = with_txn!(pool, st.sync_uuid, |tx| upsert_store(tx, st));
        acks.push(ack);
    }

    for u in &batch.users {
        let ack = with_txn!(pool, u.sync_uuid, |tx| upsert_user(tx, u));
        acks.push(ack);
    }

    acks
}

async fn upsert_store(tx: &mut Tx, s: &StoreSync) -> Result<SyncItemAck, String> {
    let existing = match s.code.as_deref() {
        Some(code) => sqlx::query("SELECT id FROM stores WHERE code = ?1")
            .bind(code)
            .fetch_optional(&mut **tx)
            .await
            .map_err(|e| format!("error buscando sede: {e}"))?,
        None => sqlx::query("SELECT id FROM stores WHERE name = ?1")
            .bind(&s.name)
            .fetch_optional(&mut **tx)
            .await
            .map_err(|e| format!("error buscando sede: {e}"))?,
    };

    if let Some(row) = existing {
        let id = row.try_get::<i64, _>(0).map_err(|e| e.to_string())?;
        sqlx::query("UPDATE stores SET name = ?1, address = ?2, is_active = ?3, uuid = COALESCE(uuid, ?4) WHERE id = ?5")
            .bind(&s.name)
            .bind(&s.address)
            .bind(s.is_active)
            .bind(&s.sync_uuid)
            .bind(id)
            .execute(&mut **tx)
            .await
            .map_err(|e| format!("no se pudo actualizar la sede: {e}"))?;
        return Ok(SyncItemAck::accepted(&s.sync_uuid, Some(id)));
    }

    sqlx::query("INSERT INTO stores (code, name, address, is_active, created_at, uuid) VALUES (?1, ?2, ?3, ?4, COALESCE(?5, datetime('now','localtime')), ?6)")
        .bind(&s.code)
        .bind(&s.name)
        .bind(&s.address)
        .bind(s.is_active)
        .bind(&s.created_at)
        .bind(&s.sync_uuid)
        .execute(&mut **tx)
        .await
        .map_err(|e| format!("no se pudo crear la sede '{}': {e}", s.name))?;
    let id = last_insert_rowid(tx).await.ok_or("sin id de sede")?;
    Ok(SyncItemAck::accepted(&s.sync_uuid, Some(id)))
}

async fn upsert_user(tx: &mut Tx, u: &UserSync) -> Result<SyncItemAck, String> {
    let store_id = match u.store_code.as_deref() {
        Some(code) => scalar_opt(tx, "SELECT id FROM stores WHERE code = ?1", code).await,
        None => None,
    };

    let existing =
        scalar_opt(tx, "SELECT id FROM users WHERE username = ?1", &u.username).await;

    if let Some(id) = existing {
        sqlx::query("UPDATE users SET password_hash = ?1, cargo = ?2, email = ?3, store_id = ?4, is_active = ?5, uuid = COALESCE(uuid, ?6) WHERE id = ?7")
            .bind(&u.password_hash)
            .bind(&u.cargo)
            .bind(&u.email)
            .bind(store_id)
            .bind(u.is_active)
            .bind(&u.sync_uuid)
            .bind(id)
            .execute(&mut **tx)
            .await
            .map_err(|e| format!("no se pudo actualizar el usuario '{}': {e}", u.username))?;
        return Ok(SyncItemAck::accepted(&u.sync_uuid, Some(id)));
    }

    sqlx::query("INSERT INTO users (username, password_hash, cargo, email, store_id, is_active, created_at, uuid) VALUES (?1, ?2, ?3, ?4, ?5, ?6, COALESCE(?7, datetime('now','localtime')), ?8)")
        .bind(&u.username)
        .bind(&u.password_hash)
        .bind(&u.cargo)
        .bind(&u.email)
        .bind(store_id)
        .bind(u.is_active)
        .bind(&u.created_at)
        .bind(&u.sync_uuid)
        .execute(&mut **tx)
        .await
        .map_err(|e| format!("no se pudo crear el usuario '{}': {e}", u.username))?;
    let id = last_insert_rowid(tx).await.ok_or("sin id de usuario")?;
    Ok(SyncItemAck::accepted(&u.sync_uuid, Some(id)))
}


