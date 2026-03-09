use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Represents a single item when creating a sale from the frontend.
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateOrderItemPayload {
    pub product_id: i64,
    pub product_name: String,
    pub unit_price: f64,
    pub quantity: i64,
    pub subtotal: f64,
}

/// Full payload received from the frontend to create a sale.
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateOrderPayload {
    pub user_id: i64,
    pub client_document: Option<String>,
    pub client_phone: Option<String>,
    pub client_name: Option<String>,
    pub payment_method: String, // "cash" | "card" | "yape"
    pub items: Vec<CreateOrderItemPayload>,
    pub subtotal: f64,
    pub igv: f64,
    pub total: f64,
    pub cash_session_id: i64,
}

/// Represents a created order returned to the frontend.
#[derive(Debug, Serialize, Deserialize)]
pub struct Order {
    pub id: i64,
}

/// A sale row returned in the list view.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Sale {
    pub id: i64,
    pub user_id: i64,
    pub user_name: Option<String>,
    pub client_document: Option<String>,
    pub client_phone: Option<String>,
    pub client_name: Option<String>,
    pub payment_method: String,
    pub subtotal: f64,
    pub igv: f64,
    pub total: f64,
    pub created_at: String,
}

/// A single item inside a sale, returned in the detail view.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct SaleItem {
    pub id: i64,
    pub product_id: i64,
    pub product_name: String,
    pub unit_price: f64,
    pub quantity: i64,
    pub subtotal: f64,
}

/// Full sale detail including its items.
#[derive(Debug, Serialize, Deserialize)]
pub struct SaleDetail {
    #[serde(flatten)]
    pub sale: Sale,
    pub items: Vec<SaleItem>,
}

/// Flat row used for the "export all items" CSV.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct OrderItemExport {
    pub order_id: i64,
    pub created_at: String,
    pub client_name: Option<String>,
    pub client_document: Option<String>,
    pub payment_method: String,
    pub product_name: String,
    pub unit_price: f64,
    pub quantity: i64,
    pub subtotal: f64,
}
