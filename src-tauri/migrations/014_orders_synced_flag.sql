-- 014_orders_synced_flag.sql
-- Marca local que indica si una venta ya fue enviada (ack true) a la Primary.
-- Se usa como validacion al anular: una venta ya sincronizada NO puede
-- eliminarse localmente, porque la Primary conservaria el registro y las
-- cantidades no coincidirian.
-- El cliente de sync (Fase 2) debe llamar a mark_orders_synced tras un ack
-- positivo para cada sync_uuid.

ALTER TABLE orders ADD COLUMN synced INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_orders_synced ON orders(synced);
