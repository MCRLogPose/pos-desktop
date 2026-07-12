use crate::models::purchase_order::{PurchaseOrder, PurchaseOrderItem};
use sqlx::SqlitePool;

pub struct PurchaseOrderRepository {
    pool: SqlitePool,
}

impl PurchaseOrderRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
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
