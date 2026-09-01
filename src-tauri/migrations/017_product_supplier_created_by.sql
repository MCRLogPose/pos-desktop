-- 017_product_supplier_created_by.sql
-- Metadatos del producto: proveedor al que pertenece y usuario que lo agregó.

ALTER TABLE products ADD COLUMN supplier_name TEXT;
ALTER TABLE products ADD COLUMN created_by INTEGER;