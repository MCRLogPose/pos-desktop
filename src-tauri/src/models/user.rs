use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use chrono::NaiveDateTime;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: i64,
    pub username: String,
    #[serde(skip_serializing)] // Don't send hash to frontend
    pub password_hash: String,
    pub cargo: Option<String>,
    pub email: Option<String>,
    pub store_id: Option<i64>,
    pub is_active: bool, // stored as INTEGER 0/1 in SQLite
    pub created_at: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Role {
    pub id: i64,
    pub role_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserWithRoles {
    #[serde(flatten)]
    pub user: User,
    pub roles: Vec<String>,
}
