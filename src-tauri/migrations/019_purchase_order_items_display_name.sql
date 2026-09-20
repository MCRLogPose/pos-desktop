-- 019_purchase_order_items_display_name.sql
-- Campo "Nombre" (display_name) en los items de lotes de compra.
ALTER TABLE purchase_order_items ADD COLUMN display_name TEXT;