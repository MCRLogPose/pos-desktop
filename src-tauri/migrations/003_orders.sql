/* =========================
   ORDERS (POS SALES)
   Tabla principal de ventas con metodo de pago
   y documento opcional del cliente (DNI / RUC).
========================= */

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  client_document TEXT,
  client_phone    TEXT,
  client_name     TEXT,
  payment_method  TEXT NOT NULL DEFAULT 'cash',
  subtotal        REAL NOT NULL DEFAULT 0,
  igv             REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

/* =========================
   ORDER ITEMS
   Cada fila es un producto vendido dentro de una orden.
========================= */

CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL,
  product_id   INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  unit_price   REAL NOT NULL,
  quantity     INTEGER NOT NULL,
  subtotal     REAL NOT NULL,
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);
