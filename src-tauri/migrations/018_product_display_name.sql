-- 018_product_display_name.sql
-- Campo "Nombre" (Name) adicional y opcional para productos.
-- No puede llamarse exactamente `Name` porque SQLite trata los nombres de
-- columna como case-insensitive y ya existe `name`.
ALTER TABLE products ADD COLUMN display_name TEXT;