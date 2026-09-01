# VESTIKPOS — Sincronización Réplica → Primary

**Versión:** 1.2.0
**Fecha:** 2026-09-01
**Estado:** Documento de trabajo de la conversión a JSON de sincronización (cliente Réplica). Fase 2.1 (cliente Réplica) **completada**, incluido el refactor de latencia (enqueues en background).

---

## 0. Changelog

- **v1.2.0 (2026-09-01) — Refactor de latencia de UI (background enqueues).** Todos los enqueues de `sync_outbox` que antes corrían de forma **síncrona** en la ruta de escritura (abriendo una conexión separada del pool y haciendo lookups mientras la transacción principal tenía el write-lock, provocando `SQLITE_BUSY` y latencia visible en `POSPage.tsx` al confirmar ventas) se movieron a **tareas en background** con `tauri::async_runtime::spawn`. El patrón: tras `tx.commit()` (o tras la escritura principal en repos autocommit), se clona el pool y los datos necesarios, y el armado del payload + `enqueue` corre en una **función helper libre** asíncrona. Ningún modal de UI vuelve a bloquearse por sincronización.
  - `sales_repo.rs`: `create_order` → post-commit spawn; `anular_venta` similar.
  - `cash_repo.rs`: `open_session`, `close_session`, `add_expense`, `add_expense_standalone`, `add_other_income` → post-commit spawn. `close_session` conserva `enqueue_replace` (mismo `item_uuid` = uuid de sesión) para que el cierre reemplace la apertura pendiente.
  - `inventory_repo.rs`: `create/update_category`, `create/update_product` → spawn background.
  - `purchase_order_repo.rs` + `purchase_order_service.rs`: `create_purchase_order` → spawn background (helper libre `enqueue_purchase_sync`).
  - `store_repo.rs`: `create`/`update` → spawn background (helpers `enqueue_store` / `enqueue_store_by_id`).
  - Además se cambió `db/mod.rs` a `journal_mode=Wal`, `foreign_keys(true)`, `busy_timeout(5s)` y `max_connections(10)`.
  - Verificación: `cargo check` limpio; **17/17 tests OK en 0.22s** (antes ~30s; el WAL también aceleró los tests).

- **v1.1.0 (2026-08-31)** — Cliente Réplica: `sync/queue.rs`, `sync/client.rs`, encolado integrado, disparador en cierre de caja, corrección de `add_expense_standalone`, comando `force_sync_now`.

---

## 1. Propósito

Este documento cataloga **todas las interfaces que un usuario en modo Réplica puede crear, modificar o eliminar**, y las une al mecanismo de sincronización Réplica → Primary. Marca, según los docs de implementación, qué partes del flujo ya están **completadas** y cuáles están **pendientes** en el cliente Réplica.

Decisiones de alcance confirmadas:

1. **Solo se sincroniza lo que se modificó en el turno.** No se envían temas sin cambios.
2. **Rastreo por cola de operaciones (`sync_queue`)**: cada escritura inserta una fila pendiente; al sincronizar se agrupa por `topic`.
3. **La generación de los JSON y el envío ocurren al cerrar la caja (corte).**
4. En Réplica, respecto a **tiendas**: solo se gestiona la **tienda asignada** (no se crean/eliminan más tiendas).
5. **Eliminar producto / categoría**: NO se sincroniza al Primary (es una baja lógica local de la Réplica).
6. **Cambiar contraseña**: NO se sincroniza (el hash es local de cada Réplica).

---

## 2. Navegación visible en Réplica

Según `src/features/user/constants/navigation.ts`, en modo Réplica se muestran:

| Ruta | Página | Rol de datos |
|---|---|---|
| `/dashboard` | DashboardPage | Lectura local |
| `/pos` | POSPage | Escritura (ventas) |
| `/sales` | Ventas | Lectura + anulación |
| `/anulados` | Anulados | Solo lectura |
| `/inventory` | Inventario | Escritura (productos, categorías, stock, lotes) |
| `/finance` | Finanzas | Escritura (caja, gastos, ingresos, corte) |
| `/stores` | StoresPage (de `src/features/stores`) | Escritura (usuarios; tienda asignada) |
| `/settings` | Configuración | Escritura (perfil, contraseña propia) |

No visibles en Réplica: **Gastos**, **Reportes**.

---

## 3. Tópicos de sincronización y tablas

Tópicos definidos en `src-tauri/src/sync/mod.rs` (`SyncTopic`) y payloads en `src-tauri/src/sync/payloads.rs`:

| Topic | Payload | Tablas fuente | Estado |
|---|---|---|---|
| `sales` | `SalesBatch` | orders, order_items | ✅ contrato + server/apply + **cliente Réplica encola** |
| `anulaciones` | `AnulacionesBatch` | ventas_anuladas, items_anulados | ✅ contrato + server/apply + **cliente Réplica encola** |
| `inventory` | `InventoryBatch` | categories, products (upsert), stock_movements | ✅ contrato + server/apply + **cliente Réplica encola** |
| `purchases` | `PurchasesBatch` | purchase_orders, purchase_order_items | ✅ contrato + server/apply + **cliente Réplica encola** |
| `cash` | `CashBatch` | cash_sessions, expenses, other_income | ✅ contrato + server/apply + **cliente Réplica encola** |
| `catalog` | `CatalogBatch` | stores, users | ✅ contrato + server/apply + **cliente Réplica encola** |

> **Estado "✅ ... + cliente Réplica encola"** = el **Primary** (payloads, appliers transaccionales, idempotencia vía `sync_applied_items`, endpoints Axum y auth Bearer) está implementado, **y** el **cliente Réplica** ya registra cada escritura en la outbox (`sync/queue.rs`) y las envía vía `sync/client.rs`.

---

## 4. Catálogo de acciones CRUD en Réplica

Leyenda de estado:
- ✅ **Completado** — ya existe (contrato/servidor/UI) y, si corresponde, encola en la outbox.
- ⏳ **Encolar** — la UI y el comando existen; falta que la operación registre la fila pendiente en `sync_queue`.
- 🐞 **Por corregir** — comportamiento bloqueado/incorrecto que hay que ajustar para el nuevo modelo.
- 🔒 **Local / no se sincroniza** — nunca se envía al Primary.
- ⚠️ **A restringir** — hay que ajustar la UI/backend según las decisiones de alcance.

### 4.1 Ventas (POS + Ventas)

| Acción | Comando Tauri | Tabla(s) que escribe | UI | Estado |
|---|---|---|---|---|
| Crear venta | `create_sale` | orders, order_items, products (stock −), cash_sessions (expected +) | POSPage → CheckoutModal | ✅ + encola → `sales` |
| Anular venta | `anular_venta` | ventas_anuladas, items_anulados; orders/order_items (delete); products (stock +); cash_sessions (expected −) | SalesPage → AnularVentaModal | ✅ + encola → `anulaciones` |

Nota: `anular_venta` con `cashSessionId` ya valida que **solo se pueda anular una venta del turno activo** (implementado en la sesión de trabajo previa).

### 4.2 Anulados

| Acción | Comando | Estado |
|---|---|---|
| Listar / exportar | `get_anulaciones`, `get_all_items_anulados` | ✅ Solo lectura, no sincroniza |

### 4.3 Inventario

| Acción | Comando Tauri | Tabla(s) que escribe | UI | Estado |
|---|---|---|---|---|
| Editar producto | `update_product` | products | InventoryTable → ProductModal (editar) | ✅ + encola → `inventory` (upsert) |
| Agregar stock/mercadería | `update_product` + `add_expense_standalone` | products (stock), expenses | AddStockModal | ✅ + encola → `inventory` + `cash` |
| Crear lote de compra | `create_purchase_order` | purchase_orders, purchase_order_items, products (crea/actualiza), expenses (gasto generado) | ProductModal ("Nuevo Lote") | ✅ + encola → `purchases` (+ `inventory`, + `cash`) |
| Crear categoría | `create_category` | categories | CategoryModal | ✅ + encola → `inventory` |
| Editar categoría | `update_category` | categories | CategoryModal | ✅ + encola → `inventory` |
| Eliminar categoría | `delete_category` | categories (`is_active` o borrado) | CategoryModal | 🔒 **NO se sincroniza** (local Réplica) |
| Eliminar producto | `delete_product` | products (`is_active=0`) | DeleteProductModal | 🔒 **NO se sincroniza** (local Réplica) |

> **Política confirmada:** eliminar producto/categoría solo afecta a la Réplica, no se envía al Primary. La Primary conserva el catálogo completo como fuente de verdad.

### 4.4 Finanzas (caja)

| Acción | Comando Tauri | Tabla(s) que escribe | UI | Estado |
|---|---|---|---|---|
| Abrir caja | `open_cash_session` | cash_sessions | OpenCashModal | ✅ + encola → `cash` |
| Cerrar caja (corte) | `close_cash_session` | cash_sessions | CloseCashModal | ✅ + encola `cash` + **dispara el sync** (ver §6) |
| Registrar ingreso | `add_cash_other_income` | other_income, cash_sessions (expected +) | TransactionModal (ingreso) | ✅ + encola → `cash` |
| Registrar gasto (de sesión) | `add_cash_expense` | expenses, cash_sessions (expected −) | TransactionModal (gasto) | ✅ + encola → `cash` |

### 4.5 Tiendas y Usuarios

| Acción | Comando Tauri | Tabla(s) que escribe | UI | Estado |
|---|---|---|---|---|
| Crear usuario | `create_staff_user` | users, roles, user_roles | UserModal | ✅ + encola → `catalog` |
| Editar usuario | `update_user` | users | UserModal / UserCard / Settings | ✅ + encola → `catalog` |
| Eliminar usuario | `delete_user` | users (`is_active=0`) | UserCard | 🔒 **NO se sincroniza** (baja lógica local Réplica) |
| Crear tienda | `create_store` | stores | StoreModal | ⚠️ **restringir en Réplica** (solo tienda asignada) |
| Editar tienda (asignada) | `update_store` | stores | StoreModal | ✅ + encola → `catalog` (solo asignada) |
| Eliminar tienda | `delete_store` | stores | StoreCard | ⚠️ **restringir en Réplica** |

> **Política confirmada:** una Réplica gestiona **una sola tienda** (la asignada). No crea ni elimina tiendas; solo puede editar la suya, y ese cambio se sincroniza como `catalog`.

### 4.6 Configuración (perfil)

| Acción | Comando | Tabla | Estado |
|---|---|---|---|
| Actualizar perfil propio | `update_user` | users | ✅ + encola → `catalog` |
| Cambiar contraseña | `change_password` | users (password_hash) | 🔒 **NO se sincroniza** (local Réplica) |

---

## 5. Comandos solo-lectura usados por la UI Réplica

No generan sincronización (no escriben): `get_products`, `get_categories`, `get_sales`, `get_sale_detail`, `get_all_order_items`, `get_anulaciones`, `get_all_items_anulados`, `get_active_cash_session`, `get_last_closed_cash_session`, `get_cash_sessions`, `get_cash_session_transactions`, `get_stores`, `get_all_users`.

---

## 6. Momento de sincronización (corte de caja)

1. El usuario realiza operaciones durante el turno. Cada escritura registra una fila pendiente en `sync_outbox` (con su `topic` y payload JSON). Para la caja, la apertura y el cierre usan el mismo `item_uuid` (el `uuid` de la sesión): al cerrar se usa `enqueue_replace` para que el estado final de la sesión reemplace la fila pendiente de la apertura.
2. Al **cerrar la caja** (`close_cash_session`), si el modo es Réplica y el corte es exitoso, se invoca `sync_client.sync_all()`.
3. `sync_all` recopila las filas pendientes (`synced=0`) y las **agrupa por `topic`**; solo los topics con filas pendientes generan y envían su `SyncEnvelope` al Primary (`POST {primary_url}/sync/{topic}` con Bearer token).
4. Por cada ack:
   - `accepted` / `duplicate` → filas marcadas `synced=1`.
   - `rejected` → se conservan `synced=0` y se registra el motivo en `last_error`.
5. Tolerancia a fallos: si no hay red o la Primary está caída, el cierre de caja **no falla** (el error se loguea) y las filas quedan pendientes para el siguiente intento (sync manual `force_sync_now` o próximo cierre).

---

## 7. Resumen de pendientes del cliente Réplica (Fase 2.1)

> ⏳ = falta implementar como parte del cliente Réplica. ✅ = completado.

- [x] Migración 015: tabla `sync_outbox` (`topic`, `item_uuid` UNIQUE, `entity`, `entity_id`, `payload`, `synced`, `last_error`, `created_at`, `updated_at`) e índices.
- [x] `sync/queue.rs`: `SyncQueue` con `is_replica`, `enqueue`, `enqueue_replace` (para que el cierre de caja reemplace la apertura pendiente), `pending`, `mark_synced`, `mark_failed`.
- [x] Encolado en: `create_sale`, `anular_venta`, `create/update_category`, `update_product`, `create_purchase_order`, `open/close_cash_session`, `add_cash_expense`, `add_cash_other_income`, `update_store`, `create_staff_user`, `update_user` (delete sin sync; `delete_user` baja lógica local).
- [x] `sync/client.rs`: `PendingItem` + `topic` + `sync_all()` con Reqwest (`reqwest`/rustls) + Bearer token; agrupa pendientes por topic, arma `SyncEnvelope`, POST a `{primary_url}/sync/{topic}`, procesa acks (`accepted`/`duplicate` → `synced=1`; `rejected` → `synced=0` + motivo).
- [x] Disparador al cerrar caja (`close_cash_session`) en Réplica: tras el corte exitoso llama a `sync_client.sync_all()` (no bloquea si no hay red).
- [x] Comando Tauri `force_sync_now` (sync manual) — `commands/sync.rs`, registrado en `lib.rs`.
- [ ] Configuración en Réplica: `primary_url`, `store_code`, `sync_token`. (Queda pendiente la UI/onboarding que persista estos valores.)
- [x] 🐞 Corregir `add_expense_standalone` para permitirse en Réplica (gasto de mercadería/lotes): ahora usa `reject_in_primary()` y encola un `ExpenseSync` con `cash_session_uuid=None`.
- [x] 🔧 Refactor de **latencia**: enqueues fuera de la ruta síncrona (background con `tauri::async_runtime::spawn`, helpers libres post-commit). Incluye `sales`, `cash`, `inventory`, `purchases`, `store` (v1.2.0).
- [ ] ⚠️ Restringir en Réplica: creación/eliminación de tiendas (solo tienda asignada).

---

## 7b. Pendientes (próxima iteración: pruebas de sincronización en 2 máquinas)

> Estos son los pasos siguientes marcados como **pendientes** al cerrar la iteración de background-enqueues (breakpoint).

**Configuración de la otra máquina (test real Primary ↔ Réplica):**
- [ ] **Réplica (downstream, envío):** configurar/persistir `primary_url`, `store_code`, `sync_token` en la máquina Réplica (UI/onboard o comando; el frontend nunca persiste `store_code` → gap detectado: llega vacío y Primary hace fallback a "primera tienda" en `sync/apply.rs`).
- [ ] **Réplica (envío):** verificar el flujo real Réplica → Primary: registrar una venta / operación de caja en Réplica y confirmar que al cerrar caja (`sync_all`) el Primary recibe y aplica el envelope.
- [ ] **Primary (descarga):** verificar que el Primary descarga/aplica correctamente cada topic (`sales`, `anulaciones`, `inventory`, `purchases`, `cash`, `catalog`) desde la Réplica vía `POST {primary_url}/sync/{topic}` + Bearer, y que los acks (`accepted`/`duplicate`/`rejected`) se procesan y las filas se marcan `synced=1`.
- [ ] **Red/Tailscale:** usar IPs Tailscale — Primary `100.100.162.18`, Réplica `100.107.82.109`, puerto sync 8787; validar que el worker/despliegue del servidor Axum de Primary responde en esa IP.

**Pendientes de diseño de sede/tienda (confirmado pero sin implementar):**
- [ ] Desbloquear `create_store`/`update_store` en **Primary** (hoy `reject_in_primary()` en `commands/store.rs:18,35`).
- [ ] Restringir en Réplica el alta/eliminación de tiendas (solo la asignada).
- [ ] Derivas `store_code` del envelope desde la **tienda asignada** en `sync/client.rs` (en vez de `app_config` vacío).

**Pendiente de robustez offline:**
- [ ] Worker de **reintento automático en background** en Réplica (sync periódico de pendientes, no depender solo del cierre de caja) e inicarlo en `lib.rs` si `mode == "replica"`.

---

## 8. Referencias

- `docs/IMPLEMENTACION_V2.md` — plan de implementación sync (fases 0–5).
- `docs/ARCHITECTURE_DESIGN.md` — diseño y decisiones (Primary/Replica/Hybrid).
- `src-tauri/src/sync/` — módulos `payloads.rs`, `server.rs`, `apply.rs`, `mod.rs`.
- `src-tauri/src/commands/` — comandos Tauri (sales, cash, inventory, store, user, purchase_order).
