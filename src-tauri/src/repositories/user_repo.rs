use crate::models::user::{User, Role};
use sqlx::SqlitePool;

pub struct UserRepository {
    pool: SqlitePool,
}

impl UserRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn find_by_username(&self, username: &str) -> Result<Option<User>, sqlx::Error> {
        let user = sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, email, is_active, created_at FROM users WHERE username = ?"
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn create_user(&self, username: &str, password_hash: &str, email: Option<&str>) -> Result<User, sqlx::Error> {
        // ID is autoincrement, so we don't bind it.
        let result = sqlx::query(
            "INSERT INTO users (username, password_hash, email, is_active) VALUES (?, ?, ?, ?)"
        )
        .bind(username)
        .bind(password_hash)
        .bind(email)
        .bind(true) // is_active
        .execute(&self.pool)
        .await?;

        let id = result.last_insert_rowid();

        // return the created user object
        Ok(User {
            id,
            username: username.to_string(),
            password_hash: password_hash.to_string(),
            email: email.map(|s| s.to_string()),
            is_active: true,
            created_at: None, // Or fetch it if precise timestamp needed immediately
        })
    }

    pub async fn count_users(&self) -> Result<i64, sqlx::Error> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
            .fetch_one(&self.pool)
            .await?;
        Ok(count.0)
    }

    pub async fn find_all_users(&self) -> Result<Vec<User>, sqlx::Error> {
         sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, email, is_active, created_at FROM users WHERE is_active = 1"
        )
        .fetch_all(&self.pool)
        .await
    }

    pub async fn find_role_by_name(&self, name: &str) -> Result<Option<Role>, sqlx::Error> {
        sqlx::query_as::<_, Role>("SELECT id, name FROM roles WHERE name = ?")
            .bind(name)
            .fetch_optional(&self.pool)
            .await
    }

    pub async fn create_role(&self, name: &str) -> Result<Role, sqlx::Error> {
        let result = sqlx::query("INSERT INTO roles (name) VALUES (?)")
            .bind(name)
            .execute(&self.pool)
            .await?;
        
        let id = result.last_insert_rowid();
        
        Ok(Role { id, name: name.to_string() })
    }

    pub async fn assign_role(&self, user_id: i64, role_id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)")
            .bind(user_id)
            .bind(role_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
