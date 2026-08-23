use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StockReason {
    Sale,
    Purchase,
    Adjustment,
    Initial,
}

// ─────────────────────────── SALES ───────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct SalesBatch {
    pub sales: Vec<SaleSync>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaleSync {
    pub sync_uuid: String,
    pub local_order_id: i64,
    pub seller_username: Option<String>,
    pub client_document: Option<String>,
    pub client_phone: Option<String>,
    pub client_name: Option<String>,
    pub payment_method: String,
    pub subtotal: f64,
    pub igv: f64,
    pub total: f64,
    pub cash_session_uuid: Option<String>,
    pub created_at: String,
    pub items: Vec<SaleItemSync>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaleItemSync {
    pub product_code: Option<String>,
    pub product_name: String,
    pub unit_price: f64,
    pub quantity: i64,
    pub subtotal: f64,
}

// ───────────────────────── INVENTORY ─────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct InventoryBatch {
    pub categories: Vec<CategorySync>,
    pub product_upserts: Vec<ProductUpsertSync>,
    pub stock_movements: Vec<StockMovementSync>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CategorySync {
    pub sync_uuid: String,
    pub local_category_id: i64,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductUpsertSync {
    pub sync_uuid: String,
    pub local_product_id: i64,
    pub code: Option<String>,
    pub name: String,
    pub category_name: Option<String>,
    pub price: f64,
    pub cost: f64,
    pub min_stock: Option<i64>,
    pub unit: Option<String>,
    pub image_url: Option<String>,
    pub is_active: bool,
    pub occurred_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockMovementSync {
    pub sync_uuid: String,
    pub product_code: Option<String>,
    pub product_name: String,
    pub delta: i64,
    pub reason: StockReason,
    pub reference_uuid: Option<String>,
    pub resulting_stock: Option<i64>,
    pub occurred_at: String,
}

// ───────────────────────── PURCHASES ─────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct PurchasesBatch {
    pub purchase_orders: Vec<PurchaseOrderSync>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PurchaseOrderSync {
    pub sync_uuid: String,
    pub local_purchase_order_id: i64,
    pub supplier_name: Option<String>,
    pub batch_date: String,
    pub alias: Option<String>,
    pub total_cost: f64,
    pub created_by_username: Option<String>,
    pub created_at: String,
    pub items: Vec<PurchaseItemSync>,
    pub generated_expense: Option<ExpenseSync>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PurchaseItemSync {
    pub product_code: Option<String>,
    pub product_name: String,
    pub sku: Option<String>,
    pub category_name: Option<String>,
    pub quantity: i64,
    pub unit_cost: f64,
    pub unit_price: f64,
}

// ─────────────────────────── CASH ────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct CashBatch {
    pub sessions: Vec<CashSessionSync>,
    pub expenses: Vec<ExpenseSync>,
    pub incomes: Vec<OtherIncomeSync>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CashSessionSync {
    pub sync_uuid: String,
    pub local_session_id: i64,
    pub opened_by_username: Option<String>,
    pub opened_at: String,
    pub closed_by_username: Option<String>,
    pub closed_at: Option<String>,
    pub opening_cash: f64,
    pub opening_virtual: f64,
    pub expected_closing_cash: f64,
    pub expected_closing_virtual: f64,
    pub real_closing_cash: Option<f64>,
    pub real_closing_virtual: Option<f64>,
    pub difference: Option<f64>,
    pub justification: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExpenseSync {
    pub sync_uuid: String,
    pub cash_session_uuid: Option<String>,
    pub source: String,
    pub description: String,
    pub amount: f64,
    pub payment_method: String,
    pub category: Option<String>,
    pub supplier: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OtherIncomeSync {
    pub sync_uuid: String,
    pub cash_session_uuid: Option<String>,
    pub description: String,
    pub amount: f64,
    pub payment_method: String,
    pub created_at: String,
}

// ────────────────────────── CATALOG ──────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct CatalogBatch {
    pub stores: Vec<StoreSync>,
    pub users: Vec<UserSync>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StoreSync {
    pub sync_uuid: String,
    pub local_store_id: i64,
    pub code: Option<String>,
    pub name: String,
    pub address: Option<String>,
    pub is_active: bool,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserSync {
    pub sync_uuid: String,
    pub local_user_id: i64,
    pub username: String,
    pub password_hash: String,
    pub cargo: Option<String>,
    pub email: Option<String>,
    pub store_code: Option<String>,
    pub role_name: Option<String>,
    pub is_active: bool,
    pub created_at: Option<String>,
}
