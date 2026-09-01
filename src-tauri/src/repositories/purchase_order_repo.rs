use crate::models::purchase_order::{PurchaseOrder, PurchaseOrderItem};
use crate::sync::payloads::{ExpenseSync, PurchaseItemSync, PurchaseOrderSync};
use crate::sync::queue::SyncQueue;
use sqlx::SqlitePool;

pub struct PurchaseOrderRepository {
    pool: SqlitePool,
}

impl PurchaseOrderRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub async fn create_order(
        &self,
        uuid: &str,
        store_id: i64,
        supplier_name: Option<&str>,
        batch_date: &str,
        alias: Option<&str>,
        total_cost: f64,
        created_by: i64,
    ) -> Result<PurchaseOrder, sqlx::Error> {
        let result = sqlx::query(
            "INSERT INTO purchase_orders (uuid, store_id, supplier_name, batch_date, alias, total_cost, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(uuid)
        .bind(store_id)
        .bind(supplier_name)
        .bind(batch_date)
        .bind(alias)
        .bind(total_cost)
        .bind(created_by)
        .execute(&self.pool)
        .await?;

        let id = result.last_insert_rowid();

        Ok(PurchaseOrder {
            id,
            uuid: uuid.to_string(),
            store_id,
            supplier_name: supplier_name.map(|s| s.to_string()),
            batch_date: batch_date.to_string(),
            alias: alias.map(|s| s.to_string()),
            total_cost,
            created_by: Some(created_by),
            created_at: None,
        })
    }

    pub async fn create_order_item(
        &self,
        purchase_order_id: i64,
        product_id: Option<i64>,
        product_name: &str,
        sku: Option<&str>,
        category_id: Option<i64>,
        quantity: i64,
        unit_cost: f64,
        unit_price: f64,
    ) -> Result<PurchaseOrderItem, sqlx::Error> {
        let result = sqlx::query(
            "INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, sku, category_id, quantity, unit_cost, unit_price)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(purchase_order_id)
        .bind(product_id)
        .bind(product_name)
        .bind(sku)
        .bind(category_id)
        .bind(quantity)
        .bind(unit_cost)
        .bind(unit_price)
        .execute(&self.pool)
        .await?;

        let id = result.last_insert_rowid();

        Ok(PurchaseOrderItem {
            id,
            purchase_order_id,
            product_id,
            product_name: product_name.to_string(),
            sku: sku.map(|s| s.to_string()),
            category_id,
            quantity,
            unit_cost,
            unit_price,
            created_at: None,
        })
    }

    pub async fn find_by_store(
        &self,
        store_id: i64,
    ) -> Result<Vec<PurchaseOrder>, sqlx::Error> {
        sqlx::query_as::<_, PurchaseOrder>(
            "SELECT * FROM purchase_orders WHERE store_id = ? ORDER BY created_at DESC",
        )
        .bind(store_id)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn find_by_id(
        &self,
        id: i64,
    ) -> Result<Option<PurchaseOrder>, sqlx::Error> {
        sqlx::query_as::<_, PurchaseOrder>("SELECT * FROM purchase_orders WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
    }

    pub async fn find_items_by_order(
        &self,
        purchase_order_id: i64,
    ) -> Result<Vec<PurchaseOrderItem>, sqlx::Error> {
        sqlx::query_as::<_, PurchaseOrderItem>(
            "SELECT * FROM purchase_order_items WHERE purchase_order_id = ?",
        )
        .bind(purchase_order_id)
        .fetch_all(&self.pool)
        .await
    }
}

/// Encola una compra en la outbox de sincronizacion. Se invoca en segundo plano
/// (despues de los inserts) para no bloquear la UI al crear el lote.
pub async fn enqueue_purchase_sync(
    pool: &SqlitePool,
    po: &PurchaseOrder,
    items: &[PurchaseOrderItem],
    generated_expense: Option<(String, String, f64, String, Option<String>, Option<String>)>,
) -> Result<(), sqlx::Error> {
    let created_by_username: Option<String> = match po.created_by {
        Some(uid) => sqlx::query_scalar("SELECT username FROM users WHERE id = ?")
            .bind(uid)
            .fetch_optional(pool)
            .await?
            .flatten(),
        None => None,
    };

    let po_created_at: String = sqlx::query_scalar("SELECT created_at FROM purchase_orders WHERE id = ?")
        .bind(po.id)
        .fetch_optional(pool)
        .await?
        .flatten()
        .unwrap_or_default();

    let generated_expense = match generated_expense {
        Some((uuid, description, amount, payment_method, category, supplier)) => {
            let exp_created_at: String =
                sqlx::query_scalar("SELECT created_at FROM expenses WHERE uuid = ?")
                    .bind(&uuid)
                    .fetch_optional(pool)
                    .await?
                    .flatten()
                    .unwrap_or_default();
            Some(ExpenseSync {
                sync_uuid: uuid,
                cash_session_uuid: None,
                source: "standalone".to_string(),
                description,
                amount,
                payment_method,
                category,
                supplier,
                created_at: exp_created_at,
            })
        }
        None => None,
    };

    let mut sync_items = Vec::with_capacity(items.len());
    for item in items {
        let product_code: Option<String> = match item.product_id {
            Some(pid) => sqlx::query_scalar("SELECT code FROM products WHERE id = ?")
                .bind(pid)
                .fetch_optional(pool)
                .await?
                .flatten(),
            None => None,
        };
        let category_name: Option<String> = match item.category_id {
            Some(cid) => sqlx::query_scalar("SELECT name FROM categories WHERE id = ?")
                .bind(cid)
                .fetch_optional(pool)
                .await?
                .flatten(),
            None => None,
        };
        sync_items.push(PurchaseItemSync {
            product_code,
            product_name: item.product_name.clone(),
            sku: item.sku.clone(),
            category_name,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            unit_price: item.unit_price,
        });
    }

    let payload = PurchaseOrderSync {
        sync_uuid: po.uuid.clone(),
        local_purchase_order_id: po.id,
        supplier_name: po.supplier_name.clone(),
        batch_date: po.batch_date.clone(),
        alias: po.alias.clone(),
        total_cost: po.total_cost,
        created_by_username,
        created_at: po_created_at,
        items: sync_items,
        generated_expense,
    };

    let queue = SyncQueue::new(pool.clone());
    queue
        .enqueue("purchases", &po.uuid, "purchase_order", &po.id.to_string(), &payload)
        .await
}
