use crate::models::cash::{CashSession, CloseCashPayload, OpenCashPayload};
use crate::repositories::cash_repo::CashRepository;
use sqlx::SqlitePool;

pub struct CashService {
    pub cash_repo: CashRepository,
}

impl CashService {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            cash_repo: CashRepository::new(pool),
        }
    }

    pub async fn get_active_session(&self) -> Result<Option<CashSession>, String> {
        self.cash_repo
            .get_active_session()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_last_closed_session(&self) -> Result<Option<CashSession>, String> {
        self.cash_repo
            .get_last_closed_session()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn open_session(&self, payload: OpenCashPayload) -> Result<i64, String> {
        // Check if there is already an active session
        if let Some(_) = self.get_active_session().await? {
            return Err("Ya existe una caja abierta".to_string());
        }
        self.cash_repo
            .open_session(payload)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn close_session(
        &self,
        session_id: i64,
        payload: CloseCashPayload,
    ) -> Result<(), String> {
        self.cash_repo
            .close_session(session_id, payload)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn add_expense(
        &self,
        session_id: i64,
        description: String,
        amount: f64,
        payment_method: String,
    ) -> Result<i64, String> {
        self.cash_repo
            .add_expense(session_id, description, amount, payment_method)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_all_expenses(&self) -> Result<Vec<crate::models::cash::Expense>, String> {
        self.cash_repo
            .get_all_expenses()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn add_other_income(
        &self,
        session_id: i64,
        description: String,
        amount: f64,
        payment_method: String,
    ) -> Result<i64, String> {
        self.cash_repo
            .add_other_income(session_id, description, amount, payment_method)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_all_other_income(&self) -> Result<Vec<crate::models::cash::OtherIncome>, String> {
        self.cash_repo
            .get_all_other_income()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_session_transactions(
        &self,
        session_id: i64,
    ) -> Result<Vec<serde_json::Value>, String> {
        self.cash_repo
            .get_session_transactions(session_id)
            .await
            .map_err(|e| e.to_string())
    }
}
