-- 016_split_payments.sql
-- Pagos divididos: una venta (orders) ahora puede pagarse con mas de un
-- metodo de pago (ej. 10 en efectivo + 85 en yape).
-- orders.payment_method se conserva como metadato de compatibilidad/visual
-- (se guarda el metodo con mayor monto), y cada fraccion se registra aqui.
--
-- Para los registros historicos existentes (una sola payment_method y sin
-- fraccion), se crea una fila de pago con el total en ese metodo.

CREATE TABLE IF NOT EXISTS order_payments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid           TEXT NOT NULL,
  order_id       INTEGER NOT NULL,
  payment_method TEXT NOT NULL,          -- 'cash' | 'card' | 'yape'
  amount         REAL NOT NULL DEFAULT 0,
  created_at     TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payments_uuid ON order_payments(uuid);
CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);

-- Backfill: cada orden existente -> una fila de pago con su metodo y total.
INSERT OR IGNORE INTO order_payments (uuid, order_id, payment_method, amount, created_at)
SELECT lower(hex(randomblob(16))), id, payment_method, total, created_at
FROM orders
WHERE NOT EXISTS (SELECT 1 FROM order_payments op WHERE op.order_id = orders.id);
