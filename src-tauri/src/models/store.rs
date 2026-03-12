use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Store {
    pub id: i64,
    pub name: String,
    pub code: Option<String>,
    pub address: Option<String>,
    pub is_active: bool,
    pub created_at: Option<NaiveDateTime>,
}
