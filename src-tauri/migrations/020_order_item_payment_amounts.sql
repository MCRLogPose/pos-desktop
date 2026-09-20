-- 020_order_item_payment_amounts.sql
-- Montos por metodo de pago asignados a cada prenda (item).
-- La asignacion es waterfall/FIFO por defecto y puede ser ajustada
-- manualmente por el cajero en el checkout. Se persisten aqui para que
-- el reporte muestre las fracciones por item sin recalcular.
--
-- Las ventas historicas quedan en 0; el reporte las resuelve con waterfall
-- sobre la marcha (suma de fracciones = total de la orden).

ALTER TABLE order_items ADD COLUMN cash_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN card_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN yape_amount REAL NOT NULL DEFAULT 0;