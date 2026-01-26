# Database Structure

Este directorio contiene la estructura de la base de datos SQLite para el POS Desktop.

## Migraciones

Las migraciones están organizadas por dominio:

### 001_stores_users.sql
- **Stores**: Soporte multi-tienda
- **Users**: Sistema de autenticación
- **Roles**: Control de acceso basado en roles (ADMIN, SELLER)
- **User Roles**: Relación usuarios-roles
- **User Stores**: Asignación de usuarios a tiendas

### 002_products.sql
- **Taxes**: Impuestos (IGV/VAT)
- **Products**: Catálogo de productos con SKU, precio, imagen remota
- **Discounts**: Sistema de descuentos (porcentaje o fijo)
- **Product Discounts**: Relación productos-descuentos

### 003_inventory.sql
- **Inventory Movements**: Movimientos de inventario (IN, OUT, SALE, ADJUST, TRANSFER)
- **Transfers**: Transferencias entre tiendas
- **Transfer Items**: Detalle de productos transferidos

### 004_sales.sql
- **Sales**: Ventas con subtotal, descuentos, impuestos
- **Sale Items**: Detalle de productos vendidos
- **Invoices**: Facturación electrónica (SUNAT ready)

### 005_cash.sql
- **Cash Sessions**: Sesiones de caja (apertura/cierre)
- **Cash Movements**: Movimientos de efectivo (SALE, IN, OUT)

### 006_sync.sql
- **Sync Queue**: Cola de sincronización para modo offline-first

## Uso

Las migraciones se ejecutan automáticamente al iniciar la aplicación:

```typescript
import { initDB } from './services/db'
import { seedDatabase } from './services/db/seed'

await initDB()        // Ejecuta todas las migraciones
await seedDatabase()  // Carga datos iniciales
```

## Datos Iniciales (Seed)

El archivo `seed.ts` crea:
- 1 tienda por defecto
- 2 roles (ADMIN, SELLER)
- 1 usuario admin (username: admin, password: admin123)
- 1 impuesto IGV (18%)
- 3 productos de ejemplo
- Inventario inicial de 100 unidades por producto

## Notas Importantes

- **Foreign Keys**: Habilitadas con `PRAGMA foreign_keys = ON`
- **Imágenes**: Solo URLs remotas (Cloudinary/CDN), no binarios locales
- **Offline First**: Todas las operaciones se guardan en `sync_queue` para sincronización posterior
- **Multi-Store**: Soporte completo para múltiples tiendas
- **SUNAT Ready**: Estructura preparada para facturación electrónica
