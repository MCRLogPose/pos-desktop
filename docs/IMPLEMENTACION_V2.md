# VESTIKPOS — Plan de Implementación v2.0

**Fecha:** 2026-07-11  
**Estado:** En progreso

---

## Resumen de Cambios en esta Versión

1. **Modal "Nuevo Lote"** — Reemplaza "Nuevo Producto" con entrada tipo Excel
2. **Tabla `purchase_orders`** — Registro de gastos por compra de mercadería
3. **Sincronización** — Los lotes se incluyen en el sync batch
4. **Arquitectura Primary/Replica** — Documentada, implementación por fases

---

## Fase 1: Lote de Compra (COMPLETADA ✅)

### 1.1 Migración SQL

**Archivo:** `src-tauri/migrations/006_purchase_orders.sql`

Crea dos tablas nuevas:
- `purchase_orders` — Cabecera del lote (proveedor, fecha, alias, total_cost, uuid)
- `purchase_order_items` — Items del lote (producto, cantidad, costo, precio venta)

### 1.2 Backend Rust

**Archivos nuevos:**
- `src-tauri/src/models/purchase_order.rs` — Structs `PurchaseOrder`, `PurchaseOrderItem`, `CreatePurchaseOrderPayload`
- `src-tauri/src/repositories/purchase_order_repo.rs` — CRUD de purchase_orders
- `src-tauri/src/services/purchase_order_service.rs` — Lógica de negocio (crear lote, actualizar stock)
- `src-tauri/src/commands/purchase_order.rs` — Comandos Tauri IPC

**Archivos modificados:**
- `src-tauri/src/models/mod.rs` — Agregar módulo
- `src-tauri/src/repositories/mod.rs` — Agregar módulo
- `src-tauri/src/services/mod.rs` — Agregar módulo
- `src-tauri/src/commands/mod.rs` — Agregar módulo
- `src-tauri/src/lib.rs` — Registrar servicio y comandos

### 1.3 Frontend — Modal "Nuevo Lote"

**Archivo:** `src/features/user/components/modals/ProductModal.tsx` (reescrito)

### 1.4 Verificación

- [x] Migración crea tablas correctamente
- [x] `cargo check` compila sin errores
- [x] Modal muestra campos y tabla de items
- [x] Doble-click rellena campos
- [x] Eliminar item funciona
- [x] "Agregar Lote" crea productos y registro de compra
- [x] Productos aparecen en inventario con stock actualizado

---

## Fase 0: Infraestructura Primary/Replica — Base (COMPLETADA ✅)

### 0.1 Migración SQL
- [x] Crear `009_app_config.sql` con tabla `app_config`

### 0.2 Backend
- [x] `config_service.rs` — Servicio de configuración (has_config, get_operating_mode, set_operating_mode, get_app_config, set_app_config)
- [x] `commands/config.rs` — Comandos Tauri IPC: `has_app_config`, `get_operating_mode`, `set_operating_mode`, `get_app_config`, `set_app_config`
- [x] Registrar en `lib.rs` y `mod.rs`

### 0.3 Frontend
- [x] `ConfigContext.tsx` — Context con `operatingMode`, `isPrimary`, `isReplica`, `isHybrid`, `isConfigured`, `setMode()`
- [x] `ConfigGuard` en `App.tsx` — Detecta si hay configuración, muestra SetupPage o AppRoutes
- [x] `SetupPage.tsx` — Wizard de 2 pasos (selección de modo + confirmación)
- [x] `ModeSelector.tsx` — 3 cards con iconos/colores por modo

### 0.4 Verificación
- [x] Primera ejecución muestra pantalla de selección de modo
- [x] Seleccionar modo guarda en `app_config`
- [x] Modo se carga al reiniciar la app
- [x] `isConfigured` se detecta correctamente

---

## Fase 1.2: Navegación por Modo (COMPLETADA ✅)

### 1.2.1 Frontend
- [x] `navigation.ts` — Función `getNavItems(mode)` que filtra items según modo
- [x] Sidebar usa `useConfig()` y muestra items filtrados
- [x] Navbar usa `useConfig()` y muestra items filtrados

### 1.2.2 Navegación por modo
| Módulo | Primary | Replica | Hybrid |
|--------|---------|---------|--------|
| Dashboard | ✅ | ❌ | ✅ |
| Punto de Venta | ❌ | ✅ | ✅ |
| Ventas | ✅ | ✅ | ✅ |
| Inventario | ✅ | ✅ | ✅ |
| Gastos | ✅ | ❌ | ✅ |
| Finanzas | ❌ | ✅ | ✅ |
| Reportes | ✅ | ❌ | ✅ |
| Tiendas | ✅ (solo lectura) | ✅ | ✅ |
| Configuración | ✅ | ✅ | ✅ |

### 1.2.3 Verificación
- [x] Primary oculta Punto de Venta
- [x] Replica oculta Dashboard, Gastos, Reportes
- [x] Hybrid muestra todo

---

## Fase 1.3: Indicadores Visuales (COMPLETADA ✅)

### 1.3.1 Frontend
- [x] Badge de modo en `SettingsPage.tsx` con color/icono/descripción
- [x] Primary = azul, Replica = verde, Hybrid = púrpura

### 1.3.2 Verificación
- [x] Badge muestra el modo correcto
- [x] Colores diferenciados por modo

---

## Fase 2: Sync Queue - Replica (Documentada)

### 2.1 Backend
- Implementar `sync/queue.rs` — CRUD de `sync_queue`
- Integrar con `sales_service` y `cash_service` para registrar en `sync_queue` al crear venta/cerrar caja
- Implementar `sync/retention.rs` — limpieza de datos antiguos (31 días)
- Implementar job scheduler para sync a las 8pm
- Implementar `sync/client.rs` — enviar batch vía Reqwest

### 2.2 Tablas a sincronizar
| Tabla | Entidad | Descripción |
|-------|---------|-------------|
| `orders` | order | Ventas realizadas |
| `order_items` | order_item | Items de ventas |
| `cash_sessions` | cash_session | Sesiones de caja |
| `expenses` | expense | Gastos registrados |
| `other_income` | other_income | Otros ingresos |
| `products` | product | Cambios de inventario |
| `stores` | store | Edición de tienda asignada |
| `purchase_orders` | purchase_order | Lotes de compra |
| `purchase_order_items` | purchase_order_item | Items de lotes |

### 2.3 Verificación
- [ ] sync_queue registra ventas al crear
- [ ] sync_queue registra caja al cerrar
- [ ] Retención elimina datos > 31 días
- [ ] Scheduler ejecuta sync a las 8pm
- [ ] Client envía batch correctamente

---

## Fase 3: Sync Server - Primary (Documentada)

### 3.1 Backend
- Implementar `sync/server.rs` — Axum server
- Implementar `POST /api/sync` — recibir y aplicar batch
- Implementar `sync_log` y `replica_nodes`
- Implementar endpoints de monitoreo

### 3.2 Verificación
- [ ] Primary inicia servidor HTTP en puerto 8080
- [ ] POST /api/sync recibe y aplica batch
- [ ] sync_log registra sincronizaciones
- [ ] replica_nodes registra nodos conectados

---

## Fase 4: UI y Pulido (Documentada)

### 4.1 Frontend
- Componente `SyncStatusBar` para Replica
- Dashboard global para Primary
- Reportes consolidados en Primary
- Restringir crear/editar/eliminar tiendas en modo Primary

### 4.2 Verificación
- [ ] SyncStatusBar muestra estado de sincronización
- [ ] Dashboard muestra métricas globales en Primary
- [ ] Reportes consolidan datos de todas las tiendas
- [ ] Primary no permite crear/editar/eliminar tiendas

---

## Fase 5: VPN y Deploy (Documentada)

- Configurar WireGuard o Tailscale
- Documentar setup de red
- Testing en producción

---

## Archivos Modificados en esta Versión

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src-tauri/migrations/006_purchase_orders.sql` | NUEVO | Tablas purchase_orders y purchase_order_items |
| `src-tauri/migrations/009_app_config.sql` | NUEVO | Tabla app_config para configuración de modo |
| `src-tauri/src/models/purchase_order.rs` | NUEVO | Structs del modelo |
| `src-tauri/src/models/mod.rs` | MOD | Agregar módulo purchase_order |
| `src-tauri/src/repositories/purchase_order_repo.rs` | NUEVO | Repositorio CRUD |
| `src-tauri/src/repositories/mod.rs` | MOD | Agregar módulo |
| `src-tauri/src/services/purchase_order_service.rs` | NUEVO | Servicio de lotes |
| `src-tauri/src/services/config_service.rs` | NUEVO | Servicio de configuración |
| `src-tauri/src/services/mod.rs` | MOD | Agregar módulo |
| `src-tauri/src/commands/purchase_order.rs` | NUEVO | Comandos Tauri |
| `src-tauri/src/commands/config.rs` | NUEVO | Comandos de configuración |
| `src-tauri/src/commands/mod.rs` | MOD | Agregar módulo |
| `src-tauri/src/lib.rs` | MOD | Registrar servicios y comandos |
| `src/features/user/components/modals/ProductModal.tsx` | REESCRITO | Modal "Nuevo Lote" |
| `src/features/user/pages/InventoryPage.tsx` | MOD | Botón "Nuevo Lote" |
| `src/features/user/constants/navigation.ts` | MOD | Navegación filtrada por modo |
| `src/features/user/components/layouts/Sidebar.tsx` | MOD | Usa getNavItems con modo |
| `src/features/user/components/layouts/Navbar.tsx` | MOD | Usa getNavItems con modo |
| `src/features/user/pages/SettingsPage.tsx` | MOD | Badge de modo |
| `src/features/setup/pages/SetupPage.tsx` | NUEVO | Wizard de selección de modo |
| `src/features/setup/components/ModeSelector.tsx` | NUEVO | Selector de modo |
| `src/context/ConfigContext.tsx` | NUEVO | Context de configuración |
| `src/App.tsx` | MOD | ConfigGuard y providers |
| `src/routes/AppRoutes.tsx` | MOD | Ruta /setup |
| `docs/ARCHITECTURE_DESIGN.md` | MOD | Documentación actualizada |
