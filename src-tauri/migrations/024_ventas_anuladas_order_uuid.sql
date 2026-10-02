-- 024_ventas_anuladas_order_uuid.sql
--
-- `anular_venta` en la replica BORRA la venta localmente (orders, order_items y
-- order_payments) y deja el rastro en `ventas_anuladas`. La Primary no hacia lo
-- mismo: al aplicar la anulacion solo insertaba en `ventas_anuladas` e
-- `items_anulados`, sin tocar `orders`. Como la venta sigue ahi, en la Primary:
--
--   * siguio sumando en el total de efectivo / virtual de caja,
--   * siguio apareciendo en la lista de movimientos del turno.
--
-- Para neutralizarla, `apply_one_anulacion` necesita encontrar la venta por su
-- identidad, no por el id local de la replica. Ese identificador ya existe: es
-- `orders.uuid`, que es lo que `apply_one_sale` guardo en la Primary.
ALTER TABLE ventas_anuladas ADD COLUMN order_uuid TEXT;

CREATE INDEX IF NOT EXISTS idx_ventas_anuladas_order_uuid
    ON ventas_anuladas(order_uuid);

-- Nota: las anulaciones ya registradas no se pueden completar. Cuando se
-- aplicaron en la replica, la venta ya habia sido borrada localmente, asi que
-- no hay forma de recuperar su uuid. Quedan con `order_uuid = NULL` y para el
-- historico no cambia nada: la correccion aplica a las nuevas.