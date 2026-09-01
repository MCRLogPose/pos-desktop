use crate::models::sales::{
    AnulacionResult, CreateOrderPayload, ItemAnuladoExport, OrderItemExport, PaymentMethodTotal,
    Sale, SaleDetail, VentaAnuladaExport,
};
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

    pub async fn get_sales(&self, store_id: i64) -> Result<Vec<Sale>, String> {
        self.sales_repo.get_sales(store_id).await.map_err(|e| e.to_string())
    }

    pub async fn get_sale_detail(&self, sale_id: i64) -> Result<Option<SaleDetail>, String> {
        self.sales_repo
            .get_sale_detail(sale_id)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_all_order_items(&self, store_id: i64) -> Result<Vec<OrderItemExport>, String> {
        self.sales_repo
            .get_all_order_items(store_id)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_session_payment_totals(
        &self,
        session_id: i64,
    ) -> Result<Vec<PaymentMethodTotal>, String> {
        self.sales_repo
            .get_session_payment_totals(session_id)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn anular_venta(
        &self,
        sale_id: i64,
        requester_user_id: i64,
        reason: String,
        active_cash_session_id: Option<i64>,
    ) -> Result<AnulacionResult, String> {
        self.sales_repo
            .anular_venta(sale_id, requester_user_id, reason, active_cash_session_id)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_anulaciones(&self, store_id: i64) -> Result<Vec<VentaAnuladaExport>, String> {
        self.sales_repo
            .get_anulaciones(store_id)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_all_items_anulados(
        &self,
        store_id: i64,
    ) -> Result<Vec<ItemAnuladoExport>, String> {
        self.sales_repo
            .get_all_items_anulados(store_id)
            .await
            .map_err(|e| e.to_string())
    }
}
