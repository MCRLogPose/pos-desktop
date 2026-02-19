/* =========================
   CATEGORIES
========================= */
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

/* =========================
   PRODUCTS
========================= */
DROP TABLE IF EXISTS products;

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  category_id INTEGER,
  price REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER DEFAULT 5,
  unit TEXT DEFAULT 'Unidades',
  image_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

/* Initial Categories */
INSERT OR IGNORE INTO categories (name) VALUES ('Bebidas');
INSERT OR IGNORE INTO categories (name) VALUES ('Comida');
INSERT OR IGNORE INTO categories (name) VALUES ('Postres');
INSERT OR IGNORE INTO categories (name) VALUES ('Otros');
