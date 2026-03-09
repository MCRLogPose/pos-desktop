use crate::models::cash::{CashSession, OpenCashPayload, CloseCashPayload};
use sqlx::{SqlitePool, Row};

pub struct CashRepository {
    pool: SqlitePool,
}

impl CashRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn get_active_session(&self) -> Result<Option<CashSession>, sqlx::Error> {
        sqlx::query_as::<_, CashSession>(
            "SELECT * FROM cash_sessions WHERE status = 'open' LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn get_last_closed_session(&self) -> Result<Option<CashSession>, sqlx::Error> {
        sqlx::query_as::<_, CashSession>(
            "SELECT * FROM cash_sessions WHERE status = 'closed' ORDER BY closed_at DESC LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn open_session(&self, payload: OpenCashPayload) -> Result<i64, sqlx::Error> {
        let id = sqlx::query(
            r#"
            INSERT INTO cash_sessions (opened_by, opening_cash, opening_virtual, expected_closing_cash, expected_closing_virtual, status)
            VALUES (?, ?, ?, ?, ?, 'open')
            "#
        )
        .bind(payload.opened_by)
        .bind(payload.opening_cash)
        .bind(payload.opening_virtual)
        .bind(payload.opening_cash) // Initially expected is the opening
        .bind(payload.opening_virtual)
        .execute(&self.pool)
        .await?
        .last_insert_rowid();

        Ok(id)
    }

    pub async fn close_session(&self, session_id: i64, payload: CloseCashPayload) -> Result<(), sqlx::Error> {
        let difference = (payload.real_closing_cash + payload.real_closing_virtual) - 
                         (sqlx::query_scalar::<_, f64>("SELECT expected_closing_cash + expected_closing_virtual FROM cash_sessions WHERE id = ?")
                            .bind(session_id)
                            .fetch_one(&self.pool)
                            .await?);

        sqlx::query(
            r#"
            UPDATE cash_sessions 
            SET closed_by = ?, 
                closed_at = CURRENT_TIMESTAMP, 
                real_closing_cash = ?, 
                real_closing_virtual = ?, 
                difference = ?, 
                justification = ?, 
                status = 'closed'
            WHERE id = ?
            "#
        )
        .bind(payload.closed_by)
        .bind(payload.real_closing_cash)
        .bind(payload.real_closing_virtual)
        .bind(difference)
        .bind(payload.justification)
        .bind(session_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn add_expense(&self, session_id: i64, description: String, amount: f64, payment_method: String) -> Result<i64, sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        let id = sqlx::query(
            "INSERT INTO expenses (cash_session_id, description, amount, payment_method) VALUES (?, ?, ?, ?)"
        )
        .bind(session_id)
        .bind(description)
        .bind(amount)
        .bind(&payment_method)
        .execute(&mut *tx)
        .await?
        .last_insert_rowid();

        if payment_method == "cash" {
            sqlx::query("UPDATE cash_sessions SET expected_closing_cash = expected_closing_cash - ? WHERE id = ?")
                .bind(amount)
                .bind(session_id)
                .execute(&mut *tx)
                .await?;
        } else {
            sqlx::query("UPDATE cash_sessions SET expected_closing_virtual = expected_closing_virtual - ? WHERE id = ?")
                .bind(amount)
                .bind(session_id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;
        Ok(id)
    }

    pub async fn add_other_income(&self, session_id: i64, description: String, amount: f64, payment_method: String) -> Result<i64, sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        let id = sqlx::query(
            "INSERT INTO other_income (cash_session_id, description, amount, payment_method) VALUES (?, ?, ?, ?)"
        )
        .bind(session_id)
        .bind(description)
        .bind(amount)
        .bind(&payment_method)
        .execute(&mut *tx)
        .await?
        .last_insert_rowid();

        if payment_method == "cash" {
            sqlx::query("UPDATE cash_sessions SET expected_closing_cash = expected_closing_cash + ? WHERE id = ?")
                .bind(amount)
                .bind(session_id)
                .execute(&mut *tx)
                .await?;
        } else {
            sqlx::query("UPDATE cash_sessions SET expected_closing_virtual = expected_closing_virtual + ? WHERE id = ?")
                .bind(amount)
                .bind(session_id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;
        Ok(id)
    }

    pub async fn update_expected_balances(&self, session_id: i64, amount: f64, payment_method: String) -> Result<(), sqlx::Error> {
        if payment_method == "cash" {
            sqlx::query("UPDATE cash_sessions SET expected_closing_cash = expected_closing_cash + ? WHERE id = ?")
                .bind(amount)
                .bind(session_id)
                .execute(&self.pool)
                .await?;
        } else {
            sqlx::query("UPDATE cash_sessions SET expected_closing_virtual = expected_closing_virtual + ? WHERE id = ?")
                .bind(amount)
                .bind(session_id)
                .execute(&self.pool)
                .await?;
        }
        Ok(())
    }

    pub async fn get_session_transactions(&self, session_id: i64) -> Result<Vec<serde_json::Value>, sqlx::Error> {
        // Fetch Orders
        let orders = sqlx::query(
            "SELECT id, total as amount, payment_method, created_at, 'Venta #' || id as description, 'income' as type 
             FROM orders WHERE cash_session_id = ?"
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;

        // Fetch Expenses
        let expenses = sqlx::query(
            "SELECT id, amount, payment_method, created_at, description, 'expense' as type 
             FROM expenses WHERE cash_session_id = ?"
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;

        // Fetch Other Income
        let other_income = sqlx::query(
            "SELECT id, amount, payment_method, created_at, description, 'income' as type 
             FROM other_income WHERE cash_session_id = ?"
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;

        let mut all: Vec<serde_json::Value> = Vec::new();

        for o in orders {
            all.push(serde_json::json!({
                "id": format!("order_{}", o.get::<i64, _>("id")),
                "amount": o.get::<f64, _>("amount"),
                "payment_method": o.get::<String, _>("payment_method"),
                "created_at": o.get::<String, _>("created_at"),
                "description": o.get::<String, _>("description"),
                "type": o.get::<String, _>("type"),
                "category": "Venta"
            }));
        }

        for e in expenses {
            all.push(serde_json::json!({
                "id": format!("expense_{}", e.get::<i64, _>("id")),
                "amount": e.get::<f64, _>("amount"),
                "payment_method": e.get::<String, _>("payment_method"),
                "created_at": e.get::<String, _>("created_at"),
                "description": e.get::<String, _>("description"),
                "type": e.get::<String, _>("type"),
                "category": "Gasto"
            }));
        }

        for i in other_income {
            all.push(serde_json::json!({
                "id": format!("income_{}", i.get::<i64, _>("id")),
                "amount": i.get::<f64, _>("amount"),
                "payment_method": i.get::<String, _>("payment_method"),
                "created_at": i.get::<String, _>("created_at"),
                "description": i.get::<String, _>("description"),
                "type": i.get::<String, _>("type"),
                "category": "Ingreso"
            }));
        }

        all.sort_by(|a, b| b["created_at"].as_str().cmp(&a["created_at"].as_str()));

        Ok(all)
    }
}
