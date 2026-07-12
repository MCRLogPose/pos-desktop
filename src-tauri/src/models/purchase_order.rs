use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct PurchaseOrder {
    pub id: i64,
    pub uuid: String,
    pub store_id: i64,
    pub supplier_name: Option<String>,
    pub batch_date: String,
    pub alias: Option<String>,
    pub total_cost: f64,
    pub created_by: Option<i64>,
    pub created_at: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct PurchaseOrderItem {
    pub id: i64,
    pub purchase_order_id: i64,
    pub product_id: Option<i64>,
    pub product_name: String,
    pub sku: Option<String>,
    pub category_id: Option<i64>,
    pub quantity: i64,
    pub unit_cost: f64,
    pub unit_price: f64,
    pub created_at: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePurchaseOrderPayload {
    pub store_id: i64,
    pub created_by: i64,
    pub supplier_name: Option<String>,
    pub batch_date: String,
    pub alias: Option<String>,
    pub payment_method: String,
    pub items: Vec<CreatePurchaseOrderItemPayload>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePurchaseOrderItemPayload {
    pub product_name: String,
    pub sku: Option<String>,
    pub category_id: Option<i64>,
    pub quantity: i64,
    pub unit_cost: f64,
    pub unit_price: f64,
    pub image_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct PurchaseOrderWithItems {
    pub id: i64,
    pub uuid: String,
    pub store_id: i64,
    pub supplier_name: Option<String>,
    pub batch_date: String,
    pub alias: Option<String>,
    pub total_cost: f64,
    pub created_by: Option<i64>,
    pub created_at: Option<NaiveDateTime>,
    pub items: Vec<PurchaseOrderItem>,
}
