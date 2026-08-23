-- 010_local_timestamps.sql
-- Corrige el desfase de fechas (Peru = UTC-5):
-- SQLite CURRENT_TIMESTAMP guarda en UTC (+5h respecto a Lima),
-- por lo que las ventas y movimientos mostraban fecha/hora adelantadas.
-- 1) Convierte los registros existentes de UTC a hora de Peru.
-- 2) A partir de ahora la app escribe datetime('now','localtime') en cada INSERT.

UPDATE orders       SET created_at = datetime(created_at, '-5 hours') WHERE created_at IS NOT NULL;
UPDATE expenses     SET created_at = datetime(created_at, '-5 hours') WHERE created_at IS NOT NULL;
UPDATE other_income SET created_at = datetime(created_at, '-5 hours') WHERE created_at IS NOT NULL;
UPDATE cash_sessions SET opened_at = datetime(opened_at, '-5 hours') WHERE opened_at IS NOT NULL;
UPDATE cash_sessions SET closed_at = datetime(closed_at, '-5 hours') WHERE closed_at IS NOT NULL;
