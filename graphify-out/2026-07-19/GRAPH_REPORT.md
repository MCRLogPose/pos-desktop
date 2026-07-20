# Graph Report - pos-desktop  (2026-07-19)

## Corpus Check
- 131 files · ~130,323 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1165 nodes · 1697 edges · 137 communities (82 shown, 55 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 72 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e3a8e368`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- html2canvas Vendor Library
- Sales Commands
- jsPDF Vendor Library
- Cargo Build Errors
- Auth and Cash Commands
- Inventory Models
- Package Dependencies
- Main App Core
- Cash Session Models
- Dev Dependencies
- Auth and Store UI
- User Models
- App Root and Auth Context
- TypeScript App Config
- User Modal Components
- Cash Repository
- TypeScript Node Config
- Category and Product Modals
- Tauri Configuration
- Desktop Schema Definitions
- Windows Schema Definitions
- User Commands
- Auth Commands
- Checkout and POS Page
- Desktop Schema Capabilities
- Desktop Schema Permissions
- Desktop Schema Webviews
- Windows Schema Capabilities
- Windows Schema Permissions
- Windows Schema Webviews
- Desktop Remote Capabilities
- Windows Remote Capabilities
- Database Initialization
- Dashboard Page
- DB Services
- Desktop Schema Root
- Windows Schema Root
- Store Models
- html2canvas Internal A
- html2canvas Internal B
- Desktop Capability Schemas
- Desktop Description Schema
- Windows Capability Schemas
- Windows Description Schema
- OpenCode Plugin Config
- OpenCode Package Config
- Graphify Plugin
- html2canvas Internal C
- html2canvas Internal D
- html2canvas Internal E
- Login Card UI
- User Service
- Desktop Identifier Schema
- Windows Identifier Schema
- TypeScript Root Config
- Graphify Agent Config
- html2canvas Minified A
- html2canvas Minified B
- html2canvas Minified C
- html2canvas Minified D
- html2canvas Rendering
- html2canvas Range Bounds
- Android Chrome Icon
- Apple Touch Icon
- Favicon 16
- Favicon 32
- Vite Logo
- React Logo
- Tauri Build Errors
- Tauri Icon 128x128
- Tauri Icon 128x128@2x
- Tauri Icon 32x32
- Tauri Icon 64x64
- Android Launcher Icon
- Tauri App Icon
- Tauri Icon VKS
- Tauri Square 107
- Tauri Square 142
- Tauri Square 150
- Tauri Square 284
- Tauri Square 30
- Tauri Square 310
- Tauri Square 44
- Tauri Square 71
- Tauri Square 89
- Store Logo
- iOS App Icon
- Migraciones
- store.rs
- VESTIKPOS
- ReportsPage.tsx
- tsc_final_output.txt - TypeScript Errors
- React + TypeScript + Vite
- Pt
- AGENTS.md - Graphify Agent Instructions
- README.md - React TypeScript Vite Template
- React Framework
- TypeScript Language
- Vite Bundler
- Database README.md - SQLite Structure
- PRAGMA foreign_keys = ON
- IGV Tax
- Inventory Domain
- Database Migration System
- Products Domain
- Role Based Access Control
- Sales Domain
- Stores Domain
- Sync Queue
- Users Domain
- VESTIKPOS — Diseño de Arquitectura: Modos de Configuración
- 13. Decisiones Tomadas (Preguntas Resueltas)
- 12. Plan de Implementación (Fases)
- 6. Cambios en el Backend (Rust)
- 7. Cambios en el Frontend
- 2. Contexto y Problema
- 3. Definición de Modos
- 5. Cambios en la Base de Datos
- 9. Seguridad
- 8. Flujo de Instalación
- GastosTable.tsx
- store.rs

## God Nodes (most connected - your core abstractions)
1. `AppState` - 53 edges
2. `compilerOptions` - 25 edges
3. `CashRepository` - 20 edges
4. `compilerOptions` - 18 edges
5. `e()` - 17 edges
6. `m()` - 17 edges
7. `UserRepository` - 17 edges
8. `InventoryRepository` - 16 edges
9. `CashService` - 16 edges
10. `VESTIKPOS — Diseño de Arquitectura: Modos de Configuración` - 15 edges

## Surprising Connections (you probably didn't know these)
- `GastosPage()` --indirect_call--> `v()`  [INFERRED]
  src/features/user/pages/GastosPage.tsx → public/vendor/jspdf.min.js
- `CashSession` --semantically_similar_to--> `Cash Sessions`  [INFERRED] [semantically similar]
  cargo_output.txt → src/services/db/README.md
- `tsc_final_output.txt - TypeScript Errors` --semantically_similar_to--> `tsc_final_v3.txt - TypeScript Errors`  [INFERRED] [semantically similar]
  tsc_final_output.txt → tsc_final_v3.txt
- `tsc_final_output.txt - TypeScript Errors` --semantically_similar_to--> `tsc_output.txt - TypeScript Errors`  [INFERRED] [semantically similar]
  tsc_final_output.txt → tsc_output.txt
- `tsc_output.txt - TypeScript Errors` --semantically_similar_to--> `tsc_output_v2.txt - TypeScript Errors`  [INFERRED] [semantically similar]
  tsc_output.txt → tsc_output_v2.txt

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Rust Compilation Blockers** — cargo_output_tauri_app, src_tauri_check_error_tokio, src_tauri_check_error_user_model, src_tauri_check_error_naive_date_time, cargo_output_sqlite_row_get [INFERRED 0.85]

## Communities (137 total, 55 thin omitted)

### Community 0 - "html2canvas Vendor Library"
Cohesion: 0.04
Nodes (6): E(), l(), p(), sB(), SUPPORT_SVG_DRAWING(), w()

### Community 1 - "Sales Commands"
Cohesion: 0.07
Nodes (39): create_sale(), get_all_order_items(), get_sale_detail(), get_sales(), Option, OrderItemExport, Result, Sale (+31 more)

### Community 2 - "jsPDF Vendor Library"
Cohesion: 0.10
Nodes (48): _(), an(), B(), gr(), I(), Pt(), SUPPORT_WORD_BREAKING(), wA() (+40 more)

### Community 3 - "Cargo Build Errors"
Cohesion: 0.10
Nodes (22): src/repositories/cash_repo.rs, CashSession, Expense Model, OtherIncome Model, cargo_output.txt - Rust Compilation Errors, SqliteRow::get() Missing Trait Error, Tauri App v0.1.0, AuthContext.tsx (+14 more)

### Community 4 - "Auth and Cash Commands"
Cohesion: 0.13
Nodes (47): AppState, change_password(), create_user(), get_users(), login(), Option, Result, State (+39 more)

### Community 5 - "Inventory Models"
Cohesion: 0.09
Nodes (23): Product, Category, Product, ProductWithCategory, NaiveDateTime, Option, String, InventoryRepository (+15 more)

### Community 6 - "Package Dependencies"
Cohesion: 0.05
Nodes (26): dependencies, clsx, lottie-react, lucide-react, motion, react, react-dom, react-hook-form (+18 more)

### Community 7 - "Main App Core"
Cohesion: 0.11
Nodes (18): Error, Option, Result, Self, SqlitePool, Store, Vec, StoreRepository (+10 more)

### Community 8 - "Cash Session Models"
Cohesion: 0.12
Nodes (20): CashSession, CloseCashPayload, Expense, OpenCashPayload, OtherIncome, Option, String, UpdateExpensePayload (+12 more)

### Community 9 - "Dev Dependencies"
Cohesion: 0.07
Nodes (28): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss (+20 more)

### Community 10 - "Auth and Store UI"
Cohesion: 0.07
Nodes (15): PasswordConfirmationModalProps, Store, StoreCard(), StoreCardProps, Store, StoreDetailModalProps, StoreModalProps, Store (+7 more)

### Community 11 - "User Models"
Cohesion: 0.16
Nodes (15): Role, NaiveDateTime, Option, String, Vec, User, UserWithRoles, Error (+7 more)

### Community 12 - "App Root and Auth Context"
Cohesion: 0.10
Nodes (20): AuthContext, AuthContextType, AuthProvider(), ProtectedRoute(), useAuth(), User, CashContext, CashContextType (+12 more)

### Community 13 - "TypeScript App Config"
Cohesion: 0.07
Nodes (27): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, baseUrl, erasableSyntaxOnly, esModuleInterop, jsx, lib (+19 more)

### Community 14 - "User Modal Components"
Cohesion: 0.12
Nodes (20): ExportFormat, ExportModalProps, formatDateTime(), paymentMethodColor(), paymentMethodLabel(), Sale, SaleDetailModal(), SaleDetailModalProps (+12 more)

### Community 15 - "Cash Repository"
Cohesion: 0.10
Nodes (31): create_purchase_order(), get_purchase_order_detail(), get_purchase_orders(), Option, Result, State, String, Vec (+23 more)

### Community 16 - "TypeScript Node Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 17 - "Category and Product Modals"
Cohesion: 0.10
Nodes (14): AddStockModalProps, Product, Category, CategoryModalProps, BatchItem, Category, Product, ProductModalProps (+6 more)

### Community 18 - "Tauri Configuration"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 19 - "Desktop Schema Definitions"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 20 - "Windows Schema Definitions"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 21 - "User Commands"
Cohesion: 0.44
Nodes (11): create_staff_user(), delete_user(), get_all_users(), get_users_by_store(), Option, Result, State, String (+3 more)

### Community 22 - "Auth Commands"
Cohesion: 0.04
Nodes (45): Arquitectura General, Autenticación, auth (4 comandos), Backend — Comandos Tauri (API IPC), Base de Datos — Esquema Completo, cash (9 comandos), CashSession, Ciclo de Venta (POS) (+37 more)

### Community 23 - "Checkout and POS Page"
Cohesion: 0.20
Nodes (6): CheckoutModalProps, PaymentMethod, CartItem, Category, PaymentMethod, Product

### Community 24 - "Desktop Schema Capabilities"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 25 - "Desktop Schema Permissions"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 26 - "Desktop Schema Webviews"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 27 - "Windows Schema Capabilities"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 28 - "Windows Schema Permissions"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 29 - "Windows Schema Webviews"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 30 - "Desktop Remote Capabilities"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 31 - "Windows Remote Capabilities"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 32 - "Database Initialization"
Cohesion: 0.38
Nodes (6): AppHandle, init_db(), Box, Error, Result, SqlitePool

### Community 33 - "Dashboard Page"
Cohesion: 0.29
Nodes (4): i64, OrderItem, Product, Sale

### Community 35 - "Desktop Schema Root"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 36 - "Windows Schema Root"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 37 - "Store Models"
Cohesion: 0.50
Nodes (4): NaiveDateTime, Option, String, Store

### Community 38 - "html2canvas Internal A"
Cohesion: 0.50
Nodes (4): ee(), He(), te(), ye()

### Community 39 - "html2canvas Internal B"
Cohesion: 0.50
Nodes (4): gs(), ns(), rs(), ts()

### Community 40 - "Desktop Capability Schemas"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 41 - "Desktop Description Schema"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 42 - "Windows Capability Schemas"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 43 - "Windows Description Schema"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 47 - "html2canvas Internal C"
Cohesion: 0.67
Nodes (3): cn(), on(), Qn()

### Community 48 - "html2canvas Internal D"
Cohesion: 0.67
Nodes (3): FA(), lA(), UA()

### Community 49 - "html2canvas Internal E"
Cohesion: 0.67
Nodes (3): fe(), oe(), xB()

### Community 52 - "Desktop Identifier Schema"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 53 - "Windows Identifier Schema"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 102 - "Migraciones"
Cohesion: 0.17
Nodes (11): 001_stores_users.sql, 002_products.sql, 003_inventory.sql, 004_sales.sql, 005_cash.sql, 006_sync.sql, Database Structure, Datos Iniciales (Seed) (+3 more)

### Community 103 - "store.rs"
Cohesion: 0.10
Nodes (20): 1.1 Migración SQL, 1.2 Backend Rust, 1.3 Frontend — Modal "Nuevo Lote", 1.4 Verificación, 2.1 Migración SQL, 2.2 Backend, 2.3 Frontend, 2.4 Verificación (+12 more)

### Community 104 - "VESTIKPOS"
Cohesion: 0.33
Nodes (6): index.html - VESTIKPOS Entry Point, VESTIKPOS, Multi-Store Support, Offline First Design Pattern, SQLite Database, SUNAT Ready Invoicing

### Community 105 - "ReportsPage.tsx"
Cohesion: 0.22
Nodes (9): 4.1 Stack Tecnológico, 4.2 Topología de Red, 4.3.1 Flujo Replica → Primary, 4.3.2 Endpoints API (Primary), 4.3.3 Estructura del Sync Batch, 4.3 Protocolo de Sincronización, 4.4 Manejo de Conflictos, 4.5 Tolerancia a Fallos de Red (+1 more)

### Community 106 - "tsc_final_output.txt - TypeScript Errors"
Cohesion: 0.33
Nodes (6): AppRoutes.tsx Unused useAuth Error, tsc_final_output.txt - TypeScript Errors, tsc_final_v3.txt - TypeScript Errors, FinancePage.tsx Unused Imports Error, tsc_output.txt - TypeScript Errors, tsc_output_v2.txt - TypeScript Errors

### Community 107 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 108 - "Pt"
Cohesion: 0.17
Nodes (12): CashRepository, CashSession, Error, Expense, Option, OtherIncome, Result, Self (+4 more)

### Community 125 - "VESTIKPOS — Diseño de Arquitectura: Modos de Configuración"
Cohesion: 0.25
Nodes (7): 10.1 Límites, 10.2 Optimizaciones, 10. Rendimiento y Escalabilidad, 11. Diagrama de Arquitectura Completo, 14. Glossario, 1. Resumen Ejecutivo, VESTIKPOS — Diseño de Arquitectura: Modos de Configuración

### Community 126 - "13. Decisiones Tomadas (Preguntas Resueltas)"
Cohesion: 0.29
Nodes (7): 13.1 ¿La Primary debe poder crear productos y enviarlos a las Réplicas?, 13.2 ¿Las Réplicas deben poder ver inventario de otras tiendas?, 13.3 ¿Qué pasa si una Réplica no sincroniza por varios días?, 13.4 ¿Se necesita HTTPS entre nodos?, 13.5 ¿La Primary debe poder gestionar usuarios de las Réplicas?, 13.6 Baja de Réplicas (nuevo), 13. Decisiones Tomadas (Preguntas Resueltas)

### Community 127 - "12. Plan de Implementación (Fases)"
Cohesion: 0.33
Nodes (6): 12. Plan de Implementación (Fases), Fase 1: Infraestructura Base (1-2 semanas), Fase 2: Sync Queue - Replica (1-2 semanas), Fase 3: Sync Server - Primary (1-2 semanas), Fase 4: UI y Pulido (1 semana), Fase 5: VPN y Deploy (opcional)

### Community 128 - "6. Cambios en el Backend (Rust)"
Cohesion: 0.40
Nodes (5): 6.1 Nuevas dependencias en `Cargo.toml`, 6.2 Nueva estructura de módulos, 6.3 Configuración del modo en `lib.rs`, 6.4 Comandos Tauri nuevos, 6. Cambios en el Backend (Rust)

### Community 129 - "7. Cambios en el Frontend"
Cohesion: 0.40
Nodes (5): 7.1 Nuevo contexto: `ConfigContext`, 7.2 Navegación condicional por modo, 7.3 Componente de estado de sincronización, 7.4 Página de configuración de sincronización (Primary), 7. Cambios en el Frontend

### Community 130 - "2. Contexto y Problema"
Cohesion: 0.50
Nodes (4): 2. Contexto y Problema, Objetivo, Problema a resolver, Situación actual

### Community 131 - "3. Definición de Modos"
Cohesion: 0.50
Nodes (4): 3.1 Primary (Computadora Central), 3.2 Replica (Nodo de Venta), 3.3 Hybrid (Independiente), 3. Definición de Modos

### Community 132 - "5. Cambios en la Base de Datos"
Cohesion: 0.50
Nodes (4): 5.1 Nueva migración: `009_config_modes.sql`, 5.2 Migraciones existentes que se mantienen, 5.3 Migración adicional: `007_purchase_orders.sql`, 5. Cambios en la Base de Datos

### Community 133 - "9. Seguridad"
Cohesion: 0.50
Nodes (4): 9.1 Autenticación entre nodos, 9.2 Autorización, 9.3 Integridad de datos, 9. Seguridad

### Community 134 - "8. Flujo de Instalación"
Cohesion: 0.67
Nodes (3): 8.1 Primera ejecución, 8.2 Cambio de modo, 8. Flujo de Instalación

### Community 135 - "GastosTable.tsx"
Cohesion: 0.15
Nodes (14): CATEGORIES, Expense, GastoModalProps, categoryColor(), Expense, formatDate(), formatTime(), GastosTable() (+6 more)

### Community 136 - "store.rs"
Cohesion: 0.42
Nodes (10): create_store(), delete_store(), get_stores(), Option, Result, State, Store, String (+2 more)

## Knowledge Gaps
- **420 isolated node(s):** `$schema`, `plugin`, `@opencode-ai/plugin`, `name`, `private` (+415 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **55 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppState` connect `Auth and Cash Commands` to `Sales Commands`, `Inventory Models`, `Main App Core`, `Cash Session Models`, `store.rs`, `Cash Repository`, `User Commands`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `AuthService` connect `Main App Core` to `User Models`, `Auth and Cash Commands`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `SalesService` connect `Sales Commands` to `Auth and Cash Commands`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `$schema`, `plugin`, `@opencode-ai/plugin` to the rest of the system?**
  _423 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `html2canvas Vendor Library` be split into smaller, more focused modules?**
  _Cohesion score 0.03636363636363636 - nodes in this community are weakly interconnected._
- **Should `Sales Commands` be split into smaller, more focused modules?**
  _Cohesion score 0.07039187227866474 - nodes in this community are weakly interconnected._
- **Should `jsPDF Vendor Library` be split into smaller, more focused modules?**
  _Cohesion score 0.1011764705882353 - nodes in this community are weakly interconnected._