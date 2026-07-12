-- 008_expenses_source.sql
-- Separar gastos de caja (Finanzas) de gastos persistentes (GastosPage)

ALTER TABLE expenses ADD COLUMN source TEXT DEFAULT 'standalone';

-- Los gastos existentes con cash_session_id NO NULL son de caja
UPDATE expenses SET source = 'cash_session' WHERE cash_session_id IS NOT NULL;
UPDATE expenses SET source = 'standalone' WHERE cash_session_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_source ON expenses(source);
