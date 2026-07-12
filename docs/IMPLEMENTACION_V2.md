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

## Fase 1: Lote de Compra (ESTA FASE — Implementada)

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

**Flujo del comando `create_purchase_order`:**
1. Recibe payload con items, proveedor, fecha, alias
2. Genera UUID para el lote
3. Inserta en `purchase_orders`
4. Para cada item: inserta en `purchase_order_items`
5. Para cada item: crea o actualiza el producto en `products` (suma stock)
6. Retorna el ID del lote creado

### 1.3 Frontend — Modal "Nuevo Lote"

**Archivo:** `src/features/user/components/modals/ProductModal.tsx` (reescrito)

**UX del modal:**
```
┌─────────────────────────────────────────────────────────────┐
│  Nuevo Lote                                        [X]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Campos del producto ──────────────────────────────────┐ │
│  │ Nombre | SKU | Categoría | Imagen                      │ │
│  │ Stock  | Precio Venta | Precio Costo                   │ │
│  │ [Simulador de Ganancia]                                │ │
│  │                                    [ + Agregar Item ]   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Datos del Lote ───────────────────────────────────────┐ │
│  │ Fecha Lote | Proveedor | Alias                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Items Agregados ──────────────────────────────────────┐ │
│  │ # │ Nombre │ SKU │ Stock │ Costo │ Precio │ Acciones   │ │
│  │ 1 │ Café   │ 001 │   10  │  5.00 │  8.00  │ [🗑️]     │ │
│  │ 2 │ Té     │ 002 │   20  │  3.00 │  6.00  │ [🗑️]     │ │
│  │                                                           │ │
│  │ Doble-click en fila → rellena campos arriba              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  Total Costo del Lote: S/ 110.00                            │
│                                                             │
│                         [ Cancelar ]  [ Agregar Lote ]      │
└─────────────────────────────────────────────────────────────┘
```

**Comportamiento:**
1. Usuario llena campos y presiona "Agregar Item" → item se agrega a la tabla inferior
2. Doble-click en una fila → rellena los campos arriba con esos datos (para editar)
3. Botón 🗑️ elimina el item de la tabla
4. "Agregar Lote" envía todo al backend de una vez
5. Cada item se convierte en un producto (create_product o update_product si ya existe por SKU)
6. Los datos del lote (proveedor, fecha, alias, total) se guardan en `purchase_orders`

### 1.4 Verificación

- [ ] Migración crea tablas correctamente
- [ ] `cargo check` compila sin errores
- [ ] Modal muestra campos y tabla de items
- [ ] Doble-click rellena campos
- [ ] Eliminar item funciona
- [ ] "Agregar Lote" crea productos y registro de compra
- [ ] Productos aparecen en inventario con stock actualizado

---

## Fase 2: Infraestructura Primary/Replica (Documentada)

### 2.1 Migración SQL
- Crear `007_node_config.sql` con tablas: `app_config`, `replica_nodes`, `sync_log`, `sync_queue`, `sync_status`

### 2.2 Backend
- Crear módulo `src-tauri/src/sync/` con: config, models, queue, server, client, scheduler, retention
- Axum server en Primary (puerto 8080)
- Reqwest client en Replica
- Job scheduler para sync a las 8pm

### 2.3 Frontend
- `ConfigContext` para detectar modo
- `NodeSetupPage` para primera ejecución
- `SyncStatusBar` en navbar (Replica)
- Navegación condicional por modo

### 2.4 Verificación
- [ ] Primary inicia servidor HTTP
- [ ] Replica puede conectarse a Primary
- [ ] Sync batch se envía y recibe correctamente
- [ ] UI muestra estado de sincronización

---

## Fase 3: Permisos por Modo (Documentada)

### 3.1 Backend
- Restringir `create_store` en modo Replica
- Restringir `create_product` para usuarios no-ADMIN en Replica
- Bloquear funcionalidad POS/Caja en modo Primary

### 3.2 Frontend
- Navegación condicional
- Ocultar/mostrar botones según modo y rol

---

## Fase 4: Baja de Réplicas (Documentada)

### 4.1 Backend
- Endpoint `POST /api/replicas/disable` en Primary
- Primary deja de aceptar syncs de la Réplica deshabilitada
- Réplica queda en estado `is_active = 0`

### 4.2 Frontend
- Primary: botón para deshabilitar Réplica
- Réplica: mensaje de que fue deshabilitada

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
| `src-tauri/src/models/purchase_order.rs` | NUEVO | Structs del modelo |
| `src-tauri/src/models/mod.rs` | MOD | Agregar módulo purchase_order |
| `src-tauri/src/repositories/purchase_order_repo.rs` | NUEVO | Repositorio CRUD |
| `src-tauri/src/repositories/mod.rs` | MOD | Agregar módulo |
| `src-tauri/src/services/purchase_order_service.rs` | NUEVO | Servicio de lotes |
| `src-tauri/src/services/mod.rs` | MOD | Agregar módulo |
| `src-tauri/src/commands/purchase_order.rs` | NUEVO | Comandos Tauri |
| `src-tauri/src/commands/mod.rs` | MOD | Agregar módulo |
| `src-tauri/src/lib.rs` | MOD | Registrar servicio y comandos |
| `src/features/user/components/modals/ProductModal.tsx` | REESCRITO | Modal "Nuevo Lote" |
| `src/features/user/pages/InventoryPage.tsx` | MOD | Botón "Nuevo Lote" |
| `docs/ARCHITECTURE_DESIGN.md` | MOD | Decisiones tomadas |
