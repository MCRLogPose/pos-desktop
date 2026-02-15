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
            "SELECT id, username, password_hash, cargo, email, store_id, is_active, created_at FROM users WHERE username = ?"
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn create_user(
        &self, 
        username: &str, 
        password_hash: &str, 
        cargo: Option<&str>,
        email: Option<&str>,
        store_id: Option<i64>
    ) -> Result<User, sqlx::Error> {
        let result = sqlx::query(
            "INSERT INTO users (username, password_hash, cargo, email, store_id, is_active) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(username)
        .bind(password_hash)
        .bind(cargo)
        .bind(email)
        .bind(store_id)
        .bind(true) // is_active
        .execute(&self.pool)
        .await?;

        let id = result.last_insert_rowid();

        Ok(User {
            id,
            username: username.to_string(),
            password_hash: password_hash.to_string(),
            cargo: cargo.map(|s| s.to_string()),
            email: email.map(|s| s.to_string()),
            store_id,
            is_active: true,
            created_at: None,
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
            "SELECT id, username, password_hash, cargo, email, store_id, is_active, created_at FROM users WHERE is_active = 1"
        )
        .fetch_all(&self.pool)
        .await
    }

    pub async fn find_role_by_name(&self, role_name: &str) -> Result<Option<Role>, sqlx::Error> {
        sqlx::query_as::<_, Role>("SELECT id, role_name FROM roles WHERE role_name = ?")
            .bind(role_name)
            .fetch_optional(&self.pool)
            .await
    }

    pub async fn create_role(&self, role_name: &str) -> Result<Role, sqlx::Error> {
        let result = sqlx::query("INSERT INTO roles (role_name) VALUES (?)")
            .bind(role_name)
            .execute(&self.pool)
            .await?;
        
        let id = result.last_insert_rowid();
        
        Ok(Role { id, role_name: role_name.to_string() })
    }

    pub async fn assign_role(&self, user_id: i64, role_id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)")
            .bind(user_id)
            .bind(role_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn find_user_by_id(&self, id: i64) -> Result<Option<User>, sqlx::Error> {
        sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, cargo, email, store_id, is_active, created_at FROM users WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn update_user(
        &self,
        id: i64,
        cargo: Option<&str>,
        email: Option<&str>,
        store_id: Option<i64>
    ) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE users SET cargo = ?, email = ?, store_id = ? WHERE id = ?")
            .bind(cargo)
            .bind(email)
            .bind(store_id)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn soft_delete_user(&self, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE users SET is_active = 0 WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_users_by_store(&self, store_id: i64) -> Result<Vec<User>, sqlx::Error> {
        sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, cargo, email, store_id, is_active, created_at FROM users WHERE store_id = ? AND is_active = 1"
        )
        .bind(store_id)
        .fetch_all(&self.pool)
        .await
    }
}
