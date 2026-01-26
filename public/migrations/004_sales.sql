/* =========================
   SALES
========================= */
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  subtotal REAL NOT NULL,
  discount_total REAL DEFAULT 0,
  tax_total REAL DEFAULT 0,
  total REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  sale_id TEXT,
  product_id TEXT,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  discount REAL DEFAULT 0,
  total REAL NOT NULL,
  PRIMARY KEY (sale_id, product_id),
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

/* =========================
   INVOICES (SUNAT READY)
========================= */
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  invoice_number TEXT,
  invoice_type TEXT,
  sunat_status TEXT,
  sunat_response TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);
