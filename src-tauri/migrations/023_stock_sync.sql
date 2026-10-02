-- 023_stock_sync.sql
--
-- El stock es el dato que la Primary nunca recibio: `ProductUpsertSync` transporta
-- la ficha del producto y la cantidad viaja como evento en `StockMovementSync`.
-- Ese canal existia pero no tenia productor, asi que en la Primary todo producto
-- quedaba en 0 (y por debajo de `min_stock`, es decir "agotado").
--
-- El stock viaja como delta, no como valor absoluto: la Primary reconstruye el
-- stock de cada sede sumando los movimientos que envia su replica (un producto
-- pertenece a la sede asignada a esa replica). Copiar el valor absoluto en cada
-- ficha pisaria las ventas ya descontadas; y como la suma es ciega a
-- repeticiones, cada delta debe llegar exactamente una vez.
--
-- Para que esa suma sea correcta, cada replica debe comunicar TODO su stock
-- exactamente una vez. `products.stock_synced` es el contador que lo garantiza:
-- guarda cuanto de este producto ya se le dijo a la Primary, y el comando
-- `force_full_inventory_sync` manda la diferencia (stock - stock_synced).
-- Repetir el comando no duplica nada; solo manda lo que quedo sin comunicar.

ALTER TABLE products ADD COLUMN stock_synced INTEGER NOT NULL DEFAULT 0;

-- Generacion de los movimientos enviados. Es estrictamente creciente y existe
-- solo para derivar el `item_uuid` del movimiento: usando el stock absoluto como
-- clave, un producto que vuelve al mismo stock (se vende y luego se anula esa
-- venta) generaria el mismo item_uuid y la Primary lo tomaria por duplicado,
-- perdiendo el delta. Con la generacion cada movimiento tiene identidad propia,
-- y aun asi es estable ante un reintento del mismo envio.
ALTER TABLE products ADD COLUMN stock_moves_synced INTEGER NOT NULL DEFAULT 0;