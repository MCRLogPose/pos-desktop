use crate::models::user::User;
use crate::repositories::user_repo::UserRepository;
use bcrypt::{hash, verify, DEFAULT_COST};
use sqlx::SqlitePool;

use crate::repositories::store_repo::StoreRepository;

pub struct AuthService {
    pub user_repo: UserRepository,
    pub store_repo: StoreRepository,
}

impl AuthService {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            user_repo: UserRepository::new(pool.clone()),
            store_repo: StoreRepository::new(pool),
        }
    }

    pub async fn initialize_admin(&self) -> Result<(), Box<dyn std::error::Error>> {
        let count = self.user_repo.count_users().await?;
        
        let admin_role_name = "ADMIN";
        let mut admin_role = self.user_repo.find_role_by_name(admin_role_name).await?;
        
        if admin_role.is_none() {
            log::info!("Creating ADMIN role...");
            admin_role = Some(self.user_repo.create_role(admin_role_name).await?);
        }

        if count == 0 {
            log::info!("No users found. Creating default admin user...");
            let password_hash = hash("root", DEFAULT_COST)?;
            let admin_user = self.user_repo.create_user("admin", &password_hash, None).await?;
            
            if let Some(role) = admin_role {
                self.user_repo.assign_role(admin_user.id, role.id).await?;
                log::info!("Assigned ADMIN role to default admin user.");
            }
        } else {
            log::info!("Users already exist. Skipping default admin creation.");
        }

        Ok(())
    }

    pub async fn login(&self, username: &str, password: &str) -> Result<User, String> {
        let user_opt = self.user_repo.find_by_username(username).await
            .map_err(|e| format!("Database error: {}", e))?;

        if let Some(user) = user_opt {
            if verify(password, &user.password_hash).map_err(|e| format!("Hash error: {}", e))? {
                Ok(user)
            } else {
                Err("Invalid credentials".to_string())
            }
        } else {
            Err("User not found".to_string())
        }
    }
    
    pub async fn create_user(&self, username: &str, password: &str, email: Option<&str>) -> Result<User, String> {
        if let Ok(Some(_)) = self.user_repo.find_by_username(username).await {
            return Err("Username already exists".to_string());
        }

        let password_hash = hash(password, DEFAULT_COST).map_err(|e| e.to_string())?;
        self.user_repo.create_user(username, &password_hash, email).await
            .map_err(|e| e.to_string())
    }

    pub async fn get_users(&self) -> Result<Vec<User>, String> {
        self.user_repo.find_all_users().await.map_err(|e| e.to_string())
    }

    pub async fn verify_admin_password(&self, password: &str) -> Result<bool, String> {
        // For simplicity, we check against the 'admin' user. 
        // In a real app, we should check against the currently logged-in user's password.
        // But since we don't have session management in backend fully yet (just JWT or simple login), 
        // we will assume the sensitive action requires the 'admin' password or we identify the user.
        // For this requirement: "si deseo eliminar y hay usuario entonces que me pida que vuelva a ingresar la contraseña"
        // We will assume checking against the 'admin' user for now as it is the "super user".
        // Or better, logic: find user by username 'admin' and verify. 
        // Ideally we pass username too.
        
        let admin = self.user_repo.find_by_username("admin").await.map_err(|e| e.to_string())?;
        if let Some(user) = admin {
             verify(password, &user.password_hash).map_err(|e| e.to_string())
        } else {
            Err("Admin user not found".to_string())
        }
    }
}
