-- 012_sync_server.sql
-- Soporte del servidor de sync en la Primary:
-- sync_applied_items: puerta de idempotencia por item (exactly-once)
-- sync_log: bitacora de envelopes recibidos por dispositivo

CREATE TABLE IF NOT EXISTS sync_applied_items (
    sync_uuid TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    device_id TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_sync_applied_topic ON sync_applied_items(topic);
CREATE INDEX IF NOT EXISTS idx_sync_applied_device ON sync_applied_items(device_id);

CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    store_code TEXT,
    topic TEXT NOT NULL,
    item_count INTEGER NOT NULL DEFAULT 0,
    accepted_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    rejected_count INTEGER NOT NULL DEFAULT 0,
    received_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_sync_log_device ON sync_log(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_received ON sync_log(received_at);
