use crate::models::sales::{CreateOrderPayload, Sale, SaleDetail, OrderItemExport};
use crate::repositories::sales_repo::SalesRepository;
use sqlx::SqlitePool;

pub struct SalesService {
    pub sales_repo: SalesRepository,
}

impl SalesService {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            sales_repo: SalesRepository::new(pool),
        }
    }

    pub async fn create_order(&self, payload: CreateOrderPayload) -> Result<i64, String> {
        self.sales_repo
            .create_order(payload)
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => {
                    "Stock insuficiente para uno o más productos".to_string()
                }
                other => other.to_string(),
            })
    }

    pub async fn get_sales(&self) -> Result<Vec<Sale>, String> {
        self.sales_repo
            .get_sales()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_sale_detail(&self, sale_id: i64) -> Result<Option<SaleDetail>, String> {
        self.sales_repo
            .get_sale_detail(sale_id)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_all_order_items(&self) -> Result<Vec<OrderItemExport>, String> {
        self.sales_repo
            .get_all_order_items()
            .await
            .map_err(|e| e.to_string())
    }
}
