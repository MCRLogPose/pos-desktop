-- 005_multi_store_isolation.sql

-- 1. Ensure a default store exists for existing data
INSERT OR IGNORE INTO stores (id, name, code, address) 
VALUES (1, 'Tienda Principal', 'MAIN', 'Dirección por defecto');

-- 2. Add store_id to products
ALTER TABLE products ADD COLUMN store_id INTEGER REFERENCES stores(id);
UPDATE products SET store_id = 1 WHERE store_id IS NULL;

-- 3. Add store_id to orders
-- Note: users already have store_id, but orders should have it directly for isolation performance 
-- and to track where the order happened even if a user is moved.
ALTER TABLE orders ADD COLUMN store_id INTEGER REFERENCES stores(id);
UPDATE orders SET store_id = 1 WHERE store_id IS NULL;

-- 4. Add store_id to cash_sessions
ALTER TABLE cash_sessions ADD COLUMN store_id INTEGER REFERENCES stores(id);
UPDATE cash_sessions SET store_id = 1 WHERE store_id IS NULL;

-- 5. Add store_id to expenses and other_income (via cash_sessions usually, but direct FK is safer)
ALTER TABLE expenses ADD COLUMN store_id INTEGER REFERENCES stores(id);
UPDATE expenses SET store_id = 1 WHERE store_id IS NULL;

ALTER TABLE other_income ADD COLUMN store_id INTEGER REFERENCES stores(id);
UPDATE other_income SET store_id = 1 WHERE store_id IS NULL;
