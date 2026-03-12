use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CashSession {
    pub id: i64,
    pub opened_by: i64,
    pub opened_at: String,
    pub closed_by: Option<i64>,
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
    pub store_id: i64,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct UserSession {
    pub id: i64,
    pub user_id: i64,
    pub login_at: String,
    pub logout_at: Option<String>,
    pub cash_session_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenCashPayload {
    pub opened_by: i64,
    pub opening_cash: f64,
    pub opening_virtual: f64,
    pub store_id: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CloseCashPayload {
    pub closed_by: i64,
    pub real_closing_cash: f64,
    pub real_closing_virtual: f64,
    pub justification: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Expense {
    pub id: i64,
    pub cash_session_id: i64,
    pub description: String,
    pub amount: f64,
    pub payment_method: String,
    pub store_id: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct OtherIncome {
    pub id: i64,
    pub cash_session_id: i64,
    pub description: String,
    pub amount: f64,
    pub payment_method: String,
    pub store_id: i64,
    pub created_at: String,
}
