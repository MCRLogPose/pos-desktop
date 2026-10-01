-- 021_product_origin.sql
-- Procedencia del producto: en que maquina y con que usuario se creo.
--
-- `products.store_id` ya existe (005) pero al crear el producto localmente
-- `created_by` solo guarda el id del usuario de ESTA maquina, que en la Primary
-- puede no existir (el admin local nunca se sincroniza, ver apply::upsert_user).
-- Por eso se guarda tambien el username en texto: la UI puede mostrar quien creo
-- el producto aunque el usuario no haya llegado a la Primary.
--
-- Los productos creados antes de esta migracion quedan con origen NULL: la UI
-- los muestra como "Origen desconocido" en vez de inventar un valor.

ALTER TABLE products ADD COLUMN origin_device_id TEXT;
ALTER TABLE products ADD COLUMN origin_username TEXT;