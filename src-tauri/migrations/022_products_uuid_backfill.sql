-- 022_products_uuid_backfill.sql
--
-- `create_product` nunca escribio la columna `uuid`: la 011 la relleno con
-- randomblob(16), pero solo para los productos que ya existian en ese momento.
-- Todo producto creado despues quedo con uuid = NULL.
--
-- Eso rompia la sincronizacion del catalogo de dos maneras:
--
--   1. `enqueue_product` lee `p.uuid` como String. Con NULL el decode de sqlx
--      falla, la funcion devuelve Err y el producto nunca se encola. Asi la
--      Primary nunca recibia el `product_upsert` completo.
--   2. El unico producto que llego a encolarse uso item_uuid = '' (NULL mapeado
--      a cadena vacia), que no es una identidad: colisiona con cualquier otro
--      item sin uuid y rompe la idempotencia del outbox.
--
-- La Primary solo terminaba viendo el producto por el topic `purchases`, cuyo
-- stub lo crea sin category_id y con columnas fijas. Por ahi vienen el nombre
-- vacio, la categoria faltante y la cantidad que no cuadra.
--
-- Este relleno les da identidad real. La Primary los va a reciber completos en
-- el siguiente sync, porque los productos con uuid NULL tampoco tenian fila
-- en la outbox.

UPDATE products SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;

-- Los productos sin uuid quedaron con `synced = 0` si llegaron a encolarse con
-- item_uuid vacio. Esa fila es basura: no identifica nada y ya fue marcada.
DELETE FROM sync_outbox
WHERE entity = 'product' AND (item_uuid IS NULL OR item_uuid = '');

-- Reencola cada producto de la replica para que la Primary reciba el catalogo
-- completo. Solo tiene efecto si el equipo opera en modo replica.
--
-- El payload se arma con los mismos campos que usa `enqueue_product`, y el
-- `sync_uuid` del payload es el propio uuid del producto (no vacio), que es lo
-- que la Primary usa como identidad para deduplicar.
--
-- Se generan aqui porque este SQL no puede encolar filas "vacias" con datos
-- completos: el payload es TEXT y hay que armarlo. Se limita a filas de topic
-- 'inventory' para no pisar lotes ni gastos ya aceptados.
INSERT OR IGNORE INTO sync_outbox (topic, item_uuid, entity, entity_id, payload)
SELECT
    'inventory',
    p.uuid,
    'product',
    CAST(p.id AS TEXT),
    json_object(
        'sync_uuid', p.uuid,
        'local_product_id', p.id,
        'code', p.code,
        'name', p.name,
        'display_name', p.display_name,
        'category_name', c.name,
        'price', p.price,
        'cost', p.cost,
        'min_stock', p.min_stock,
        'unit', p.unit,
        'image_url', p.image_url,
        'is_active', p.is_active,
        'supplier_name', p.supplier_name,
        'created_by_username', u.username,
        'origin_device_id', p.origin_device_id,
        'origin_username', p.origin_username,
        'occurred_at', datetime('now', 'localtime')
    )
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN users u ON p.created_by = u.id
WHERE p.is_active = 1
  AND p.uuid IS NOT NULL
  AND EXISTS (
      -- Solo si esta maquina es Replica: en Primary no debe acumular outbox.
      SELECT 1 FROM app_config ac
      WHERE ac.key = 'operating_mode' AND ac.value = 'replica'
  );