# VESTIKPOS — Documentación Técnica v0.1.0

Sistema POS (Point of Sale) de escritorio, multi-tienda, con gestión de caja, inventario y ventas.

---

## Stack Tecnológico

| Capa        | Tecnología                              | Versión     |
| ----------- | --------------------------------------- | ----------- |
| Frontend    | React + TypeScript                      | 19 / 5.9    |
| Build       | Vite                                    | 7.2         |
| Estilos     | Tailwind CSS v4                         | 4.1         |
| Backend     | Rust + Tauri v2                         | 2.9.5       |
| Base datos  | SQLite (vía sqlx en Rust)               | —           |
| ORM Rust    | sqlx 0.8 (compile-time queries)         | 0.8         |
| Auth        | bcrypt (hash de contraseñas)            | 0.15        |
| Paquete     | pnpm                                    | —           |

### Dependencias Frontend (clave)

| Paquete                | Uso                                    |
| ---------------------- | -------------------------------------- |
| `@tauri-apps/api`      | Invocación de comandos Rust            |
| `@tauri-apps/plugin-sql` | Conexión SQLite desde frontend (no usado actualmente) |
| `react-router-dom`     | Enrutamiento SPA                       |
| `react-hook-form`      | Validación de formularios              |
| `recharts`             | Gráficos (Dashboard, Reports)          |
| `motion`               | Animaciones UI                         |
| `lucide-react`         | Iconos                                 |
| `lottie-react`         | Animaciones Lottie                     |
| `sonner`               | Toast notifications                    |
| `uuid`                 | IDs temporales en frontend             |
| `clsx`                 | Clases condicionales                   |

### Dependencias Rust (Cargo.toml)

| Crate          | Features                              |
| -------------- | ------------------------------------- |
| `tauri`        | v2.9.5                                |
| `tauri-plugin-sql` | sqlite                           |
| `sqlx`         | runtime-tokio, tls-rustls, sqlite, chrono, uuid |
| `bcrypt`       | 0.15                                  |
| `chrono`       | serde                                 |
| `uuid`         | v4, serde                             |
| `tauri-plugin-process` | —                             |
| `tauri-plugin-log` | —                               |

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React/TS)               │
│  BrowserRouter                                       │
│   ├─ NotificationProvider (toast system)             │
│   ├─ AuthProvider    (login/logout/activeStore)      │
│   └─ CashProvider    (sesión de caja activa)         │
│        └─ MainLayout (Sidebar + Navbar + Outlet)     │
│             ├─ DashboardPage    /dashboard           │
│             ├─ POSPage          /pos                 │
│             ├─ SalesPage        /sales               │
│             ├─ InventoryPage    /inventory           │
│             ├─ FinancePage      /finance             │
│             ├─ ReportsPage      /reports             │
│             ├─ StoresPage       /stores              │
│             └─ SettingsPage     /settings            │
│         Página pública:                              │
│           └─ LoginPage         /                     │
│                                                     │
│  ┌─ invoke('comando', {params}) ──────────────────┐ │
│  │   @tauri-apps/api (IPC bridge)                 │ │
│  └────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                  Backend (Rust/Tauri)                │
│                                                     │
│  lib.rs :: run()                                    │
│   ├─ db::init_db() → SqlitePool                     │
│   ├─ AuthService(pool)                              │
│   │    ├─ UserRepository(pool)                      │
│   │    └─ StoreRepository(pool)                     │
│   ├─ InventoryService(pool)                         │
│   │    └─ InventoryRepository(pool)                 │
│   ├─ SalesService(pool)                             │
│   │    └─ SalesRepository(pool)                     │
│   ├─ CashService(pool)                              │
│   │    └─ CashRepository(pool)                      │
│   ├─ initialize_admin()                             │
│   └─ AppState { auth, inventory, sales, cash }     │
│                                                     │
│  27 comandos Tauri registrados en generate_handler!  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                 SQLite (pos.db)                      │
├─────────────────────────────────────────────────────┤
│  Migraciones sqlx (carpeta ./migrations/)           │
│  001: stores, users, roles, user_roles              │
│  002: categories, products                          │
│  003: orders, order_items                           │
│  004: cash_sessions, expenses, other_income         │
│  005: multi-store isolation (ALTER TABLE)           │
└─────────────────────────────────────────────────────┘
```

**Patrón:** Command → Service → Repository → SQL (sqlx). Sin DI framework — los servicios se construyen manualmente en `setup()`.

---

## Estructura del Proyecto

```
pos-desktop/
├── src/                          # Frontend React/TypeScript
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Provider nesting
│   ├── context/                  # React contexts
│   │   ├── AuthContext.tsx        # Autenticación + store activo
│   │   ├── CashContext.tsx        # Sesión de caja
│   │   └── NotificationContext.tsx # Toast notifications
│   ├── routes/
│   │   ├── AppRoutes.tsx         # Definición de rutas
│   │   └── PrivateRoutes.tsx     # (vacío — el guard vive en AuthContext)
│   ├── features/
│   │   ├── auth/                 # Login, PasswordConfirmation
│   │   │   ├── pages/
│   │   │   │   └── LoginPage.tsx
│   │   │   └── components/
│   │   │       ├── cards/LoginCard.tsx
│   │   │       ├── forms/FormLogin.tsx (obsoleto)
│   │   │       └── PasswordConfirmationModal.tsx
│   │   ├── stores/               # CRUD tiendas y usuarios
│   │   │   ├── pages/
│   │   │   │   └── StoresPage.tsx
│   │   │   └── components/
│   │   │       ├── StoreCard.tsx
│   │   │       ├── StoreModal.tsx
│   │   │       ├── StoreDetailModal.tsx
│   │   │       ├── UserCard.tsx
│   │   │       └── UserModal.tsx
│   │   └── user/                 # Módulo principal (POS, ventas, inventario, etc.)
│   │       ├── layouts/MainLayout.tsx
│   │       ├── constants/navigation.ts
│   │       ├── pages/
│   │       │   ├── HomePage.tsx
│   │       │   ├── DashboardPage.tsx
│   │       │   ├── POSPage.tsx
│   │       │   ├── InventoryPage.tsx
│   │       │   ├── SalesPage.tsx
│   │       │   ├── FinancePage.tsx
│   │       │   ├── ReportsPage.tsx
│   │       │   └── SettingsPage.tsx
│   │       └── components/
│   │           ├── layouts/Sidebar.tsx, Navbar.tsx
│   │           ├── tables/SalesTable.tsx, InventoryTable.tsx
│   │           └── modals/ (9 modals)
│   ├── services/
│   │   ├── userService.ts        # Wrapper Tauri invoke para usuarios
│   │   └── db/                   # DB frontend (legacy, backend maneja las migraciones)
│   └── components/
│       └── TailwindTest.tsx      # Componente de prueba
│
├── src-tauri/                    # Backend Rust
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   ├── lib.rs                # Bootstrap Tauri (run())
│   │   ├── commands/             # Manejadores de comandos Tauri
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs           # 4 comandos
│   │   │   ├── cash.rs           # 9 comandos
│   │   │   ├── inventory.rs      # 8 comandos
│   │   │   ├── sales.rs          # 4 comandos
│   │   │   ├── store.rs          # 4 comandos
│   │   │   └── user.rs           # 5 comandos
│   │   ├── models/               # Structs de datos (Serialize/Deserialize)
│   │   │   ├── mod.rs
│   │   │   ├── user.rs
│   │   │   ├── cash.rs
│   │   │   ├── inventory.rs
│   │   │   ├── sales.rs
│   │   │   └── store.rs
│   │   ├── repositories/         # Capa de acceso a datos (SQL)
│   │   │   ├── mod.rs
│   │   │   ├── user_repo.rs
│   │   │   ├── store_repo.rs
│   │   │   ├── cash_repo.rs
│   │   │   ├── inventory_repo.rs
│   │   │   └── sales_repo.rs
│   │   ├── services/             # Lógica de negocio
│   │   │   ├── mod.rs
│   │   │   ├── auth_service.rs
│   │   │   ├── cash_service.rs
│   │   │   ├── inventory_service.rs
│   │   │   └── sales_service.rs
│   │   └── db/
│   │       └── mod.rs            # init_db() — pool SQLite + migraciones sqlx
│   ├── migrations/               # Migraciones SQL (ejecutadas por sqlx en Rust)
│   │   ├── 001_stores_users.sql
│   │   ├── 002_categories_products.sql
│   │   ├── 003_orders.sql
│   │   ├── 004_cash_management.sql
│   │   └── 005_multi_store_isolation.sql
│   ├── tauri.conf.json           # Configuración Tauri
│   ├── capabilities/default.json # Permisos SQL y debug
│   ├── Cargo.toml
│   └── build.rs
│
├── public/                       # Assets estáticos
│   ├── vendor/                   # Librerías JS vendor
│   │   ├── html2canvas.min.js    # Captura de pantalla HTML
│   │   └── jspdf.min.js          # Generación PDF
│   └── migrations/               # Migraciones SQL legacy (frontend)
│
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── eslint.config.js
├── pnpm-workspace.yaml
└── DOCS.md                       # Este archivo
```

---

## Base de Datos — Esquema Completo

### Migración 001 — `stores_users`

```sql
-- Tiendas
CREATE TABLE stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    address TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usuarios
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    cargo TEXT,
    email TEXT,
    store_id INTEGER REFERENCES stores(id),
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles
CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name TEXT NOT NULL UNIQUE
);
-- Roles del sistema: ADMIN, GERENTE, VENDEDOR

-- Asignación usuario-rol
CREATE TABLE user_roles (
    user_id INTEGER NOT NULL REFERENCES users(id),
    role_id INTEGER NOT NULL REFERENCES roles(id),
    PRIMARY KEY (user_id, role_id)
);
```

### Migración 002 — `categories_products`

```sql
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    price REAL NOT NULL,
    cost REAL NOT NULL,
    stock INTEGER NOT NULL,
    min_stock INTEGER DEFAULT 5,
    unit TEXT DEFAULT 'Unidades',
    image_url TEXT,
    is_active BOOLEAN DEFAULT 1,
    store_id INTEGER REFERENCES stores(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Migración 003 — `orders`

```sql
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    client_document TEXT,
    client_phone TEXT,
    client_name TEXT,
    payment_method TEXT DEFAULT 'cash',  -- 'cash' | 'card' | 'yape'
    subtotal REAL NOT NULL,
    igv REAL NOT NULL,
    total REAL NOT NULL,
    cash_session_id INTEGER REFERENCES cash_sessions(id),
    store_id INTEGER REFERENCES stores(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    unit_price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal REAL NOT NULL
);
```

### Migración 004 — `cash_management`

```sql
CREATE TABLE cash_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opened_by INTEGER NOT NULL REFERENCES users(id),
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_by INTEGER REFERENCES users(id),
    closed_at TIMESTAMP,
    opening_cash REAL NOT NULL,       -- Efectivo inicial
    opening_virtual REAL NOT NULL,    -- Saldo virtual/bancario inicial
    expected_closing_cash REAL NOT NULL,  -- Debería haber
    expected_closing_virtual REAL NOT NULL,
    real_closing_cash REAL,           -- Real al cerrar
    real_closing_virtual REAL,
    difference REAL,                  -- Diferencia (real - expected)
    justification TEXT,
    status TEXT DEFAULT 'open',       -- 'open' | 'closed'
    store_id INTEGER REFERENCES stores(id)
);

CREATE TABLE user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logout_at TIMESTAMP,
    cash_session_id INTEGER REFERENCES cash_sessions(id)
);

CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cash_session_id INTEGER NOT NULL REFERENCES cash_sessions(id),
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,     -- 'cash' | 'virtual'
    store_id INTEGER REFERENCES stores(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE other_income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cash_session_id INTEGER NOT NULL REFERENCES cash_sessions(id),
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    store_id INTEGER REFERENCES stores(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Migración 005 — `multi_store_isolation`

Añade columnas `store_id` a tablas existentes y establece valor por defecto (tienda 1). Inserta "Tienda Principal" si no existe.

---

## Backend — Comandos Tauri (API IPC)

### auth (4 comandos)

| Comando           | Params                        | Retorno        | Descripción                      |
| ----------------- | ----------------------------- | -------------- | -------------------------------- |
| `login`           | username, password            | `User`         | Autenticación con bcrypt         |
| `create_user`     | username, password, email?    | `User`         | Crear usuario ADMIN              |
| `get_users`       | —                             | `Vec<User>`    | Listar usuarios activos          |
| `verify_password` | password                      | `bool`         | Verificar password del admin     |

### cash (9 comandos)

| Comando                        | Params                                             | Retorno                  |
| ------------------------------ | -------------------------------------------------- | ------------------------ |
| `get_active_cash_session`      | store_id                                           | `Option<CashSession>`    |
| `get_last_closed_cash_session` | store_id                                           | `Option<CashSession>`    |
| `open_cash_session`            | OpenCashPayload                                    | `i64` (session_id)       |
| `close_cash_session`           | session_id, CloseCashPayload                       | `()`                     |
| `add_cash_expense`             | session_id, description, amount, payment_method    | `i64`                    |
| `add_cash_other_income`        | session_id, description, amount, payment_method    | `i64`                    |
| `get_cash_session_transactions`| session_id                                         | `Vec<serde_json::Value>` |
| `get_all_expenses`             | store_id                                           | `Vec<Expense>`           |
| `get_all_other_income`         | store_id                                           | `Vec<OtherIncome>`       |

### inventory (8 comandos)

| Comando            | Params                                              | Retorno                     |
| ------------------ | --------------------------------------------------- | --------------------------- |
| `get_categories`   | —                                                   | `Vec<Category>`             |
| `create_category`  | name                                                | `Category`                  |
| `update_category`  | id, name                                            | `()`                        |
| `delete_category`  | id                                                  | `()`                        |
| `get_products`     | store_id                                            | `Vec<ProductWithCategory>`  |
| `create_product`   | code, name, category_id, price, cost, stock, unit, image_url, store_id | `i64`   |
| `update_product`   | id, code, name, category_id, price, cost, stock, unit, image_url, store_id | `()` |
| `delete_product`   | id                                                  | `()`                        |

### sales (4 comandos)

| Comando               | Params                                                              | Retorno                    |
| --------------------- | ------------------------------------------------------------------- | -------------------------- |
| `create_sale`         | user_id, client_document?, client_phone?, client_name?, payment_method, items, subtotal, igv, total, cash_session_id, store_id | `i64` |
| `get_sales`           | store_id                                                            | `Vec<Sale>`                |
| `get_sale_detail`     | sale_id                                                             | `Option<SaleDetail>`       |
| `get_all_order_items` | store_id                                                            | `Vec<OrderItemExport>`     |

### store (4 comandos)

| Comando         | Params                  | Retorno  |
| --------------- | ----------------------- | -------- |
| `get_stores`    | —                       | `Vec<Store>` |
| `create_store`  | name, address?, code?   | `Store`  |
| `update_store`  | id, name, address?, code? | `()`   |
| `delete_store`  | id                      | `()`     |

### user (5 comandos)

| Comando              | Params                                              | Retorno         |
| -------------------- | --------------------------------------------------- | --------------- |
| `get_all_users`      | —                                                   | `Vec<User>`     |
| `create_staff_user`  | username, password, cargo?, email?, store_id?, role_name | `User`     |
| `update_user`        | id, cargo?, email?, store_id?                       | `()`            |
| `delete_user`        | id                                                  | `()`            |
| `get_users_by_store` | store_id                                            | `Vec<User>`     |

---

## Frontend — Flujo de Datos

### Autenticación

```
LoginPage (/)
  └─ LoginCard
      1. Ingresa username + password
      2. invoke('login', { username, password })
      3. AuthContext guarda user en state + localStorage
      4. Si user.cargo === 'ADMIN' y no tiene store_id:
           → Segundo paso: seleccionar tienda
           → invoke('get_stores') + setActiveStoreId()
      5. Navega a /home (o ruta anterior)
```

**Persistencia:** `localStorage` guarda `pos_user` y `active_store_id`. En el montaje de `AuthProvider`, se leen y restauran.

### Sesión de Caja

```
MainLayout (protege todas las rutas internas)
  └─ Al montarse:
      1. useAuth() → user, activeStoreId
      2. useCash() → refreshSession()
         ├─ invoke('get_active_cash_session', { storeId })
         └─ Si no hay activa → invoke('get_last_closed_cash_session')
      3. Si NO hay sesión activa:
         └─ Muestra SessionSummaryModal (último cierre)
         └─ Si sigue sin sesión → fuerza OpenCashModal (modal sin escape)
      4. Si HAY sesión activa:
         └─ Renderiza Sidebar + Navbar + <Outlet/>
```

### Ciclo de Venta (POS)

```
POSPage (/pos)
  1. Carga productos y categorías (por store_id)
  2. Usuario agrega productos al carrito
     └─ addToCart(): verifica stock, incrementa o agrega con UUID
  3. Carrito muestra: items, cantidades (+/-), precio unitario, subtotales, IGV 18%
  4. Checkout → CheckoutModal:
     └─ Selecciona método de pago (cash | card | yape)
     └─ Datos opcionales del cliente
     └─ Confirmar → invoke('create_sale', { ... })
         └─ En Rust: transacción SQL → insert order + order_items
         └─ Valida stock, decrementa inventario
         └─ Actualiza expected_closing en cash_session
  5. Recarga productos + sesión de caja
```

### Dashboard

```
DashboardPage (/dashboard)
  └─ Carga en paralelo:
     ├─ invoke('get_sales', { storeId })
     ├─ invoke('get_products', { storeId })
     ├─ invoke('get_all_order_items', { storeId })
     └─ invoke('get_cash_session_transactions', { sessionId })
  └─ Muestra:
     ├─ Tarjetas: Ventas hoy, Órdenes, Productos, Gastos
     ├─ Gráfico: Ingresos últimos 7 días (Recharts AreaChart)
     └─ Top 4 productos más vendidos (progress bars)
```

---

## Roles y Permisos

| Rol       | Acceso                                                |
| --------- | ----------------------------------------------------- |
| `ADMIN`   | CRUD tiendas, usuarios, inventario, ver todo          |
| `GERENTE` | CRUD inventario, ver ventas, reportes, dashboard      |
| `VENDEDOR`| POS, ver inventario (solo lectura), ver sus ventas    |

El rol `ADMIN` tiene acceso sin restricción a todas las rutas. Los roles `GERENTE` y `VENDEDOR` están implementados a nivel de backend pero la UI no discrimina granularmente aún (se usa mayormente `user?.username === 'admin'` en el frontend como guardia).

---

## Configuración Tauri

```json
{
  "productName": "pos-desktop",
  "version": "0.1.0",
  "identifier": "com.cruzr.vestikPOS",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [{
      "title": "VESTIKPOS",
      "width": 800,
      "height": 600,
      "resizable": true,
      "fullscreen": true
    }],
    "security": { "csp": null }
  }
}
```

**Capacidades (`capabilities/default.json`):** SQLite (load, execute, select), webview devtools, process.

---

## Modelos de Datos (Rust)

### User
```rust
pub struct User {
    pub id: i64,
    pub username: String,
    pub password_hash: String,  // #[serde(skip_serializing)]
    pub cargo: Option<String>,
    pub email: Option<String>,
    pub store_id: Option<i64>,
    pub is_active: bool,
    pub created_at: Option<NaiveDateTime>,
}
```

### ProductWithCategory
```rust
pub struct ProductWithCategory {
    pub id: i64,
    pub code: Option<String>,
    pub name: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,  // LEFT JOIN
    pub price: f64,
    pub cost: f64,
    pub stock: i64,
    pub min_stock: Option<i64>,
    pub unit: Option<String>,
    pub image_url: Option<String>,
    pub is_active: bool,
    pub store_id: Option<i64>,
    pub created_at: Option<NaiveDateTime>,
}
```

### Sale (con items embedidos)
```rust
pub struct SaleDetail {
    pub sale: Sale,         // id, user_id, user_name, client_data, payment_method,
                            // subtotal, igv, total, store_id, created_at
    pub items: Vec<SaleItem>, // product_id, product_name, unit_price, quantity, subtotal
}
```

### CashSession
```rust
pub struct CashSession {
    pub id: i64,
    pub opened_by: i64,
    pub opened_at: String,
    pub closed_by: Option<i64>,
    pub closed_at: Option<String>,
    pub opening_cash: f64,
    pub opening_virtual: f64,
    pub expected_closing_cash: f64,
    pub expected_closing_virtual: f64,
    pub real_closing_cash: Option<f64>,
    pub real_closing_virtual: Option<f64>,
    pub difference: Option<f64>,
    pub justification: Option<String>,
    pub status: String,     // "open" | "closed"
    pub store_id: i64,
}
```

---

## Páginas del Frontend

### LoginPage (`/`)
Pantalla pública con fondo degradado. LoginCard de dos pasos: (1) credenciales, (2) selección de tienda para admins.

### HomePage (`/home`)
Página de bienvenida con reloj en vivo, logo VESTIKPOS, animación Lottie.

### DashboardPage (`/dashboard`)
Resumen del día: ventas totales, órdenes, productos, gastos. Gráfico de ingresos semanales (área). Top productos.

### POSPage (`/pos`)
Punto de venta principal: grilla de productos con filtro por categoría y búsqueda, carrito lateral con control de cantidades y precios, checkout con selección de método de pago.

### SalesPage (`/sales`)
Historial de ventas con filtros (fecha, método de pago, búsqueda), ordenamiento, paginación, exportación CSV/PDF, detalle de venta.

### InventoryPage (`/inventory`)
CRUD de productos y categorías con búsqueda, paginación, indicador de stock (normal/bajo/sin stock).

### FinancePage (`/finance`)
Gestión de caja: apertura, gastos, ingresos adicionales, corte de caja, resumen de transacciones.

### ReportsPage (`/reports`)
Reportes con pestañas (Ventas, Ganancias, Productos), selector de período, gráficos Recharts, exportación a PDF.

### StoresPage (`/stores`)
Administración de tiendas y usuarios: CRUD de tiendas, asignación de usuarios a tiendas, roles.

### SettingsPage (`/settings`)
(UI estática) Perfil de negocio, configuración SUNAT, perfil de usuario. Sin integración backend.

---

## Flujo de Transacciones (Venta Completa)

```
POSPage
  └─ addToCart(producto)
  └─ handleCheckout()
       └─ invoke('create_sale', payload)
            └─ commands/sales.rs::create_sale()
                 └─ sales_service.create_order(payload)
                      └─ sales_repo.create_order(payload)  [SQL TRANSACTION]
                           ├─ INSERT INTO orders (...)
                           ├─ UPDATE cash_sessions SET expected_closing_*
                           ├─ Para cada item:
                           │    ├─ SELECT stock FROM products (validar)
                           │    ├─ INSERT INTO order_items (...)
                           │    └─ UPDATE products SET stock = stock - quantity
                           └─ COMMIT
```

Si el stock es insuficiente, la transacción revierte y retorna error "Stock insuficiente".

---

## Puntos de Extensión para Sincronización

La base de datos ya incluye una migración `006_sync.sql` (legacy, en `public/migrations/`) que define la estructura `sync_queue`. Los puntos clave a considerar:

1. **Nuevo módulo sync** en Rust: `src-tauri/src/services/sync_service.rs`
   - Leer `sync_queue` y enviar a servidor remoto
   - Recibir cambios del servidor y aplicar localmente

2. **WebSocket / HTTP client** en Rust: agregar dependencia (reqwest, tungstenite)

3. **Server endpoint**: definir API REST para cada dominio (stores, users, products, orders, cash_sessions)

4. **Estrategia de merge**: conflictos en inventario (stock), sesiones de caja concurrentes

5. **Offline-first**: todas las operaciones locales con cola de reintento

6. **Migraciones pendientes** en `public/migrations/` que deberían portarse a sqlx:
   - `006_sync.sql`: tabla `sync_queue` con operaciones pendientes de sincronizar
   - Esquema legacy (002-006) que migró a integer PKs en 007-008

---

## Notas Técnicas

- **Las migraciones SQL se ejecutan desde Rust** (`sqlx::migrate!()` en `db/mod.rs`), NO desde el frontend.
- **No hay seed automático** — el backend crea el admin por defecto en `initialize_admin()` si no hay usuarios.
- **IGV fijo en 18%** — calculado en el frontend (subtotal \* 0.18), enviado como campo en `create_sale`.
- **Stock se valida y decrementa en una transacción SQL** en `sales_repo::create_order()`.
- **Las sesiones de caja son obligatorias** — `MainLayout` fuerza la apertura si no hay sesión activa.
- **La UI de Settings es estática** — no persiste datos todavía.
- **No hay sincronización** — la app es 100% local. La tabla `sync_queue` no existe en las migraciones activas.
