use crate::models::cash::{CashSession, CloseCashPayload, OpenCashPayload, UpdateExpensePayload};
use crate::sync::payloads::{CashSessionSync, ExpenseSync, OtherIncomeSync};
use crate::sync::queue::SyncQueue;
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

    /// Historial completo de cajas de la tienda, la mas reciente primero.
    pub async fn get_sessions(&self, store_id: i64) -> Result<Vec<CashSession>, sqlx::Error> {
        sqlx::query_as::<_, CashSession>(
            "SELECT * FROM cash_sessions WHERE store_id = ? ORDER BY opened_at DESC, id DESC",
        )
        .bind(store_id)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn open_session(&self, payload: OpenCashPayload) -> Result<i64, sqlx::Error> {
        let session_uuid = uuid::Uuid::new_v4().to_string();
        let id = sqlx::query(
            r#"
            INSERT INTO cash_sessions (uuid, opened_by, opening_cash, opening_virtual, expected_closing_cash, expected_closing_virtual, status, store_id, opened_at)
            VALUES (?, ?, ?, ?, ?, ?, 'open', ?, datetime('now', 'localtime'))
            "#
        )
        .bind(&session_uuid)
        .bind(payload.opened_by)
        .bind(payload.opening_cash)
        .bind(payload.opening_virtual)
        .bind(payload.opening_cash) // Initially expected is the opening
        .bind(payload.opening_virtual)
        .bind(payload.store_id)
        .execute(&self.pool)
        .await?
        .last_insert_rowid();

        let pool = self.pool.clone();
        let opened_by = payload.opened_by;
        let opening_cash = payload.opening_cash;
        let opening_virtual = payload.opening_virtual;
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_cash_session_open(
                &pool, &session_uuid, id, opened_by, opening_cash, opening_virtual,
            ).await {
                log::warn!("[sync] no se pudo encolar apertura de caja {id}: {e}");
            }
        });

        Ok(id)
    }

    pub async fn close_session(
        &self,
        session_id: i64,
        payload: CloseCashPayload,
    ) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        let session = sqlx::query_as::<_, CashSession>(
            "SELECT * FROM cash_sessions WHERE id = ?",
        )
        .bind(session_id)
        .fetch_optional(&mut *tx)
        .await?;

        let session = match session {
            Some(s) => s,
            None => return Err(sqlx::Error::RowNotFound),
        };

        let difference = (payload.real_closing_cash + payload.real_closing_virtual)
            - (session.expected_closing_cash + session.expected_closing_virtual);

        sqlx::query(
            r#"
            UPDATE cash_sessions 
            SET closed_by = ?, 
                closed_at = datetime('now', 'localtime'),
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
        .bind(&payload.justification)
        .bind(session_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        let pool = self.pool.clone();
        let session_uuid = session.uuid;
        let opened_by = session.opened_by;
        let opened_at = session.opened_at;
        let opening_cash = session.opening_cash;
        let opening_virtual = session.opening_virtual;
        let expected_closing_cash = session.expected_closing_cash;
        let expected_closing_virtual = session.expected_closing_virtual;
        let closed_by = payload.closed_by;
        let real_closing_cash = payload.real_closing_cash;
        let real_closing_virtual = payload.real_closing_virtual;
        let justification = payload.justification;
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_cash_session_close(
                &pool, &session_uuid, session_id, opened_by, &opened_at,
                opening_cash, opening_virtual,
                expected_closing_cash, expected_closing_virtual,
                closed_by, real_closing_cash, real_closing_virtual,
                difference, justification,
            ).await {
                log::warn!("[sync] no se pudo encolar cierre de caja {session_id}: {e}");
            }
        });

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
            "INSERT INTO expenses (uuid, cash_session_id, description, amount, payment_method, store_id, source, created_at) VALUES (?, ?, ?, ?, ?, ?, 'cash_session', datetime('now', 'localtime'))"
        )
        .bind(&expense_uuid)
        .bind(session_id)
        .bind(&description)
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

        let pool = self.pool.clone();
        let description_owned = description;
        let payment_method_owned = payment_method;
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_expense(
                &pool, &expense_uuid, id, session_id, &description_owned, amount, &payment_method_owned,
            ).await {
                log::warn!("[sync] no se pudo encolar gasto de caja {id}: {e}");
            }
        });

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
            "INSERT INTO expenses (uuid, cash_session_id, description, amount, payment_method, category, supplier, store_id, source, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'standalone', datetime('now', 'localtime'))"
        )
        .bind(uuid)
        .bind(&description)
        .bind(amount)
        .bind(&payment_method)
        .bind(&category)
        .bind(&supplier)
        .bind(store_id)
        .execute(&self.pool)
        .await?
        .last_insert_rowid();

        let pool = self.pool.clone();
        let uuid_owned = uuid.to_string();
        let description_owned = description;
        let payment_method_owned = payment_method;
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_expense_standalone(
                &pool, &uuid_owned, id, &description_owned, amount, &payment_method_owned,
                category, supplier,
            ).await {
                log::warn!("[sync] no se pudo encolar gasto general {id}: {e}");
            }
        });

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
        let income_uuid = uuid::Uuid::new_v4().to_string();

        let id = sqlx::query(
            "INSERT INTO other_income (uuid, cash_session_id, description, amount, payment_method, store_id, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))"
        )
        .bind(&income_uuid)
        .bind(session_id)
        .bind(&description)
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

        let pool = self.pool.clone();
        let description_owned = description;
        let payment_method_owned = payment_method;
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_other_income(
                &pool, &income_uuid, id, session_id, &description_owned, amount, &payment_method_owned,
            ).await {
                log::warn!("[sync] no se pudo encolar otro ingreso {id}: {e}");
            }
        });

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

async fn enqueue_cash_session_open(
    pool: &SqlitePool,
    session_uuid: &str,
    id: i64,
    opened_by: i64,
    opening_cash: f64,
    opening_virtual: f64,
) -> Result<(), sqlx::Error> {
    let opened_by_username: Option<String> =
        sqlx::query_scalar("SELECT username FROM users WHERE id = ?")
            .bind(opened_by)
            .fetch_optional(pool)
            .await?;
    let opened_at: String =
        sqlx::query_scalar("SELECT opened_at FROM cash_sessions WHERE id = ?")
            .bind(id)
            .fetch_one(pool)
            .await?;

    let sync = CashSessionSync {
        sync_uuid: session_uuid.to_string(),
        local_session_id: id,
        opened_by_username,
        opened_at,
        closed_by_username: None,
        closed_at: None,
        opening_cash,
        opening_virtual,
        expected_closing_cash: opening_cash,
        expected_closing_virtual: opening_virtual,
        real_closing_cash: None,
        real_closing_virtual: None,
        difference: None,
        justification: None,
        status: "open".to_string(),
    };

    let queue = SyncQueue::new(pool.clone());
    queue
        .enqueue("cash", session_uuid, "cash_session", &id.to_string(), &sync)
        .await
}

#[allow(clippy::too_many_arguments)]
async fn enqueue_cash_session_close(
    pool: &SqlitePool,
    session_uuid: &str,
    session_id: i64,
    opened_by: i64,
    opened_at: &str,
    opening_cash: f64,
    opening_virtual: f64,
    expected_closing_cash: f64,
    expected_closing_virtual: f64,
    closed_by: i64,
    real_closing_cash: f64,
    real_closing_virtual: f64,
    difference: f64,
    justification: Option<String>,
) -> Result<(), sqlx::Error> {
    let closed_at: String =
        sqlx::query_scalar("SELECT closed_at FROM cash_sessions WHERE id = ?")
            .bind(session_id)
            .fetch_one(pool)
            .await?;
    let closed_by_username: Option<String> =
        sqlx::query_scalar("SELECT username FROM users WHERE id = ?")
            .bind(closed_by)
            .fetch_optional(pool)
            .await?;
    let opened_by_username: Option<String> =
        sqlx::query_scalar("SELECT username FROM users WHERE id = ?")
            .bind(opened_by)
            .fetch_optional(pool)
            .await?;

    let sync = CashSessionSync {
        sync_uuid: session_uuid.to_string(),
        local_session_id: session_id,
        opened_by_username,
        opened_at: opened_at.to_string(),
        closed_by_username,
        closed_at: Some(closed_at),
        opening_cash,
        opening_virtual,
        expected_closing_cash,
        expected_closing_virtual,
        real_closing_cash: Some(real_closing_cash),
        real_closing_virtual: Some(real_closing_virtual),
        difference: Some(difference),
        justification,
        status: "closed".to_string(),
    };

    let queue = SyncQueue::new(pool.clone());
    queue
        .enqueue_replace(
            "cash",
            session_uuid,
            "cash_session",
            &session_id.to_string(),
            &sync,
        )
        .await
}

async fn enqueue_expense(
    pool: &SqlitePool,
    expense_uuid: &str,
    id: i64,
    session_id: i64,
    description: &str,
    amount: f64,
    payment_method: &str,
) -> Result<(), sqlx::Error> {
    let cash_session_uuid: Option<String> =
        sqlx::query_scalar("SELECT uuid FROM cash_sessions WHERE id = ?")
            .bind(session_id)
            .fetch_optional(pool)
            .await?;
    let created_at: String =
        sqlx::query_scalar("SELECT created_at FROM expenses WHERE id = ?")
            .bind(id)
            .fetch_one(pool)
            .await?;

    let sync = ExpenseSync {
        sync_uuid: expense_uuid.to_string(),
        cash_session_uuid,
        source: "cash_session".to_string(),
        description: description.to_string(),
        amount,
        payment_method: payment_method.to_string(),
        category: None,
        supplier: None,
        created_at,
    };

    let queue = SyncQueue::new(pool.clone());
    queue
        .enqueue("cash", expense_uuid, "expense", &id.to_string(), &sync)
        .await
}

async fn enqueue_expense_standalone(
    pool: &SqlitePool,
    uuid: &str,
    id: i64,
    description: &str,
    amount: f64,
    payment_method: &str,
    category: Option<String>,
    supplier: Option<String>,
) -> Result<(), sqlx::Error> {
    let created_at: String =
        sqlx::query_scalar("SELECT created_at FROM expenses WHERE id = ?")
            .bind(id)
            .fetch_one(pool)
            .await?;

    let sync = ExpenseSync {
        sync_uuid: uuid.to_string(),
        cash_session_uuid: None,
        source: "standalone".to_string(),
        description: description.to_string(),
        amount,
        payment_method: payment_method.to_string(),
        category,
        supplier,
        created_at,
    };

    let queue = SyncQueue::new(pool.clone());
    queue
        .enqueue("cash", uuid, "expense", &id.to_string(), &sync)
        .await
}

async fn enqueue_other_income(
    pool: &SqlitePool,
    income_uuid: &str,
    id: i64,
    session_id: i64,
    description: &str,
    amount: f64,
    payment_method: &str,
) -> Result<(), sqlx::Error> {
    let cash_session_uuid: Option<String> =
        sqlx::query_scalar("SELECT uuid FROM cash_sessions WHERE id = ?")
            .bind(session_id)
            .fetch_optional(pool)
            .await?;
    let created_at: String =
        sqlx::query_scalar("SELECT created_at FROM other_income WHERE id = ?")
            .bind(id)
            .fetch_one(pool)
            .await?;

    let sync = OtherIncomeSync {
        sync_uuid: income_uuid.to_string(),
        cash_session_uuid,
        description: description.to_string(),
        amount,
        payment_method: payment_method.to_string(),
        created_at,
    };

    let queue = SyncQueue::new(pool.clone());
    queue
        .enqueue("cash", income_uuid, "other_income", &id.to_string(), &sync)
        .await
}
