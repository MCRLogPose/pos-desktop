use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Represents a single item when creating a sale from the frontend.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateOrderItemPayload {
    pub product_id: i64,
    pub product_name: String,
    pub unit_price: f64,
    pub quantity: i64,
    pub subtotal: f64,
}

/// Represents a single payment fraction when creating a sale from the frontend.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateOrderPaymentPayload {
    pub payment_method: String, // "cash" | "card" | "yape"
    pub amount: f64,
}

/// Full payload received from the frontend to create a sale.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateOrderPayload {
    pub user_id: i64,
    pub client_document: Option<String>,
    pub client_phone: Option<String>,
    pub client_name: Option<String>,
    pub payment_method: String, // "cash" | "card" | "yape" (metodo con mayor monto, para compatibilidad/display)
    pub payments: Vec<CreateOrderPaymentPayload>,
    pub items: Vec<CreateOrderItemPayload>,
    pub subtotal: f64,
    pub igv: f64,
    pub total: f64,
    pub cash_session_id: i64,
    pub store_id: i64,
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
    pub store_id: i64,
    pub cash_session_id: Option<i64>,
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

/// A single payment fraction inside a sale, returned in the detail view.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct OrderPayment {
    pub id: i64,
    pub payment_method: String,
    pub amount: f64,
}

/// Total por método de pago dentro de una sesión de caja (resumen de ventas).
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct PaymentMethodTotal {
    pub payment_method: String,
    pub amount: f64,
}

/// Full sale detail including its items and payment fractions.
#[derive(Debug, Serialize, Deserialize)]
pub struct SaleDetail {
    #[serde(flatten)]
    pub sale: Sale,
    pub items: Vec<SaleItem>,
    pub payments: Vec<OrderPayment>,
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
    pub store_id: Option<i64>,
}

/// Resultado de una anulacion de venta.
#[derive(Debug, Serialize, Deserialize)]
pub struct AnulacionResult {
    pub id: i64,
    pub total_anulado: f64,
    pub items_count: usize,
}

/// Cabecera que se sincroniza a la Primary al anular una venta.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct VentaAnulada {
    pub id: i64,
    pub uuid: String,
    pub order_id: Option<i64>,
    pub store_id: i64,
    pub user_id: i64,
    pub reason: String,
    pub payment_method: String,
    pub subtotal: f64,
    pub igv: f64,
    pub total: f64,
    pub cancelled_at: String,
}

/// Item eliminado que se sincroniza junto a la cabecera anulada.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ItemAnulado {
    pub id: i64,
    pub uuid: String,
    pub venta_anulada_id: i64,
    pub product_id: i64,
    pub product_name: String,
    pub unit_price: f64,
    pub quantity: i64,
    pub subtotal: f64,
}

/// Fila de la tabla de anulaciones (cabecera + usuario que anulo).
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct VentaAnuladaExport {
    pub id: i64,
    pub order_id: Option<i64>,
    pub store_id: i64,
    pub reason: String,
    pub payment_method: String,
    pub subtotal: f64,
    pub igv: f64,
    pub total: f64,
    pub cancelled_by: Option<String>,
    pub cancelled_at: String,
}

/// Fila plana de items anulados, para el detalle/exportación (como el CSV de prendas).
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ItemAnuladoExport {
    pub anulacion_id: i64,
    pub cancelled_at: String,
    pub reason: String,
    pub product_name: String,
    pub unit_price: f64,
    pub quantity: i64,
    pub subtotal: f64,
    pub store_id: Option<i64>,
}
