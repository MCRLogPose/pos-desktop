use crate::models::inventory::{Category, ProductWithCategory};
use crate::repositories::inventory_repo::InventoryRepository;
use sqlx::SqlitePool;

pub struct InventoryService {
    pub inventory_repo: InventoryRepository,
}

impl InventoryService {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            inventory_repo: InventoryRepository::new(pool),
        }
    }

    pub async fn get_categories(&self) -> Result<Vec<Category>, String> {
        self.inventory_repo.get_categories().await.map_err(|e| e.to_string())
    }

    pub async fn create_category(&self, name: &str) -> Result<Category, String> {
        self.inventory_repo.create_category(name).await.map_err(|e| e.to_string())
    }

    pub async fn update_category(&self, id: i64, name: &str) -> Result<(), String> {
        self.inventory_repo.update_category(id, name).await.map_err(|e| e.to_string())
    }

    pub async fn delete_category(&self, id: i64) -> Result<(), String> {
        self.inventory_repo.delete_category(id).await.map_err(|e| e.to_string())
    }

    pub async fn get_products(&self) -> Result<Vec<ProductWithCategory>, String> {
        self.inventory_repo.get_products().await.map_err(|e| e.to_string())
    }

    pub async fn create_product(
        &self,
        code: Option<&str>,
        name: &str,
        category_id: Option<i64>,
        price: f64,
        cost: f64,
        stock: i64,
        unit: Option<&str>,
        image_url: Option<&str>,
    ) -> Result<i64, String> {
        self.inventory_repo.create_product(code, name, category_id, price, cost, stock, unit, image_url)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn update_product(
        &self,
        id: i64,
        code: Option<&str>,
        name: &str,
        category_id: Option<i64>,
        price: f64,
        cost: f64,
        stock: i64,
        unit: Option<&str>,
        image_url: Option<&str>,
    ) -> Result<(), String> {
        self.inventory_repo.update_product(id, code, name, category_id, price, cost, stock, unit, image_url)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn delete_product(&self, id: i64) -> Result<(), String> {
        self.inventory_repo.soft_delete_product(id).await.map_err(|e| e.to_string())
    }
}
