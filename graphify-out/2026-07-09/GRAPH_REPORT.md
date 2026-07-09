# Graph Report - C:/Users/cruzr/Documents/ProjectsDesktop/pos-desktop  (2026-07-09)

## Corpus Check
- 183 files · ~114,716 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 939 nodes · 1391 edges · 102 communities (63 shown, 39 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

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

## God Nodes (most connected - your core abstractions)
1. `AppState` - 44 edges
2. `compilerOptions` - 25 edges
3. `compilerOptions` - 18 edges
4. `e()` - 17 edges
5. `m()` - 17 edges
6. `UserRepository` - 16 edges
7. `CashRepository` - 15 edges
8. `Database README.md - SQLite Structure` - 15 edges
9. `wA()` - 13 edges
10. `InventoryRepository` - 13 edges

## Surprising Connections (you probably didn't know these)
- `CashSession` --semantically_similar_to--> `Cash Sessions`  [INFERRED] [semantically similar]
  cargo_output.txt → src/services/db/README.md
- `tsc_final_output.txt - TypeScript Errors` --semantically_similar_to--> `tsc_final_v3.txt - TypeScript Errors`  [INFERRED] [semantically similar]
  tsc_final_output.txt → tsc_final_v3.txt
- `tsc_final_output.txt - TypeScript Errors` --semantically_similar_to--> `tsc_output.txt - TypeScript Errors`  [INFERRED] [semantically similar]
  tsc_final_output.txt → tsc_output.txt
- `tsc_output.txt - TypeScript Errors` --semantically_similar_to--> `tsc_output_v2.txt - TypeScript Errors`  [INFERRED] [semantically similar]
  tsc_output.txt → tsc_output_v2.txt
- `SalesPage()` --indirect_call--> `v()`  [INFERRED]
  src/features/user/pages/SalesPage.tsx → public/vendor/jspdf.min.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Database Migration Domains** — src_services_db_readme_stores, src_services_db_readme_users, src_services_db_readme_products, src_services_db_readme_inventory, src_services_db_readme_sales, src_services_db_readme_cash_sessions, src_services_db_readme_sync_queue [EXTRACTED 1.00]
- **Rust Compilation Blockers** — cargo_output_tauri_app, src_tauri_check_error_tokio, src_tauri_check_error_user_model, src_tauri_check_error_naive_date_time, cargo_output_sqlite_row_get [INFERRED 0.85]

## Communities (102 total, 39 thin omitted)

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
Cohesion: 0.05
Nodes (49): src/repositories/cash_repo.rs, CashSession, Expense Model, OtherIncome Model, cargo_output.txt - Rust Compilation Errors, SqliteRow::get() Missing Trait Error, Tauri App v0.1.0, index.html - VESTIKPOS Entry Point (+41 more)

### Community 4 - "Auth and Cash Commands"
Cohesion: 0.13
Nodes (43): AppState, add_cash_expense(), add_cash_other_income(), close_cash_session(), get_active_cash_session(), get_all_expenses(), get_all_other_income(), get_cash_session_transactions() (+35 more)

### Community 5 - "Inventory Models"
Cohesion: 0.10
Nodes (22): Category, Product, ProductWithCategory, NaiveDateTime, Option, String, InventoryRepository, Category (+14 more)

### Community 6 - "Package Dependencies"
Cohesion: 0.05
Nodes (26): dependencies, clsx, lottie-react, lucide-react, motion, react, react-dom, react-hook-form (+18 more)

### Community 7 - "Main App Core"
Cohesion: 0.11
Nodes (18): Error, Option, Result, Self, SqlitePool, Store, Vec, StoreRepository (+10 more)

### Community 8 - "Cash Session Models"
Cohesion: 0.13
Nodes (19): CashSession, CloseCashPayload, Expense, OpenCashPayload, OtherIncome, Option, String, UserSession (+11 more)

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
Cohesion: 0.18
Nodes (12): CashRepository, CashSession, Error, Expense, Option, OtherIncome, Result, Self (+4 more)

### Community 16 - "TypeScript Node Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 17 - "Category and Product Modals"
Cohesion: 0.13
Nodes (11): Category, CategoryModalProps, Category, Product, ProductModalProps, getStatusColor(), getStatusText(), InventoryTable() (+3 more)

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
Cohesion: 0.42
Nodes (10): create_user(), get_users(), login(), Option, Result, State, String, User (+2 more)

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

## Knowledge Gaps
- **287 isolated node(s):** `$schema`, `plugin`, `@opencode-ai/plugin`, `name`, `private` (+282 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppState` connect `Auth and Cash Commands` to `Sales Commands`, `Inventory Models`, `Main App Core`, `Cash Session Models`, `User Commands`, `Auth Commands`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `AuthService` connect `Main App Core` to `User Models`, `Auth and Cash Commands`, `Auth Commands`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `CashService` connect `Cash Session Models` to `Auth and Cash Commands`, `Cash Repository`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `e()` (e.g. with `A()` and `mr()`) actually correct?**
  _`e()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `plugin`, `@opencode-ai/plugin` to the rest of the system?**
  _288 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `html2canvas Vendor Library` be split into smaller, more focused modules?**
  _Cohesion score 0.03636363636363636 - nodes in this community are weakly interconnected._
- **Should `Sales Commands` be split into smaller, more focused modules?**
  _Cohesion score 0.07039187227866474 - nodes in this community are weakly interconnected._