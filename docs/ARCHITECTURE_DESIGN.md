# VESTIKPOS — Diseño de Arquitectura: Modos de Configuración

**Versión:** 0.3.0  
**Fecha:** 2026-07-11  
**Estado:** Documento de diseño (decisiones tomadas, pre-implementación)

---

## 1. Resumen Ejecutivo

El sistema VESTIKPOS soportará tres modos de operación al momento de la instalación:

| Modo | Alias | Rol | Almacenamiento | Ventas | Caja | Sincronización |
|------|-------|-----|----------------|--------|------|----------------|
| **Primary** | Central | Servidor central | Ilimitado | No | No | Recibe datos |
| **Replica** | Nodo | Terminal de venta | Limitado (30-31 días) | Sí | Sí | Envía datos |
| **Hybrid** | Independiente | Estación completa | Ilimitado | Sí | Sí | No aplica |

---

## 2. Contexto y Problema

### Situación actual
- La app es 100% local (SQLite, sin sincronización)
- La tabla `sync_queue` existe en migraciones legacy pero no está activa
- No hay distinción entre nodos primarios y réplicas

### Problema a resolver
- Las terminales de venta (Replica) tienen almacenamiento limitado
- Se necesita centralizar datos en una computadora con más almacenamiento (Primary)
- La Primary no debe generar ventas para evitar conflictos de datos
- Las máquinas no siempre tienen acceso a internet — la sincronización debe ser tolerante a fallos de red

### Objetivo
- Instalar VESTIKPOS en una laptop con poco almacenamiento (Replica)
- Enviar diariamente las ventas a una computadora central (Primary)
- La Primary genera reportes y almacena histórico completo
- Soporte para negocios sin necesidad de red (Hybrid)

---

## 3. Definición de Modos

### 3.1 Primary (Computadora Central)

**Propósito:** Almacenar toda la información del negocio, generar reportes, servir como fuente de verdad.

**Características:**
- Almacenamiento ilimitado (sin retención de datos)
- Recibe sincronizaciones de nodos Replica
- Procesa y aplica cambios recibidos
- Genera reportes consolidados
- **NO puede realizar ventas ni sesiones de caja**

**Restricciones de UI:**
- Ocultar/deshabilitar módulo POS (ventas)
- Ocultar/deshabilitar módulo de Caja
- Mostrar módulo de Reportes con datos consolidados de todas las tiendas
- Mostrar módulo de Inventario (lectura/escritura)
- Mostrar módulo de Dashboard con métricas globales
- Mostrar módulo de Configuración (tiendas, usuarios)
- Mostrar estado de sincronización (última sincronización, nodos conectados)

**Base de datos:**
- Tablas completas: stores, users, products, orders, cash_sessions, etc.
- Tabla `sync_log` para auditoría de sincronizaciones recibidas
- Datos históricos sin límite de retención
- Tabla `replica_nodes` para registrar nodos conocidos

### 3.2 Replica (Nodo de Venta)

**Propósito:** Terminal de punto de venta ligera que envía datos diariamente a la Primary.

**Características:**
- Almacenamiento limitado: retiene solo 30-31 días de datos
- Realiza ventas y gestiona caja
- Envía sincronización diaria a las 8pm (si la caja se cerró exitosamente)
- Opera 100% offline, sincroniza cuando hay internet
- Asociado a UNA tienda específica (no puede cambiar de tienda)

**Restricciones de UI:**
- POS: habilitado
- Caja: habilitado
- Reportes: limitados a la tienda asignada y rango de 30 días
- Dashboard: limitado a la tienda asignada
- Configuración: solo perfil de usuario (no puede crear tiendas ni usuarios)
- Inventario: solo lectura para la tienda asignada
- Indicador de estado de sincronización en la barra de navegación

**Base de datos:**
- Tablas completas pero con retención de 30-31 días
- Tabla `sync_queue` activa: registra cada venta/cierre de caja para envío
- Job de limpieza automática elimina registros antiguos
- Tabla `sync_status` para rastrear qué fue enviado y qué pendiente

**Política de retención:**
```sql
-- Se ejecuta diariamente después de la sincronización exitosa
DELETE FROM orders WHERE created_at < date('now', '-31 days');
DELETE FROM order_items WHERE order_id NOT IN (SELECT id FROM orders);
DELETE FROM cash_sessions WHERE closed_at < date('now', '-31 days') AND status = 'closed';
DELETE FROM sync_queue WHERE synced = 1 AND created_at < date('now', '-31 days');
```

### 3.3 Hybrid (Independiente)

**Propósito:** Estación de venta completa sin dependencia de red ni sincronización.

**Características:**
- Almacenamiento ilimitado
- Funcionalidad completa: ventas, caja, inventario, reportes
- No requiere sincronización (no hay nodos Replica)
- Autónomo: todo el control en un solo punto

**Restricciones de UI:**
- Ninguna — todas las funcionalidades disponibles
- No mostrar módulo de sincronización ni estado de nodos
- Reportes solo con datos locales

**Base de datos:**
- Tablas completas
- `sync_queue` desactivada (no se usa)
- Sin tablas de sincronización

---

## 4. Arquitectura de Sincronización

### 4.1 Stack Tecnológico

| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| HTTP Server (Primary) | **Axum** | Framework Rust asíncrono, ligero, type-safe |
| Async Runtime | **Tokio** | Ya es dependencia de Tauri/sqlx |
| HTTP Client (Replica) | **Reqwest** | Cliente HTTP asíncrono para enviar sincronizaciones |
| Serialización | **Serde** | Ya en el proyecto |
| Identificadores | **UUID** | Ya en el proyecto, para IDs de sincronización |
| Red privada | **VPN** (WireGuard/Tailscale) | Conectar máquinas en diferentes zonas como si fueran LAN |

### 4.2 Topología de Red

```
┌─────────────────────────────────────────────────────────┐
│                    Red Privada (VPN)                     │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │   Replica A   │    │   Replica B   │    │ Primary  │  │
│  │  (Laptop)     │    │  (Laptop)     │    │ (Desktop)│  │
│  │  Tienda: "SUC01"│  │  Tienda: "SUC02"│  │ Central  │  │
│  │               │    │               │    │          │  │
│  │  8pm → envía  │    │  8pm → envía  │  │ ← recibe │  │
│  └──────────────┘    └──────────────┘    └──────────┘  │
│                                                         │
│  IP VPN: 10.0.0.10    IP VPN: 10.0.0.20   10.0.0.1    │
└─────────────────────────────────────────────────────────┘
```

**Discovery de Primary:**
- Al configurar una Replica, se ingresa la IP de la Primary (o hostname via VPN)
- Se guarda en `settings.json` o tabla `app_config`
- Formato: `http://<ip-primary>:<port>` (ej: `http://10.0.0.1:8080`)

### 4.3 Protocolo de Sincronización

#### 4.3.1 Flujo Replica → Primary

```
Replica (8pm)                         Primary
    │                                     │
    ├── 1. Verificar caja cerrada ────────┤
    │   (cash_session.status = 'closed')  │
    │                                     │
    ├── 2. Empaquetar sync_batch ─────────┤
    │   {                                 │
    │     replica_id: UUID,               │
    │     store_id: i64,                  │
    │     timestamp: DateTime,            │
    │     orders: [...],                  │
    │     cash_sessions: [...],           │
    │     inventory_changes: [...]        │
    │   }                                 │
    │                                     │
    ├── 3. POST /api/sync ───────────────►│
    │                                     ├── 4. Validar replica_id
    │                                     ├── 5. Aplicar cambios en transacción
    │                                     ├── 6. Registrar en sync_log
    │◄── 7. 200 OK { applied: N } ────────┤
    │                                     │
    ├── 8. Marcar sync_queue.synced=1 ────┤
    ├── 9. Ejecutar limpieza (31 días) ───┤
    │                                     │
```

#### 4.3.2 Endpoints API (Primary)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/sync` | Recibe lote de sincronización desde Replica |
| `GET` | `/api/sync/status` | Estado de sincronización (para monitoreo) |
| `GET` | `/api/replicas` | Lista de nodos Replica registrados |
| `POST` | `/api/replicas/register` | Registrar nuevo nodo Replica |
| `GET` | `/api/health` | Health check |

#### 4.3.3 Estructura del Sync Batch

```rust
#[derive(Serialize, Deserialize)]
pub struct SyncBatch {
    pub batch_id: Uuid,
    pub replica_id: Uuid,
    pub store_id: i64,
    pub timestamp: DateTime<Utc>,
    pub orders: Vec<SyncOrder>,
    pub cash_sessions: Vec<SyncCashSession>,
    pub inventory_snapshot: Vec<SyncInventoryChange>,
    pub purchase_orders: Vec<SyncPurchaseOrder>,  // Lotes de compra
}

#[derive(Serialize, Deserialize)]
pub struct SyncOrder {
    pub id: String,          // UUID local
    pub user_id: i64,
    pub client_document: Option<String>,
    pub client_phone: Option<String>,
    pub client_name: Option<String>,
    pub payment_method: String,
    pub items: Vec<SyncOrderItem>,
    pub subtotal: f64,
    pub igv: f64,
    pub total: f64,
    pub cash_session_id: Option<i64>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct SyncOrderItem {
    pub product_id: i64,
    pub product_name: String,
    pub unit_price: f64,
    pub quantity: i64,
    pub subtotal: f64,
}

#[derive(Serialize, Deserialize)]
pub struct SyncCashSession {
    pub id: i64,
    pub opened_by: i64,
    pub opened_at: DateTime<Utc>,
    pub closed_by: Option<i64>,
    pub closed_at: Option<DateTime<Utc>>,
    pub opening_cash: f64,
    pub opening_virtual: f64,
    pub expected_closing_cash: f64,
    pub expected_closing_virtual: f64,
    pub real_closing_cash: Option<f64>,
    pub real_closing_virtual: Option<f64>,
    pub difference: Option<f64>,
    pub justification: Option<String>,
    pub store_id: i64,
    pub expenses: Vec<SyncExpense>,
    pub other_income: Vec<SyncOtherIncome>,
}

#[derive(Serialize, Deserialize)]
pub struct SyncInventoryChange {
    pub product_id: i64,
    pub stock_change: i64,  // delta, no snapshot absoluto
    pub reason: String,     // "sale", "adjustment", "return"
    pub order_id: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct SyncPurchaseOrder {
    pub id: String,          // UUID local
    pub store_id: i64,
    pub supplier_name: Option<String>,
    pub batch_date: String,
    pub alias: Option<String>,
    pub total_cost: f64,
    pub items: Vec<SyncPurchaseItem>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct SyncPurchaseItem {
    pub product_id: i64,
    pub product_name: String,
    pub sku: Option<String>,
    pub category_id: Option<i64>,
    pub quantity: i64,
    pub unit_cost: f64,
    pub unit_price: f64,
}
```

### 4.4 Manejo de Conflictos

**Reglas de resolución:**
1. **Ventas:** La Replica es autoritativa — la Primary acepta tal cual
2. **Inventario:** La Primary recalcula stock basado en las ventas recibidas
3. **Caja:** La Replica es autoritativa — la Primary almacena para reportes
4. **Productos:** La Primary es autoritativa — las Replica solo leen
5. **Usuarios/Tiendas:** La Primary es autoritativa — las Replica solo leen
6. **Lotes de Compra (purchase_orders):** La Replica es autoritativa — la Primary almacena para reportes. El stock se actualiza en la Replica al crear el lote.

**No hay conflictos de escritura concurrente** porque:
- Solo la Primary puede modificar productos, usuarios, tiendas
- Solo las Replica generan ventas y cajas
- La Primary no genera ventas (regla estricta)

### 4.5 Tolerancia a Fallos de Red

```
Replica:
  ├── Intento 1: envía sync_batch
  │   ├── Éxito → marca synced=1, limpia
  │   └── Fallo → reintenta en 5 minutos
  ├── Intento 2: reintento
  │   ├── Éxito → OK
  │   └── Fallo → reintenta en 15 minutos
  ├── Intento 3: reintento
  │   ├── Éxito → OK
  │   └── Fallo → reintenta en 30 minutos
  ├── ... (máximo 10 intentos por día)
  └── Si falla todo el día:
      └── Los datos permanecen en sync_queue
          Se reintenta al día siguiente a las 8pm
          Si hay internet → envía todo el batch acumulado
```

**Primary:**
- Recibe sync_batch y procesa en transacción SQL atómica
- Si falla la aplicación → rechaza el batch (la Replica reintenta)
- No procesa batches duplicados (verifica `batch_id`)

---

## 5. Cambios en la Base de Datos

### 5.1 Nueva migración: `009_config_modes.sql`

```sql
-- Configuración del modo de operación
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Valores iniciales (se insertan al crear la DB según el modo)
-- 'operating_mode': 'primary' | 'replica' | 'hybrid'
-- 'replica_id': UUID del nodo (solo Replica)
-- 'primary_url': URL de la Primary (solo Replica)
-- 'store_id': tienda asociada (solo Replica)
-- 'retention_days': 31 (solo Replica)

-- Registro de nodos Replica (solo en Primary)
CREATE TABLE IF NOT EXISTS replica_nodes (
    id TEXT PRIMARY KEY,           -- UUID
    name TEXT NOT NULL,
    store_id INTEGER NOT NULL,
    last_sync_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Log de sincronizaciones (solo en Primary)
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,        -- UUID del batch recibido
    replica_id TEXT NOT NULL,
    store_id INTEGER NOT NULL,
    orders_count INTEGER NOT NULL,
    cash_sessions_count INTEGER NOT NULL,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'success', -- 'success' | 'error'
    error_message TEXT,
    FOREIGN KEY (replica_id) REFERENCES replica_nodes(id),
    FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Cola de sincronización (solo en Replica)
CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,           -- UUID
    entity TEXT NOT NULL,          -- 'order' | 'cash_session' | 'inventory' | 'purchase_order'
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,          -- 'CREATE' | 'UPDATE'
    payload TEXT NOT NULL,         -- JSON serializado
    synced INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_log_replica ON sync_log(replica_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_closed ON cash_sessions(closed_at);
```

### 5.3 Migración adicional: `007_purchase_orders.sql`

```sql
-- Gastos por compra de mercadería (Lotes)
-- Cada registro representa un lote de productos recibidos de un proveedor
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,         -- UUID para sincronización
    store_id INTEGER NOT NULL,
    supplier_name TEXT,                -- Proveedor
    batch_date TEXT NOT NULL,          -- Fecha del lote
    alias TEXT,                        -- Alias del lote
    total_cost REAL NOT NULL DEFAULT 0,-- Costo total del lote
    created_by INTEGER,                -- Usuario admin que creó
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Items del lote (cada fila es un producto en el lote)
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL,
    product_id INTEGER,                -- NULL si es producto nuevo
    product_name TEXT NOT NULL,
    sku TEXT,
    category_id INTEGER,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost REAL NOT NULL DEFAULT 0, -- Precio de costo unitario
    unit_price REAL NOT NULL DEFAULT 0,-- Precio de venta unitario
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_purchase_orders_store ON purchase_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_uuid ON purchase_orders(uuid);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);
```

### 5.2 Migraciones existentes que se mantienen

Las migraciones 001-008 se mantienen sin cambios. La nueva migración 009 se ejecuta después.

---

## 6. Cambios en el Backend (Rust)

### 6.1 Nuevas dependencias en `Cargo.toml`

```toml
[dependencies]
# ... existentes ...
axum = "0.7"           # HTTP server para Primary
tower-http = { version = "0.5", features = ["cors", "trace"] }  # Middleware
reqwest = { version = "0.12", features = ["json"] }  # HTTP client para Replica
tokio-cron-scheduler = "0.10"  # Job scheduler para sync a las 8pm
```

### 6.2 Nueva estructura de módulos

```
src-tauri/src/
├── sync/
│   ├── mod.rs
│   ├── config.rs          # Lectura de app_config
│   ├── models.rs          # SyncBatch, SyncOrder, etc.
│   ├── queue.rs           # Gestión de sync_queue (Replica)
│   ├── server.rs          # Axum server (Primary)
│   ├── client.rs          # Reqwest client (Replica)
│   ├── scheduler.rs       # Job scheduler para sync
│   ├── retention.rs       # Limpieza de datos antiguos (Replica)
│   └── handlers/
│       ├── mod.rs
│       ├── sync.rs        # POST /api/sync
│       ├── health.rs      # GET /api/health
│       └── replicas.rs    # GET/POST /api/replicas
```

### 6.3 Configuración del modo en `lib.rs`

```rust
// En setup(), según app_config:
match config.operating_mode {
    OperatingMode::Primary => {
        // Iniciar Axum server
        let router = sync::server::build_router(pool.clone());
        let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
        tauri::async_runtime::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        });
    }
    OperatingMode::Replica => {
        // Iniciar scheduler de sincronización
        let scheduler = sync::scheduler::SyncScheduler::new(pool.clone(), config.clone());
        tauri::async_runtime::spawn(async move {
            scheduler.start().await;
        });
    }
    OperatingMode::Hybrid => {
        // No hacer nada especial
    }
}
```

### 6.4 Comandos Tauri nuevos

| Comando | Modo | Descripción |
|---------|------|-------------|
| `get_operating_mode` | All | Retorna el modo actual |
| `get_sync_status` | Replica | Estado de la última sincronización |
| `force_sync_now` | Replica | Forzar sincronización manual |
| `get_sync_log` | Primary | Historial de sincronizaciones recibidas |
| `get_replica_nodes` | Primary | Lista de nodos registrados |
| `register_replica` | Primary | Registrar nuevo nodo Replica |
| `get_app_config` | All | Obtener configuración general |
| `update_app_config` | Primary/Hybrid | Actualizar configuración |

---

## 7. Cambios en el Frontend

### 7.1 Nuevo contexto: `ConfigContext`

```typescript
interface ConfigContextType {
  operatingMode: 'primary' | 'replica' | 'hybrid';
  isPrimary: boolean;
  isReplica: boolean;
  isHybrid: boolean;
  syncStatus: SyncStatus | null;
  replicaNodes: ReplicaNode[];
}
```

### 7.2 Navegación condicional por modo

```typescript
// src/features/user/constants/navigation.ts

const baseNavigation = [
  { path: '/home', label: 'Inicio', icon: Home },
  { path: '/inventory', label: 'Inventario', icon: Package },
  { path: '/reports', label: 'Reportes', icon: BarChart3 },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/stores', label: 'Tiendas', icon: Store },
  { path: '/settings', label: 'Configuración', icon: Settings },
];

const replicaOnly = [
  { path: '/pos', label: 'Punto de Venta', icon: ShoppingCart },
  { path: '/finance', label: 'Caja', icon: Wallet },
  { path: '/sales', label: 'Ventas', icon: Receipt },
];

const hybridOnly = [
  { path: '/pos', label: 'Punto de Venta', icon: ShoppingCart },
  { path: '/finance', label: 'Caja', icon: Wallet },
  { path: '/sales', label: 'Ventas', icon: Receipt },
];

// Primary: sin POS, sin Caja, sin Ventas
// Replica: con POS, Caja, Ventas (limitados a tienda)
// Hybrid: todo
```

### 7.3 Componente de estado de sincronización

```typescript
// src/features/sync/components/SyncStatusBar.tsx
// Se muestra solo en modo Replica en la barra de navegación

// Muestra:
// - Índice de conexión (verde/amarillo/rojo)
// - Última sincronización exitosa
// - Envíos pendientes (si los hay)
// - Botón de sincronización manual
```

### 7.4 Página de configuración de sincronización (Primary)

```typescript
// src/features/sync/pages/SyncConfigPage.tsx
// Se muestra solo en modo Primary

// Muestra:
// - Lista de nodos Replica registrados
// - Última sincronización de cada nodo
// - Log de sincronizaciones
// - Botón para registrar nuevo nodo
```

---

## 8. Flujo de Instalación

### 8.1 Primera ejecución

```
Al abrir VESTIKPOS por primera vez:
  1. Detectar que no existe app_config
  2. Mostrar pantalla de selección de modo:
     ┌─────────────────────────────────────┐
     │     Selecciona el modo de uso       │
     │                                     │
     │  ┌───────────┐  ┌───────────┐      │
     │  │  PRIMARY   │  │  REPLICA  │      │
     │  │  (Central) │  │  (Nodo)   │      │
     │  │            │  │           │      │
     │  │ Almacena   │  │ Vende     │      │
     │  │ reportes   │  │ envía     │      │
     │  │ todo       │  │ datos     │      │
     │  └───────────┘  └───────────┘      │
     │                                     │
     │  ┌───────────┐                     │
     │  │  HYBRID    │                     │
     │  │ (Completo) │                     │
     │  │            │                     │
     │  │ Todo en    │                     │
     │  │ un solo    │                     │
     │  │ punto      │                     │
     │  └───────────┘                     │
     └─────────────────────────────────────┘

  3. Según selección:
     - Primary: preguntar puerto del servidor (default 8080)
     - Replica: preguntar:
       a. UUID del nodo (generar o importar)
       b. URL de la Primary (ej: http://10.0.0.1:8080)
       c. Tienda asociada (seleccionar de las existentes)
     - Hybrid: preguntar nombre del negocio (opcional)

  4. Crear app_config con los valores seleccionados
  5. Ejecutar migraciones
  6. Continuar al login
```

### 8.2 Cambio de modo

**No se permite cambiar de modo después de la instalación.** Si se necesita cambiar, se debe:
1. Exportar datos relevantes
2. Desinstalar la app
3. Reinstalar con el nuevo modo

**Razón:** Cambiar de Replica a Primary requeriría migrar datos históricos y cambiar la estructura de retención. Cambiar de Primary a Replica requeriría purgar datos antiguos. Es más seguro reinstalar.

---

## 9. Seguridad

### 9.1 Autenticación entre nodos

- La Primary acepta sync_batch solo de nodos registrados (verifica `replica_id` en `replica_nodes`)
- Cada Replica tiene un UUID único generado en la instalación
- Comunicación HTTP sobre VPN (no HTTPS necesario en red privada, pero se puede agregar)

### 9.2 Autorización

- La Replica solo puede enviar datos (POST /api/sync)
- La Primary puede leer/reportar (GET endpoints)
- No hay autenticación de usuario entre nodos — la seguridad es a nivel de red (VPN)

### 9.3 Integridad de datos

- Cada sync_batch tiene un `batch_id` UUID único
- La Primary verifica que no procese batches duplicados
- Los payloads se validan antes de insertar en la BD

---

## 10. Rendimiento y Escalabilidad

### 10.1 Límites

| Métrica | Replica | Primary | Hybrid |
|---------|---------|---------|--------|
| Tiendas simultáneas | 1 | Todas registradas | 1 |
| Usuarios concurrentes | Limitado por hardware | Limitado por hardware | Limitado por hardware |
| Sync batch máximo | ~1000 órdenes/día | N/A | N/A |
| Retención datos | 31 días | Ilimitada | Ilimitada |

### 10.2 Optimizaciones

- **Batch compression:** Los sync_batch se comprimen antes de enviar (gzip)
- **Incremental sync:** Solo se envían cambios, no snapshots completos
- ** índices en Created_at:** Para consultas de retención por fecha
- **Connection pooling:** Axum maneja conexiones concurrentes de múltiples Réplicas

---

## 11. Diagrama de Arquitectura Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                         RED PRIVADA (VPN)                       │
│                                                                 │
│  ┌─────────────────────┐         ┌─────────────────────────┐   │
│  │      REPLICA A       │         │        PRIMARY           │   │
│  │   (Laptop Tienda)    │         │    (Desktop Central)     │   │
│  │                      │         │                          │   │
│  │  ┌────────────────┐  │  HTTP   │  ┌────────────────────┐  │   │
│  │  │   Tauri App     │  │────────►  │   Axum Server       │  │   │
│  │  │   (Frontend)    │  │  8pm     │   (API REST)         │  │   │
│  │  └────────────────┘  │  sync    │  └────────────────────┘  │   │
│  │         │             │         │           │               │   │
│  │         ▼             │         │           ▼               │   │
│  │  ┌────────────────┐  │         │  ┌────────────────────┐  │   │
│  │  │   SQLite        │  │         │  │   SQLite            │  │   │
│  │  │   (30 días)     │  │         │  │   (ilimitado)       │  │   │
│  │  └────────────────┘  │         │  └────────────────────┘  │   │
│  │                      │         │                          │   │
│  │  Módulos activos:    │         │  Módulos activos:        │   │
│  │  ✓ POS              │         │  ✗ POS                   │   │
│  │  ✓ Caja             │         │  ✗ Caja                  │   │
│  │  ✓ Ventas           │         │  ✓ Reportes (global)     │   │
│  │  ✓ Inventario (R)   │         │  ✓ Inventario (RW)       │   │
│  │  ✓ Dashboard (local)│         │  ✓ Dashboard (global)    │   │
│  │  ✓ Reportes (local) │         │  ✓ Tiendas/Usuarios     │   │
│  └─────────────────────┘         │  ✓ Sync Config           │   │
│                                   └─────────────────────────┘   │
│  ┌─────────────────────┐                                        │
│  │      REPLICA B       │         (puede haber N Réplicas)      │
│  │   (Laptop Tienda)    │                                        │
│  │       ...            │                                        │
│  └─────────────────────┘                                        │
│                                                                 │
│  ┌─────────────────────┐                                        │
│  │      HYBRID          │  (modo independiente, sin sync)       │
│  │   (Sin conexión)     │                                        │
│  │                      │                                        │
│  │  Todos los módulos   │                                        │
│  │  Sin sincronización  │                                        │
│  └─────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Plan de Implementación (Fases)

### Fase 1: Infraestructura Base (1-2 semanas)
1. Crear migración `009_config_modes.sql`
2. Implementar `sync/config.rs` — lectura de `app_config`
3. Implementar pantalla de selección de modo
4. Implementar `ConfigContext` en frontend
5. Navegación condicional por modo

### Fase 2: Sync Queue - Replica (1-2 semanas)
1. Implementar `sync/queue.rs` — CRUD de `sync_queue`
2. Integrar con `sales_service` y `cash_service` para registrar en `sync_queue` al crear venta/cerrar caja
3. Implementar `sync/retention.rs` — limpieza de datos antiguos
4. Implementar job scheduler para sync a las 8pm
5. Implementar `sync/client.rs` — enviar batch vía Reqwest

### Fase 3: Sync Server - Primary (1-2 semanas)
1. Implementar `sync/server.rs` — Axum server
2. Implementar `POST /api/sync` — recibir y aplicar batch
3. Implementar `sync_log` y `replica_nodes`
4. Implementar endpoints de monitoreo
5. UI de configuración de sincronización en Primary

### Fase 4: UI y Pulido (1 semana)
1. Componente `SyncStatusBar` para Replica
2. Dashboard global para Primary
3. Reportes consolidados en Primary
4. Testing end-to-end con VPN
5. Documentación de instalación

### Fase 5: VPN y Deploy (opcional)
1. Configurar WireGuard o Tailscale
2. Documentar setup de red
3. Testing en producción

---

## 13. Decisiones Tomadas (Preguntas Resueltas)

### 13.1 ¿La Primary debe poder crear productos y enviarlos a las Réplicas?
**Respuesta: NO.** El modo Primary solo puede recibir sincronizaciones. Cada Réplica registra su propio stock, pero solo el usuario admin puede crear productos. Si es otro usuario en modo Réplica, no podrá crear nuevos ingresos — solo vender y manejar caja.

### 13.2 ¿Las Réplicas deben poder ver inventario de otras tiendas?
**Respuesta: NO.** Las Réplicas solo tienen acceso a una sola tienda. Cada admin de Réplica puede crear varias tiendas, pero en modo Réplica no puede crear más tiendas — solo editar la existente. Si modifica el nombre, se envía como sincronización. En modo Réplica un admin sí puede crear usuarios normalmente; la limitación solo es en tiendas (una sola por Réplica). En la DB de Primary sí habrá acceso a todas las tiendas/nodos Réplica, y un admin podrá acceder a ellas sin problemas.

### 13.3 ¿Qué pasa si una Réplica no sincroniza por varios días?
**Respuesta:** El sistema debe avisar al usuario si hay datos que no se han sincronizado y son antiguos. Las sincronizaciones son diarias y se guardan en una carpeta local. Si no se enviaron, están en cola de reintento. Flujo:
1. Si hay conexión a internet, los datos pendientes se envían
2. Cada sincronización se programa a las 8pm diarias
3. Si a las 8pm no se cerró la caja, NO se crean los datos del día a sincronizar — quedan pendientes hasta que se cierre caja
4. El sistema debe avisar que es importante cerrar caja
5. Si se cerró caja, se crea la data modificada y se prepara la sincronización
6. Si a las 8pm no hay internet o la Primary no está en línea, se deja pendiente
7. Al siguiente uso del programa, el sistema en segundo plano comprueba y envía si está disponible
8. Se libera la cola cuando ya no hay datos por sincronizar

### 13.4 ¿Se necesita HTTPS entre nodos?
**Respuesta: Empezar con HTTP sobre VPN.** Agregar HTTPS después cuando se necesite. La seguridad inicial es por red privada (VPN). Para HTTPS futuro: certificado auto-firmado o Let's Encrypt.

### 13.5 ¿La Primary debe poder gestionar usuarios de las Réplicas?
**Respuesta: NO.** Cada Réplica genera sus propios usuarios a partir de admin. Cada usuario tiene un gerente y empleados con esa responsabilidad. El Primary es un gestor que recopila toda la información y la centraliza, pero no puede hacer más.

### 13.6 Baja de Réplicas (nuevo)
**Respuesta:** Un Primary sí puede decidir dar de baja una Réplica. Esto hará que el nodo Réplica ya no pueda encontrar al Primary incluso si tiene conexión a internet — el Primary ya no acepta sincronizaciones de esa Réplica. La Réplica ya debería eliminarse según el protocolo de la empresa. En la DB de Primary, la Réplica queda en estado inhabilitado. La Réplica es un modo y solo tendrá asignada una tienda; si se da de baja una Réplica, la tienda también se deshabilita (no se elimina del DB, solo se da de baja).

---

## 14. Glossario

| Término | Definición |
|---------|------------|
| **Primary** | Computadora central que almacena todos los datos y genera reportes |
| **Replica** | Terminal de venta ligera que envía datos diariamente a la Primary |
| **Hybrid** | Estación de venta completa sin necesidad de sincronización |
| **Sync Batch** | Lote de datos empaquetados para enviar de Replica a Primary |
| **Sync Queue** | Cola de operaciones pendientes de sincronizar en la Replica |
| **Sync Log** | Registro de sincronizaciones recibidas en la Primary |
| **Retención** | Política de eliminación de datos antiguos (31 días en Replica) |
| **Nodo** | Cualquier instancia de VESTIKPOS (Primary, Replica o Hybrid) |

---

*Documento generado como parte del diseño de arquitectura para VESTIKPOS v0.2.0*
