# Estado de la sincronización Réplica → Primary

> **Propósito de este documento:** punto de reanudación. Describe el estado real
> de la sincronización de inventario, qué se corrigió, qué está verificado y qué
> falta. Para el diseño general ver `SINCRONIZACION_REPLICA.md`.

Última actualización: cierre de los pendientes A y B (sin publicar todavía).
Última release publicada: `v0.1.5` (commit `fff54bf`).

---

## 1. Resumen del problema reportado

Síntomas desde la Primary (equipo Hybrid), con la RéplicaConfigured correctamente:

| Síntoma | Estado |
|---|---|
| La Primary reconoce el producto, pero sin atributos | ✅ **Corregido en v0.1.5** |
| La categoría no aparece | ✅ **Corregido en v0.1.5** |
| El costo no coincide | ✅ **Corregido en v0.1.5** |
| La cantidad (stock) no aparece | ✅ **Corregido** (pendiente A) |
| La Réplica tiene 10 productos, la Primary solo 2 | ✅ **Corregido** (pendiente B) |
| La Primary descuenta stock dos veces por venta | ✅ **Corregido** (movimiento sin producto: se rechazaba y no se aplicaba) |
| Los gastos de la réplica aparecen también como ingresos | ✅ **Corregido** (clasificación de payloads por entidad) |

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

## 3. Pendiente A — La cantidad nunca viaja ✅ RESUELTO

**Síntoma:** en la Primary todo producto aparecía con la ficha completa pero con
cantidad 0 (y por debajo de `min_stock`, es decir «agotado»).

### El diagnóstico era correcto

```
claves: category_name, code, cost, created_by_username, display_name, image_url,
        is_active, local_product_id, min_stock, name, occurred_at,
        origin_device_id, origin_username, price, supplier_name, sync_uuid, unit
'stock' presente: False
```

`ProductUpsertSync` transporta la **ficha** y la cantidad viaja como evento en
`StockMovementSync`. Ese canal existía entero —definición, parseo en el cliente,
aplicación en la Primary y hasta un test— pero **ningún repositorio lo producía**.

### Decisión de diseño: el stock viaja como delta, nunca como valor absoluto

El producto vive en la sede que la Primary asignó a esa réplica, y el stock de esa
sede se reconstruye sumando los deltas que envía. Mandar el valor absoluto en cada
ficha pisaría las ventas ya descontadas. Y como la suma es ciega a repeticiones,
cada delta tiene que llegar exactamente una vez: de ahí la importance del
`item_uuid` estable y de la deduplicación en la Primary. Por eso el arreglo **no** fue «sumar la cantidad en el lote de
compra» (que era el paso 1 del orden originalmente sugerido): el lote se aplica en
el topic `purchases` y su movimiento en el topic `inventory`, así que sumar en
ambos lados duplicaría el ingreso de mercadería.

### Qué se implementó

| Punto | Dónde |
|---|---|
| Productor de movimientos, con `item_uuid` derivado del producto + generación | `repositories/inventory_repo.rs` → `enqueue_stock_movement` |
| Alta de producto encola el stock inicial | `create_product` |
| Reposición encola `+cantidad` | `add_stock_to_product` |
| Ajuste manual encola **la diferencia**, no el valor absoluto | `update_product(stock: Option<i64>)` |
| Venta encola `-cantidad`; anulación encola `+cantidad` | `repositories/sales_repo.rs` |
| Baja de producto reencola la ficha con `is_active = 0` | `soft_delete_product` |
| Ingreso de lote NO suma stock (llega por el movimiento) | `sync/apply.rs` → `apply_one_purchase` |
| Alta desde lote hereda categoría y proveedor | `sync/apply.rs` → `resolve_or_create_product_id` |
| Un movimiento cuyo producto no existe lo crea y le aplica el delta | `sync/apply.rs` → `apply_stock_movement` |
| La compra nunca pisa el stock ya vendido | `sync/apply.rs` → `apply_product_upsert` (no toca `stock`) |
| Migración de contadores | `migrations/023_stock_sync.sql` |

### Dos detalles que parecían menores y no lo eran

1. **`item_uuid` no puede derivarse del stock resultante.** Con
   `uuid(producto) + stock` como clave, una venta y su posterior anulación
   producen el mismo `item_uuid`: la Primary responde `duplicate` y el delta se
   pierde para siempre. Se usa `products.stock_moves_synced` como **generación
   monotónica**, que solo avanza.

2. **Un movimiento no puede rechazarse por producto desconocido.** Los encolados
   corren en `spawn` y no hay garantía de orden entre la ficha y el movimiento.
   Antes se respondía `Unknown`, la fila quedaba `synced = 0` para siempre y
   cada venta repetida descontaba stock de más. Ahora se crea el producto y se le
   aplica el delta.

### Verificación

- 52/52 tests Rust (ver la tabla de tests en §6).
- `npx tsc -b --noEmit` limpio; `pnpm lint` sin errores en los archivos tocados
  (los errores restantes son preexistentes en otras pantallas y en assets
  generados dentro de `src-tauri/target`).

---

## 4. Pendiente B — «10 productos en la Réplica, 2 en la Primary» ✅ RESUELTO

### La causa era la misma de siempre: la outbox es un log, no un snapshot

Sí, el problema es de alcance, **pero no porque el sync mande «solo los últimos
cambios»**. Es que `sync_outbox` solo registra lo que se encoló en el momento de
escribirse: un producto que **nunca fue encolado** (creado antes de que existiera
el encolado, o mientras el equipo operaba como Primary) no se enviará nunca, por
muchas sincronizaciones manuales que se lancen.

### Bug encontrado al arreglarlo: la outbox no podía re-encolar

`enqueue` usaba `INSERT OR IGNORE` y hay un índice UNIQUE sobre `item_uuid`, que
para un producto es su `uuid`. La primera vez que el producto se sincronizó, la
fila quedó con `synced = 1`; **toda edición posterior caía contra esa fila y se
descartaba en silencio**. Es decir: el canal de alta funcionaba, pero el de
actualización no. La Primary se quedaba con la primera versión para siempre
(nombre, precio o categoría viejos) y una baja de producto nunca se propagaba.

Ahora `enqueue` hace `ON CONFLICT(item_uuid) DO UPDATE`: refresca el payload y
reabre el envío (`synced = 0`). Si la Primary ya tenía el item, responde
`duplicate`, que el cliente trata igual que `accepted`.

Este bug era el que hacía que «la categoría no aparece» volviera a aparecer: una
corrección de categoría aplicada en la réplica nunca llegaba a la Primary.

### Solución implementada: reconciliación bajo demanda y reutilizable

- Comando Tauri `force_full_inventory_sync` (`commands/sync.rs`) → botón
  **«Reenviar todo el catálogo»** en Configuración → Sincronización, visible
  solo en modo Réplica.
- `inventory_repo.rs` → `reconcile_with_primary()` recorre el catálogo completo y
  reencola cada producto con su `item_uuid` real, por la misma ruta que
  `enqueue_product`.
- **Incluye `is_active = 0`**, que era la limitación pendiente de la migración
  022: dar de baja un producto se propaga como estado, no como ausencia.
- El stock solo manda la **diferencia** entre `products.stock` y
  `products.stock_synced`. Con la migración 023 ambos nacen en 0, así que la
  primera reconciliación recupera todo el inventario acumulado; repetida no
  duplica nada.
- Idempotente y sin efecto en Primary/Hybrid (`reject_in_primary`).

Esto es exactamente la pieza que hacía falta para que «importar catálogo» y
«cambiar de Primary a Réplica» sean operaciones seguras.

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

### Pendientes A y B: implementación y dónde extenderla

- `src-tauri/src/repositories/inventory_repo.rs` → `enqueue_stock_movement`,
  `increase_stock`, `reconcile_with_primary`, `ReconcileReport`.
- `src-tauri/src/repositories/sales_repo.rs` → alta de venta y `anular_venta`
  (cada uno encola su movimiento con la misma función).
- `src-tauri/src/sync/apply.rs` → `apply_stock_movement`,
  `resolve_or_create_product_id`, `apply_product_upsert`, `apply_one_purchase`.
- `src-tauri/src/sync/queue.rs` → `enqueue` (el `ON CONFLICT`) y `pending`.
- `src-tauri/migrations/023_stock_sync.sql` → `stock_synced` y
  `stock_moves_synced`.
- `src-tauri/src/commands/sync.rs` → `force_full_inventory_sync`;
  registrar en `src-tauri/src/lib.rs`.
- UI: `src/services/syncService.ts` y
  `src/features/user/components/modals/SyncSettingsModal.tsx`.

### Lo que sigue abierto

- §5: `uuid` que no se persiste en `expenses`, `purchase_orders`, `orders` y
  `cash_sessions`.
- El worker de reintento automático en background
  (`SINCRONIZACION_REPLICA.md` §7b) sigue sin existir: hoy las filas con error
  solo se reintentan cuando alguien pulsa «Sincronizar ahora».
- Riesgo conocido de concurrencia: si una edición ocurre mientras la anterior
  está en vuelo, `mark_synced` puede marcar como al día la fila que esa misma
  edición reactivó. Hoy no se detecta; la reconciliación lo corrige en el
  siguiente paso, pero la causa (un `generation` por fila en la outbox) sigue
  abierta.

### Comandos
```bash
cd src-tauri && cargo test          # 52 passed
npx tsc -b --noEmit
pnpm build
pnpm tauri build                    # genera NSIS + MSI
```

### Tests que fijan los bugs corregidos

| Test | Qué impediría |
|---|---|
| `crear_producto_encola_el_stock_inicial` | Producto que llega a la Primary con cantidad 0 |
| `reposicion_encola_el_delta_de_stock` | Reposición que no viaja |
| `edicion_de_stock_encola_solo_la_diferencia` | Enviar el valor absoluto y pisar otras réplicas |
| `editar_sin_cambiar_el_stock_no_genera_movimiento` | Ruido de deltas 0 en cada edición de precio |
| `editar_dos_veces_reencola_la_ultima_version` | Primary congelada en la primera versión del producto |
| `venta_y_anulacion_no_repiten_el_item_uuid` | Anulación rechazada como `duplicate`, delta perdido |
| `dar_de_baja_el_producto_se_sincroniza` | Bajas que nunca se propagan |
| `reconciliacion_manda_el_stock_pendiente_y_solo_una_vez` | Duplicar stock al reconciliar dos veces |
| `reconciliacion_incluye_productos_inactivos` | La limitación pendiente de la migración 022 |
| `movimiento_de_stock_crea_el_producto_si_no_existe` | Movimientos atascados en `synced = 0` para siempre |
| `ficha_y_movimiento_deja_el_producto_completo_y_con_stock` | El síntoma reportado, exacto |
| `refrescar_la_ficha_no_revierte_el_stock_ya_vendido` | Reponer lo ya vendido al editar el precio |
| `la_compra_no_duplica_el_stock_del_lote` | Doble conteo del ingreso de mercadería |
| `un_gasto_no_viaja_tambien_como_otro_ingreso` | Gastos duplicados como ingresos en la Primary |

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
| **v0.1.6** (pendiente de publicar) | **Stock como delta + reconciliación de catálogo + outbox re-encolable + clasificación de payloads.** `52/52` tests. |

Todos con tests verdes al momento del cierre de cada versión.

> `v0.1.6` requiere instaladores nuevos en **ambas** máquinas: el receptor (Primary)
> y el emisor (Réplica) ejecutan el mismo binario, y el formato del lote de
> inventario y de la outbox cambió.