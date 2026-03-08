use crate::models::sales::CreateOrderPayload;
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
}
