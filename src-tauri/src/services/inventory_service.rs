use crate::models::inventory::{Category, ProductWithCategory};
use crate::repositories::inventory_repo::{AddStockOutcome, InventoryRepository, ReconcileReport};
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
        self.inventory_repo
            .get_categories()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn create_category(&self, name: &str) -> Result<Category, String> {
        self.inventory_repo
            .create_category(name)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn update_category(&self, id: i64, name: &str) -> Result<(), String> {
        self.inventory_repo
            .update_category(id, name)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn delete_category(&self, id: i64) -> Result<(), String> {
        self.inventory_repo
            .delete_category(id)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_products(&self, store_id: i64) -> Result<Vec<ProductWithCategory>, String> {
        self.inventory_repo
            .get_products(store_id)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn create_product(
        &self,
        code: Option<&str>,
        name: &str,
        display_name: Option<&str>,
        category_id: Option<i64>,
        price: f64,
        cost: f64,
        stock: i64,
        unit: Option<&str>,
        image_url: Option<&str>,
        store_id: i64,
        supplier_name: Option<&str>,
        created_by: Option<i64>,
    ) -> Result<i64, String> {
        self.inventory_repo
            .create_product(
                code,
                name,
                display_name,
                category_id,
                price,
                cost,
                stock,
                unit,
                image_url,
                store_id,
                supplier_name,
                created_by,
            )
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn update_product(
        &self,
        id: i64,
        code: Option<&str>,
        name: &str,
        display_name: Option<&str>,
        category_id: Option<i64>,
        price: f64,
        cost: f64,
        stock: i64,
        unit: Option<&str>,
        image_url: Option<&str>,
        store_id: i64,
        supplier_name: Option<&str>,
        created_by: Option<i64>,
    ) -> Result<(), String> {
        self.inventory_repo
            .update_product(
                id,
                code,
                name,
                display_name,
                category_id,
                price,
                cost,
                Some(stock),
                unit,
                image_url,
                store_id,
                supplier_name,
                created_by,
            )
            .await
            .map_err(|e| e.to_string())
    }

    /// Reposicion de mercaderia sobre un producto existente. Transaccional:
    /// suma stock, actualiza el costo y registra el gasto, o no hace nada.
    pub async fn add_stock_to_product(
        &self,
        id: i64,
        quantity: i64,
        unit_cost: f64,
        store_id: i64,
        supplier_name: Option<&str>,
        payment_method: &str,
    ) -> Result<AddStockOutcome, String> {
        let expense_uuid = uuid::Uuid::new_v4().to_string();
        self.inventory_repo
            .add_stock_to_product(
                id,
                quantity,
                unit_cost,
                store_id,
                supplier_name,
                payment_method,
                &expense_uuid,
            )
            .await
    }

    pub async fn delete_product(&self, id: i64, user_id: i64) -> Result<(), String> {
        if !self.inventory_repo.user_is_admin(user_id).await.map_err(|e| e.to_string())? {
            return Err("solo un ADMIN puede eliminar un producto de inventario".into());
        }
        self.inventory_repo
            .soft_delete_product(id)
            .await
            .map_err(|e| e.to_string())
    }

    /// Reencola el catalogo completo y la diferencia de stock para la Primary.
    pub async fn reconcile_with_primary(&self) -> Result<ReconcileReport, String> {
        self.inventory_repo.reconcile_with_primary().await
    }
}
