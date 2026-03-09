-- CASH SESSIONS TABLE
CREATE TABLE IF NOT EXISTS cash_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opened_by INTEGER NOT NULL,
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_by INTEGER,
    closed_at DATETIME,
    opening_cash REAL NOT NULL DEFAULT 0.0,
    opening_virtual REAL NOT NULL DEFAULT 0.0,
    expected_closing_cash REAL NOT NULL DEFAULT 0.0,
    expected_closing_virtual REAL NOT NULL DEFAULT 0.0,
    real_closing_cash REAL,
    real_closing_virtual REAL,
    difference REAL,
    justification TEXT,
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed'
    FOREIGN KEY (opened_by) REFERENCES users(id),
    FOREIGN KEY (closed_by) REFERENCES users(id)
);

-- USER SESSIONS TABLE
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    login_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_at DATETIME,
    cash_session_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id)
);

-- EXPENSES TABLE
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cash_session_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL, -- 'cash', 'virtual'
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id)
);

-- OTHER INCOME TABLE
CREATE TABLE IF NOT EXISTS other_income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cash_session_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL, -- 'cash', 'virtual'
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id)
);

-- ADD cash_session_id TO orders
-- Note: SQLite doesn't support adding FK constraints to existing columns easily without recreation.
-- However, for this project, we'll just add the column.
ALTER TABLE orders ADD COLUMN cash_session_id INTEGER REFERENCES cash_sessions(id);
