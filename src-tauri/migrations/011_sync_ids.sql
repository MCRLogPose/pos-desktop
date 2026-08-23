-- 011_sync_ids.sql
-- UUID por fila como clave de idempotencia Replica -> Primary.
-- Evita colisiones de IDs locales (AUTOINCREMENT) entre maquinas.
-- expenses y purchase_orders ya tienen uuid desde 006/007.

ALTER TABLE orders ADD COLUMN uuid TEXT;
UPDATE orders SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_uuid ON orders(uuid);

ALTER TABLE cash_sessions ADD COLUMN uuid TEXT;
UPDATE cash_sessions SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_uuid ON cash_sessions(uuid);

ALTER TABLE other_income ADD COLUMN uuid TEXT;
UPDATE other_income SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_other_income_uuid ON other_income(uuid);

ALTER TABLE users ADD COLUMN uuid TEXT;
UPDATE users SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uuid ON users(uuid);

ALTER TABLE stores ADD COLUMN uuid TEXT;
UPDATE stores SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_uuid ON stores(uuid);

ALTER TABLE products ADD COLUMN uuid TEXT;
UPDATE products SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_uuid ON products(uuid);

ALTER TABLE categories ADD COLUMN uuid TEXT;
UPDATE categories SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_uuid ON categories(uuid);
