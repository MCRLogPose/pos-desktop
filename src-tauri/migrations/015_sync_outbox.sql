-- 015_sync_outbox.sql
-- Outbox de sincronizacion de la Replica -> Primary.
-- Cada operacion de escritura en una Replica inserta una fila aqui con su
-- payload JSON y su topic. Al cerrar caja (y/o sync manual), las filas
-- synced=0 se agrupan por topic y se envian a la Primary.
-- Solo se envian los topics que tengan filas pendientes.

CREATE TABLE IF NOT EXISTS sync_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,              -- 'sales' | 'inventory' | 'purchases' | 'cash' | 'catalog' | 'anulaciones'
    item_uuid TEXT NOT NULL,          -- uuid del item (sync_uuid de la entidad)
    entity TEXT,                      -- tabla/entidad de origen (informativo)
    entity_id TEXT,                   -- id local de la entidad (informativo)
    payload TEXT NOT NULL,            -- JSON serializado del item del batch
    synced INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,                  -- ultimo motivo de rechazo/error
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_pending ON sync_outbox(synced, topic);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_topic ON sync_outbox(topic);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_outbox_item ON sync_outbox(item_uuid);
