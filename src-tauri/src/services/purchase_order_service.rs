use crate::models::purchase_order::{
    CreatePurchaseOrderPayload, PurchaseOrder, PurchaseOrderWithItems,
};
use crate::repositories::cash_repo::CashRepository;
use crate::repositories::inventory_repo::InventoryRepository;
use crate::repositories::purchase_order_repo::PurchaseOrderRepository;
use sqlx::SqlitePool;
use uuid::Uuid;

pub struct PurchaseOrderService {
    pub purchase_order_repo: PurchaseOrderRepository,
    pub inventory_repo: InventoryRepository,
    pub cash_repo: CashRepository,
}

impl PurchaseOrderService {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            purchase_order_repo: PurchaseOrderRepository::new(pool.clone()),
            inventory_repo: InventoryRepository::new(pool.clone()),
            cash_repo: CashRepository::new(pool),
        }
    }

    pub async fn create_purchase_order(
        &self,
        payload: CreatePurchaseOrderPayload,
    ) -> Result<PurchaseOrderWithItems, String> {
        let order_uuid = Uuid::new_v4().to_string();

        // Calculate total cost
        let total_cost: f64 = payload
            .items
            .iter()
            .map(|item| item.unit_cost * item.quantity as f64)
            .sum();

        // Create the purchase order
        let order = self
            .purchase_order_repo
            .create_order(
                &order_uuid,
                payload.store_id,
                payload.supplier_name.as_deref(),
                &payload.batch_date,
                payload.alias.as_deref(),
                total_cost,
                payload.created_by,
            )
            .await
            .map_err(|e| e.to_string())?;

        let mut created_items = Vec::new();

        for item in &payload.items {
            // Try to find existing product by SKU
            let existing_product = if let Some(ref sku) = item.sku {
                self.inventory_repo
                    .find_by_code(sku, payload.store_id)
                    .await
                    .map_err(|e| e.to_string())?
            } else {
                None
            };

            let product_id = if let Some(product) = existing_product {
                // Update existing product: sum stock, update prices
                self.inventory_repo
                    .update_product(
                        product.id,
                        item.sku.as_deref(),
                        &item.product_name,
                        item.category_id,
                        item.unit_price,
                        item.unit_cost,
                        product.stock + item.quantity,
                        None,
                        item.image_url.as_deref(),
                        payload.store_id,
                    )
                    .await
                    .map_err(|e| e.to_string())?;
                Some(product.id)
            } else {
                // Create new product
                let new_id = self
                    .inventory_repo
                    .create_product(
                        item.sku.as_deref(),
                        &item.product_name,
                        item.category_id,
                        item.unit_price,
                        item.unit_cost,
                        item.quantity,
                        None,
                        item.image_url.as_deref(),
                        payload.store_id,
                    )
                    .await
                    .map_err(|e| e.to_string())?;
                Some(new_id)
            };

            // Create purchase order item
            let po_item = self
                .purchase_order_repo
                .create_order_item(
                    order.id,
                    product_id,
                    &item.product_name,
                    item.sku.as_deref(),
                    item.category_id,
                    item.quantity,
                    item.unit_cost,
                    item.unit_price,
                )
                .await
                .map_err(|e| e.to_string())?;

            created_items.push(po_item);
        }

        // Auto-create expense for this purchase order
        let expense_uuid = Uuid::new_v4().to_string();
        self.cash_repo
            .add_expense_standalone(
                payload.alias.clone().unwrap_or_else(|| format!("Lote #{}", order.id)),
                total_cost,
                payload.payment_method.clone(),
                Some("Mercadería".to_string()),
                payload.supplier_name.clone(),
                payload.store_id,
                &expense_uuid,
            )
            .await
            .map_err(|e| e.to_string())?;

        Ok(PurchaseOrderWithItems {
            id: order.id,
            uuid: order.uuid,
            store_id: order.store_id,
            supplier_name: order.supplier_name,
            batch_date: order.batch_date,
            alias: order.alias,
            total_cost: order.total_cost,
            created_by: order.created_by,
            created_at: order.created_at,
            items: created_items,
        })
    }

    pub async fn get_purchase_orders(
        &self,
        store_id: i64,
    ) -> Result<Vec<PurchaseOrder>, String> {
        self.purchase_order_repo
            .find_by_store(store_id)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_purchase_order_detail(
        &self,
        id: i64,
    ) -> Result<Option<PurchaseOrderWithItems>, String> {
        let order = self
            .purchase_order_repo
            .find_by_id(id)
            .await
            .map_err(|e| e.to_string())?;

        match order {
            Some(order) => {
                let items = self
                    .purchase_order_repo
                    .find_items_by_order(order.id)
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(Some(PurchaseOrderWithItems {
                    id: order.id,
                    uuid: order.uuid,
                    store_id: order.store_id,
                    supplier_name: order.supplier_name,
                    batch_date: order.batch_date,
                    alias: order.alias,
                    total_cost: order.total_cost,
                    created_by: order.created_by,
                    created_at: order.created_at,
                    items,
                }))
            }
            None => Ok(None),
        }
    }
}
