/* =========================
   INVENTORY (MOVEMENTS)
========================= */
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  movement_type TEXT NOT NULL, -- IN | OUT | SALE | ADJUST | TRANSFER
  reference_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

/* =========================
   TRANSFERS
========================= */
CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  from_store_id TEXT,
  to_store_id TEXT,
  created_by TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_store_id) REFERENCES stores(id),
  FOREIGN KEY (to_store_id) REFERENCES stores(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transfer_items (
  transfer_id TEXT,
  product_id TEXT,
  quantity INTEGER NOT NULL,
  PRIMARY KEY (transfer_id, product_id),
  FOREIGN KEY (transfer_id) REFERENCES transfers(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
