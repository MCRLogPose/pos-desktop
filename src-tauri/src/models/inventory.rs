use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use chrono::NaiveDateTime;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Category {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Product {
    pub id: i64,
    pub code: Option<String>,
    pub name: String,
    pub category_id: Option<i64>,
    pub price: f64,
    pub cost: f64,
    pub stock: i64,
    pub min_stock: Option<i64>,
    pub unit: Option<String>,
    pub image_url: Option<String>,
    pub is_active: bool,
    pub created_at: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ProductWithCategory {
    pub id: i64,
    pub code: Option<String>,
    pub name: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub price: f64,
    pub cost: f64,
    pub stock: i64,
    pub min_stock: Option<i64>,
    pub unit: Option<String>,
    pub image_url: Option<String>,
    pub is_active: bool,
    pub created_at: Option<NaiveDateTime>,
}
