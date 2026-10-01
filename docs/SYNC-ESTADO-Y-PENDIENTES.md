# Estado de la sincronización Réplica → Primary

> **Propósito de este documento:** punto de reanudación. Describe el estado real
> de la sincronización de inventario al cierre de `v0.1.5`, qué se corrigió, qué
> está verificado y qué falta. Para el diseño general ver `SINCRONIZACION_REPLICA.md`.

Última actualización: `v0.1.5` (commit `fff54bf`).

---

## 1. Resumen del problema reportado

Síntomas desde la Primary (equipo Hybrid), con la RéplicaConfigured correctamente:

| Síntoma | Estado |
|---|---|
| La Primary reconoce el producto, pero sin atributos | ✅ **Corregido en v0.1.5** |
| La categoría no aparece | ✅ **Corregido en v0.1.5** |
| El costo no coincide | ✅ **Corregido en v0.1.5** |
| La cantidad (stock) no aparece | ❌ **Abierto** |
| La Réplica tiene 10 productos, la Primary solo 2 | ❌ **Abierto** |

---

## 2. Causa raíz del primer bloque (corregida)

### El bug

`create_product` **nunca escribía la columna `products.uuid`**.

La migración `011_sync_ids.sql` la agregó y la rellenó con `lower(hex(randomblob(16)))`,
pero **solo para los productos que existían en ese momento**. Todo producto creado
después quedó con `uuid = NULL`.

### La cadena de consecuencias

1. `enqueue_product` (`repositories/inventory_repo.rs`) lee `p.uuid` con el tipo
   `String` (no opcional). Al recibir `NULL`, el decode de sqlx falla, la función
   devuelve `Err` y **el producto nunca se encola**.
2. El único producto que llegó a encolarse usó `item_uuid = ''`, porque su `NULL`
   se mapeó a cadena vacía. Eso **no es una identidad**: colisiona con cualquier
   otro item sin uuid y rompe la idempotencia del outbox.
3. Sin fila en la outbox, la Primary nunca recibía el `product_upsert` completo.
4. Lo que sí llegaba era el lote (`topic purchases`), y ahí
   `resolve_or_create_product_id` crea el producto con columnas fijas:
   `stock=0`, `min_stock=5`, `unit='Unidades'`, `is_active=1` y **sin `category_id`**.

De ahí los síntomas: categoría y proveedor ausentes, y nombre/costo incompletos.

### El arreglo (v0.1.5)

- `create_product` genera y persiste el `uuid`.
- `update_product` usa `uuid = COALESCE(uuid, ?)`. Rellena el que falta **sin rotar**
  el ya encolado: si rotara, la Primary lo trataría como un producto distinto.
- `enqueue_product` lee `uuid` como `Option<String>` y, si falta, se lo asigna y
  encola igual, en vez de fallar en silencio. Un producto legacy se recupera solo.
- Migración `022_products_uuid_backfill.sql`:
  - Rellena los `uuid` nulos.
  - Borra las filas de outbox con `item_uuid` vacío (no identifican nada).
  - Reencola el catálogo pendiente, **solo si `operating_mode = replica`**, para
    que la Primary no acumule outbox.

### Verificación

- 34/34 tests Rust. Tres nuevos: uuid al crear, recuperación del legacy sin uuid,
  y que una edición normal no rote el uuid.
- `npx tsc -b --noEmit` y `pnpm build` limpios.
- Aplicado sobre la base real de desarrollo: los 3 productos quedaron con uuid y
  encolados con payload completo. Filas basura: 0.

---

## 3. Pendiente A — La cantidad nunca viaja

**Confirmado sobre la base real: el payload de `inventory` no tiene clave `stock`.**

```
claves: category_name, code, cost, created_by_username, display_name, image_url,
        is_active, local_product_id, min_stock, name, occurred_at,
        origin_device_id, origin_username, price, supplier_name, sync_uuid, unit
'stock' presente: False
```

Es coherente con el diseño actual: `ProductUpsertSync` transporta la **ficha** del
producto y el stock viaja como evento separado en `StockMovementSync`
(`sync/payloads.rs`). Ese canal nunca se usa.

### Tres fallas concretas

1. **`StockMovementSync` no tiene productor.**
   Aparece en `payloads.rs` (definición), `client.rs:258` (parseo), `apply.rs:506`
   (aplicación) y `apply_tests.rs:208` (test). **Ningún repositorio lo genera.**
   `add_stock_to_product`, `create_sale` y `anular_venta` no lo encolan.

2. **`apply_one_purchase` no aplica la cantidad.**
   Inserta el lote y sus items (`apply.rs:607`), pero **no hace
   `UPDATE products SET stock = stock + ?`**. En la Primary el producto queda en 0
   aunque la Réplica lo tenga. Es la causa directa de "aún no sale la cantidad".

3. **`resolve_or_create_product_id` crea un producto incompleto** (`apply.rs:194`):
   ```
   INSERT INTO products (..., stock, min_stock, unit, is_active, ...)
   VALUES (?, ?, ?, ?, ?, 0, 5, 'Unidades', 1, ...)
   ```
   Sin `category_id`, sin proveedor, sin origen. Debería heredar del item del lote
   en lugar de hardcodear.

### Orden sugerido

1. Hacer que `apply_one_purchase` sume la cantidad al stock del producto.
   Es el arreglo más pequeño y quita el síntoma reportado.
2. Encolar `StockMovementSync` en `add_stock_to_product` y en el camino de venta.
   Cierra el canal y hace que el stock llegue como evento, no de rebote.
3. Completar el alta desde lote para que herede categoría y proveedor.

> Nota de alcance: el paso 2 toca el camino de venta, que es la parte más
> sensible del sistema (afecta anulaciones e inventario descontado).

---

## 4. Pendiente B — "10 productos en la Réplica, 2 en la Primary"

### La intuición es correcta, pero la causa es más específica

Sí, el problema es de alcance temporal, **pero no porque el sync mande "solo los
últimos cambios"**. Es porque **`sync_outbox` es un log de cambios, no un snapshot**:

- Solo viaja lo que se encoló explícitamente en el momento de escribirse.
- Un producto que **nunca fue encolado** (porque se creó mientras el equipo estaba
  en modo Primary, o antes de que existiera el encolado) **no se enviará nunca**,
  por muchas sincronizaciones manuales que se lancen.

Esto significa que un catálogo acumulado mientras el equipo operaba como Primary
queda huérfano: existe localmente pero jamás se ha encolado.

> La migración 022 reencoló el catálogo **una sola vez**, como efecto puntual.
> No es un mecanismo reutilizable: si mañana se amplía el catálogo mientras el
> está en Primary, y luego se cambia a Réplica, esos productos tampoco se enviarán.

### Riesgo adicional detectado en la migración 022

El `INSERT ... SELECT` filtra por `WHERE p.is_active = 1`. Los productos
**inactivos quedan fuera** y no se reencolan. Hoy no hay ninguno en la base de
desarrollo (`is_active=0: 0`), pero es una limitación a corregir cuando se
generalice el mecanismo.

### Solución propuesta (para hacer más adelante)

Un reencolado **bajo demanda y reutilizable**, no una migración de un solo uso:

- Comando Tauri tipo `force_full_inventory_sync` (o un item de menú en la UI de
  Configuración → Sincronización).
- Recorre el catálogo completo local y encola cada producto **con su `item_uuid`
  real** (= su `uuid`), usando la misma ruta que `enqueue_product`.
- Idempotente: si un producto ya fue aceptado por la Primary, el ack llega como
  `duplicate` y no duplica nada.
- Reencola también `is_active = 0`, para que dar de baja un producto se propague
  como estado, no solo como ausencia.
- Complementa al worker de reintento automático en background que ya está
  pendiente en `SINCRONIZACION_REPLICA.md` §7b.

Esto es exactamente la pieza que falta para que "importar catálogo" y "cambiar de
Primary a Réplica" sean operaciones seguras.

---

## 5. Bug hermano pendiente: `uuid` que no se persiste en otras tablas

Mismo patrón que el de productos, en otras cuatro tablas:

| Tabla | Estado |
|---|---|
| `products` | ✅ Corregido en v0.1.5 |
| `expenses` | ❌ Genera el uuid en memoria, no lo persiste |
| `purchase_orders` | ❌ Igual |
| `orders` | ❌ Igual |
| `cash_sessions` | ❌ Igual |

Consecuencia: su `item_uuid` en la outbox tampoco es una identidad real, así que
la deduplicación del lado Primary es débil para esos topics. Vale la pena revisarlo
con el mismo cuidado que productos, en especial `cash_sessions`, donde
`close_session` ya usa `enqueue_replace` y depende de que el uuid sea estable.

---

## 6. Cómo retomar el trabajo

### Para el pendiente A (cantidad)
- `src-tauri/src/sync/apply.rs` → `apply_one_purchase` (línea ~554) y
  `resolve_or_create_product_id` (línea ~194).
- `src-tauri/src/sync/payloads.rs` → `StockMovementSync` (línea ~107).
- `src-tauri/src/repositories/inventory_repo.rs` → `add_stock_to_product`.
- Tests de referencia: `src-tauri/src/sync/apply_tests.rs` (ya hay un caso con
  `stock_movements` en la línea ~208, sirve de base).

### Para el pendiente B (catálogo incompleto)
- `src-tauri/src/sync/queue.rs` → `enqueue`, `pending`, `is_replica`.
- `src-tauri/migrations/022_products_uuid_backfill.sql` → modelo del `INSERT
  ... SELECT` con `json_object` y el guard de `operating_mode`.
- `src-tauri/src/commands/sync.rs` → donde registrar el comando nuevo.

### Comandos
```bash
cd src-tauri && cargo test          # debe quedar en 34 passed
npx tsc -b --noEmit
pnpm build
pnpm tauri build                    # genera NSIS + MSI
```

### Entorno de la Réplica de desarrollo
```
operating_mode = replica
device_id       = 18562cf9-4944-4fe7-b8b5-0f4c0f87b963
store_code      = Gamarra
primary_url     = http://100.107.82.109:8787
sede en Primary = MAIN-18562cf9
```
Base: `%APPDATA%\com.cruzr.vestikPOS\pos.db` (**en WAL**: copiar solo `pos.db`
no basta, usar la API `backup()` de SQLite para un snapshot consistente).

> La base local de desarrollo tiene 4 productos. Los "10 productos" del reporte
> corresponden a otra máquina; para diagnosticar eso hace falta el dump de esa
> réplica o revisar su outbox.

---

## 7. Estado de releases

| Versión | Contenido |
|---|---|
| v0.1.2 | Identidad de sede por `device_id`. **Obsoleto** (bug de INSERT). |
| v0.1.3 | Fix del INSERT de productos sincronizados. |
| v0.1.4 | Reposición transaccional con costo. |
| **v0.1.5** | **Identidad `uuid` del catálogo + migración 022.** |

Todos con `34/34` tests verdes al momento del cierre de v0.1.5.