-- 013_anulaciones.sql
-- Registro historico de ventas anuladas.
-- Se conserva la justificacion y los items que se eliminaron para auditoria
-- y para sincronizacion a la Primary (los productos NO se eliminan, por eso
-- items_anulados solo referencia product_id).

CREATE TABLE IF NOT EXISTS ventas_anuladas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid          TEXT NOT NULL,
  order_id      INTEGER,                          -- id de la orden que se anulo (ya eliminada localmente)
  store_id      INTEGER NOT NULL,
  user_id       INTEGER NOT NULL,                 -- usuario que ejecuto la anulacion
  reason        TEXT NOT NULL,                    -- justificacion obligatoria
  payment_method TEXT NOT NULL DEFAULT 'cash',
  subtotal      REAL NOT NULL DEFAULT 0,
  igv           REAL NOT NULL DEFAULT 0,
  total         REAL NOT NULL DEFAULT 0,
  cancelled_at  TEXT DEFAULT (datetime('now','localtime'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_anuladas_uuid ON ventas_anuladas(uuid);

CREATE TABLE IF NOT EXISTS items_anulados (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid            TEXT NOT NULL,
  venta_anulada_id INTEGER NOT NULL,
  product_id      INTEGER NOT NULL,
  product_name    TEXT NOT NULL,
  unit_price      REAL NOT NULL,
  quantity        INTEGER NOT NULL,
  subtotal        REAL NOT NULL,
  FOREIGN KEY (venta_anulada_id) REFERENCES ventas_anuladas(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)       REFERENCES products(id)    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_items_anulados_uuid ON items_anulados(uuid);
CREATE INDEX IF NOT EXISTS idx_items_anulados_anulada ON items_anulados(venta_anulada_id);
