use crate::models::cash::{CashSession, CloseCashPayload, OpenCashPayload, UpdateExpensePayload};
use sqlx::{Row, SqlitePool};

pub struct CashRepository {
    pool: SqlitePool,
}

impl CashRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn get_active_session(&self, store_id: i64) -> Result<Option<CashSession>, sqlx::Error> {
        sqlx::query_as::<_, CashSession>(
            "SELECT * FROM cash_sessions WHERE status = 'open' AND store_id = ? LIMIT 1",
        )
        .bind(store_id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn get_last_closed_session(&self, store_id: i64) -> Result<Option<CashSession>, sqlx::Error> {
        sqlx::query_as::<_, CashSession>(
            "SELECT * FROM cash_sessions WHERE status = 'closed' AND store_id = ? ORDER BY closed_at DESC LIMIT 1",
        )
        .bind(store_id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn open_session(&self, payload: OpenCashPayload) -> Result<i64, sqlx::Error> {
        let id = sqlx::query(
            r#"
            INSERT INTO cash_sessions (opened_by, opening_cash, opening_virtual, expected_closing_cash, expected_closing_virtual, status, store_id)
            VALUES (?, ?, ?, ?, ?, 'open', ?)
            "#
        )
        .bind(payload.opened_by)
        .bind(payload.opening_cash)
        .bind(payload.opening_virtual)
        .bind(payload.opening_cash) // Initially expected is the opening
        .bind(payload.opening_virtual)
        .bind(payload.store_id)
        .execute(&self.pool)
        .await?
        .last_insert_rowid();

        Ok(id)
    }

    pub async fn close_session(
        &self,
        session_id: i64,
        payload: CloseCashPayload,
    ) -> Result<(), sqlx::Error> {
        let difference = (payload.real_closing_cash + payload.real_closing_virtual) - (sqlx::query_scalar::<_, f64>("SELECT expected_closing_cash + expected_closing_virtual FROM cash_sessions WHERE id = ?")
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
            "#,
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

    pub async fn add_expense(
        &self,
        session_id: i64,
        description: String,
        amount: f64,
        payment_method: String,
    ) -> Result<i64, sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        let expense_uuid = uuid::Uuid::new_v4().to_string();

        let id = sqlx::query(
            "INSERT INTO expenses (uuid, cash_session_id, description, amount, payment_method, store_id, source) VALUES (?, ?, ?, ?, ?, ?, 'cash_session')"
        )
        .bind(&expense_uuid)
        .bind(session_id)
        .bind(description)
        .bind(amount)
        .bind(&payment_method)
        .bind(sqlx::query_scalar::<_, i64>("SELECT store_id FROM cash_sessions WHERE id = ?").bind(session_id).fetch_one(&mut *tx).await?)
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

    pub async fn get_all_expenses(&self, store_id: i64) -> Result<Vec<crate::models::cash::Expense>, sqlx::Error> {
        sqlx::query_as::<_, crate::models::cash::Expense>("SELECT * FROM expenses WHERE store_id = ? AND source = 'standalone' ORDER BY created_at DESC")
            .bind(store_id)
            .fetch_all(&self.pool)
            .await
    }

    pub async fn update_expense(&self, payload: UpdateExpensePayload) -> Result<(), sqlx::Error> {
        // Get current expense to reverse old balance
        let old = sqlx::query_as::<_, crate::models::cash::Expense>(
            "SELECT * FROM expenses WHERE id = ?"
        )
        .bind(payload.id)
        .fetch_one(&self.pool)
        .await?;

        let mut tx = self.pool.begin().await?;

        // Reverse old balance if linked to a session
        if let Some(session_id) = old.cash_session_id {
            if old.payment_method == "cash" {
                sqlx::query("UPDATE cash_sessions SET expected_closing_cash = expected_closing_cash + ? WHERE id = ?")
                    .bind(old.amount)
                    .bind(session_id)
                    .execute(&mut *tx)
                    .await?;
            } else {
                sqlx::query("UPDATE cash_sessions SET expected_closing_virtual = expected_closing_virtual + ? WHERE id = ?")
                    .bind(old.amount)
                    .bind(session_id)
                    .execute(&mut *tx)
                    .await?;
            }
        }

        // Update expense
        sqlx::query(
            "UPDATE expenses SET description = ?, amount = ?, payment_method = ?, category = ?, supplier = ? WHERE id = ?"
        )
        .bind(&payload.description)
        .bind(payload.amount)
        .bind(&payload.payment_method)
        .bind(&payload.category)
        .bind(&payload.supplier)
        .bind(payload.id)
        .execute(&mut *tx)
        .await?;

        // Apply new balance if linked to a session
        if let Some(session_id) = old.cash_session_id {
            if payload.payment_method == "cash" {
                sqlx::query("UPDATE cash_sessions SET expected_closing_cash = expected_closing_cash - ? WHERE id = ?")
                    .bind(payload.amount)
                    .bind(session_id)
                    .execute(&mut *tx)
                    .await?;
            } else {
                sqlx::query("UPDATE cash_sessions SET expected_closing_virtual = expected_closing_virtual - ? WHERE id = ?")
                    .bind(payload.amount)
                    .bind(session_id)
                    .execute(&mut *tx)
                    .await?;
            }
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn delete_expense(&self, id: i64) -> Result<(), sqlx::Error> {
        let expense = sqlx::query_as::<_, crate::models::cash::Expense>(
            "SELECT * FROM expenses WHERE id = ?"
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;

        let mut tx = self.pool.begin().await?;

        // Reverse balance if linked to a session
        if let Some(session_id) = expense.cash_session_id {
            if expense.payment_method == "cash" {
                sqlx::query("UPDATE cash_sessions SET expected_closing_cash = expected_closing_cash + ? WHERE id = ?")
                    .bind(expense.amount)
                    .bind(session_id)
                    .execute(&mut *tx)
                    .await?;
            } else {
                sqlx::query("UPDATE cash_sessions SET expected_closing_virtual = expected_closing_virtual + ? WHERE id = ?")
                    .bind(expense.amount)
                    .bind(session_id)
                    .execute(&mut *tx)
                    .await?;
            }
        }

        // Delete expense
        sqlx::query("DELETE FROM expenses WHERE id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }

    pub async fn add_expense_standalone(
        &self,
        description: String,
        amount: f64,
        payment_method: String,
        category: Option<String>,
        supplier: Option<String>,
        store_id: i64,
        uuid: &str,
    ) -> Result<i64, sqlx::Error> {
        let id = sqlx::query(
            "INSERT INTO expenses (uuid, cash_session_id, description, amount, payment_method, category, supplier, store_id) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)"
        )
        .bind(uuid)
        .bind(description)
        .bind(amount)
        .bind(&payment_method)
        .bind(&category)
        .bind(&supplier)
        .bind(store_id)
        .execute(&self.pool)
        .await?
        .last_insert_rowid();

        Ok(id)
    }

    pub async fn add_other_income(
        &self,
        session_id: i64,
        description: String,
        amount: f64,
        payment_method: String,
    ) -> Result<i64, sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        let id = sqlx::query(
            "INSERT INTO other_income (cash_session_id, description, amount, payment_method, store_id) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(session_id)
        .bind(description)
        .bind(amount)
        .bind(&payment_method)
        .bind(sqlx::query_scalar::<_, i64>("SELECT store_id FROM cash_sessions WHERE id = ?").bind(session_id).fetch_one(&mut *tx).await?)
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

    pub async fn get_all_other_income(&self, store_id: i64) -> Result<Vec<crate::models::cash::OtherIncome>, sqlx::Error> {
        sqlx::query_as::<_, crate::models::cash::OtherIncome>("SELECT * FROM other_income WHERE store_id = ? ORDER BY created_at DESC")
            .bind(store_id)
            .fetch_all(&self.pool)
            .await
    }

    pub async fn update_expected_balances(
        &self,
        session_id: i64,
        amount: f64,
        payment_method: String,
    ) -> Result<(), sqlx::Error> {
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

    pub async fn get_session_transactions(
        &self,
        session_id: i64,
    ) -> Result<Vec<serde_json::Value>, sqlx::Error> {
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
             FROM expenses WHERE cash_session_id = ?",
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;

        // Fetch Other Income
        let other_income = sqlx::query(
            "SELECT id, amount, payment_method, created_at, description, 'income' as type 
             FROM other_income WHERE cash_session_id = ?",
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
