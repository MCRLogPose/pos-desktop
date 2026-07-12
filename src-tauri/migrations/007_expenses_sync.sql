-- 007_expenses_sync.sql
-- Gastos: category, supplier, uuid para sync/replicación
-- Tabla sync_queue para offline-first

-- Agregar columnas nuevas a expenses
ALTER TABLE expenses ADD COLUMN category TEXT DEFAULT 'General';
ALTER TABLE expenses ADD COLUMN supplier TEXT;
ALTER TABLE expenses ADD COLUMN uuid TEXT;

-- Backfill UUIDs para registros existentes
UPDATE expenses SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;

-- Hacer uuid UNIQUE NOT NULL después del backfill
-- (SQLite no soporta ALTER COLUMN, se crea tabla temporal)
CREATE TABLE IF NOT EXISTS expenses_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    cash_session_id INTEGER,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    supplier TEXT,
    store_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id),
    FOREIGN KEY (store_id) REFERENCES stores(id)
);

INSERT INTO expenses_new (id, uuid, cash_session_id, description, amount, payment_method, category, supplier, store_id, created_at)
SELECT id, uuid, cash_session_id, description, amount, payment_method, category, supplier, store_id, created_at
FROM expenses;

DROP TABLE expenses;
ALTER TABLE expenses_new RENAME TO expenses;

-- Índices
CREATE INDEX IF NOT EXISTS idx_expenses_store ON expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_uuid ON expenses(uuid);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Tabla sync_queue para replicación offline-first
CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL, -- CREATE | UPDATE | DELETE
    payload TEXT,
    synced INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity);
CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);
