use serde::{Deserialize, Serialize};

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
}

/// Represents a created order returned to the frontend.
#[derive(Debug, Serialize, Deserialize)]
pub struct Order {
    pub id: i64,
}
