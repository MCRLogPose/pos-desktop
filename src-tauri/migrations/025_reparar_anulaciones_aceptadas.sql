-- 025_reparar_anulaciones_aceptadas.sql
--
-- Las anulaciones que la Primary ya acepto con una version anterior quedaron
-- con `order_uuid = NULL`: se registro el historial pero la venta nunca se borro,
-- asi que seguia sumando en el efectivo esperado y apareciendo en los movimientos
-- del turno.
--
-- El `uuid` de esas ventas si se puede recuperar en la replica: cuando se
-- aplico la venta, la outbox guardo una fila `topic = 'sales'` cuyo
-- `item_uuid` ES el `uuid` de la venta y cuyo `entity_id` es el id local de esa
-- venta (el mismo `order_id` que quedo en `ventas_anuladas`).
--
-- Con ese cruce se completa el `order_uuid` y se reabre la anulacion para que la
-- Primary vuelva a neutralizar la venta. El reenvio responde `duplicate` (ya
-- estaba en `applied_items`) pero `apply_one_anulacion` vuelve a pasar la
-- neutralizacion justamente para eso.
--
-- Solo corre en replicas: en la Primary `ventas_anuladas.order_id` es un id de
-- la replica y cruzarlo con la outbox local apuntaria a otra venta.
--
-- Si alguna anulacion queda sin `order_uuid` (no habria outbox de la venta), no se
-- reabre: se necesita informacion que no existe en este equipo.

UPDATE ventas_anuladas
SET order_uuid = (
    SELECT o.item_uuid
    FROM sync_outbox o
    WHERE o.topic = 'sales'
      AND o.entity = 'order'
      AND o.item_uuid IS NOT NULL
      AND o.entity_id = CAST(ventas_anuladas.order_id AS TEXT)
)
WHERE order_uuid IS NULL
  AND order_id IS NOT NULL
  AND COALESCE(
        (SELECT value FROM app_config WHERE key = 'operating_mode'),
        'primary'
      ) <> 'primary';

-- Se reabre solo lo que quedo con el uuid resuelto.
UPDATE sync_outbox
SET payload = json_set(payload, '$.order_uuid', (
        SELECT v.order_uuid
        FROM ventas_anuladas v
        WHERE v.uuid = sync_outbox.item_uuid
          AND v.order_uuid IS NOT NULL
    )),
    synced = 0,
    last_error = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE topic = 'anulaciones'
  AND entity = 'venta_anulada'
  AND json_extract(payload, '$.order_uuid') IS NULL
  AND EXISTS (
        SELECT 1
        FROM ventas_anuladas v
        WHERE v.uuid = sync_outbox.item_uuid
          AND v.order_uuid IS NOT NULL
    );