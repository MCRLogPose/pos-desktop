/* =========================
   TAXES (IGV / VAT)
========================= */
CREATE TABLE IF NOT EXISTS taxes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rate REAL NOT NULL -- 18.00
);

/* =========================
   PRODUCTS
   image_url = URL remota (Cloudinary/CDN)
   Offline → frontend muestra imagen genérica
========================= */
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  tax_id TEXT,
  image_url TEXT, -- URL remota (NO binarios, NO local)
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tax_id) REFERENCES taxes(id)
);

/* =========================
   DISCOUNTS
========================= */
CREATE TABLE IF NOT EXISTS discounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- PERCENTAGE | FIXED
  value REAL NOT NULL,
  min_quantity INTEGER DEFAULT 0,
  applies_to TEXT NOT NULL, -- PRODUCT | TOTAL
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS product_discounts (
  product_id TEXT,
  discount_id TEXT,
  PRIMARY KEY (product_id, discount_id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (discount_id) REFERENCES discounts(id)
);
