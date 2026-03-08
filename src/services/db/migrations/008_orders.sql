/* =========================
   ORDERS (POS SALES)
   Replaces the old `sales` approach with a cleaner
   orders table that includes payment_method and
   optional client_document (DNI / RUC).
========================= */

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  client_document TEXT,                          -- Optional: DNI or RUC
  client_phone    TEXT,                          -- Optional: Phone number
  client_name     TEXT,                          -- Optional: Name
  payment_method  TEXT NOT NULL DEFAULT 'cash',  -- 'cash' | 'card' | 'yape'
  subtotal        REAL NOT NULL DEFAULT 0,
  igv             REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

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
