import { getDB } from "./index";
import { isTauri } from "./tauri";

export async function seedDatabase(): Promise<void> {
    const tauri = await isTauri();

    if (!tauri) {
        console.warn("⚠️ No estamos en Tauri - Seed omitido");
        return;
    }

    const db = await getDB();

    console.log("🌱 Iniciando seed de datos...");

    // 1. Crear tienda por defecto
    await db.execute(
        `INSERT OR IGNORE INTO stores (id, name, code, address) 
     VALUES ('store-1', 'Tienda Principal', 'TP001', 'Av. Principal 123')`
    );

    // 2. Crear roles
    await db.execute(
        `INSERT OR IGNORE INTO roles (id, name) VALUES ('role-admin', 'ADMIN')`
    );
    await db.execute(
        `INSERT OR IGNORE INTO roles (id, name) VALUES ('role-seller', 'SELLER')`
    );

    // 3. Crear usuario admin (password: admin123)
    // En producción, usar bcrypt o similar
    await db.execute(
        `INSERT OR IGNORE INTO users (id, username, password_hash, email) 
     VALUES ('user-admin', 'admin', 'admin123', 'admin@pos.com')`
    );

    // 4. Asignar rol admin
    await db.execute(
        `INSERT OR IGNORE INTO user_roles (user_id, role_id) 
     VALUES ('user-admin', 'role-admin')`
    );

    // 5. Asignar tienda al admin
    await db.execute(
        `INSERT OR IGNORE INTO user_stores (user_id, store_id) 
     VALUES ('user-admin', 'store-1')`
    );

    // 6. Crear impuesto IGV (18%)
    await db.execute(
        `INSERT OR IGNORE INTO taxes (id, name, rate) 
     VALUES ('tax-igv', 'IGV', 18.00)`
    );

    // 7. Crear productos de ejemplo
    const products = [
        {
            id: "prod-1",
            sku: "COCA-500",
            title: "Coca Cola 500ml",
            price: 3.5,
            tax_id: "tax-igv",
        },
        {
            id: "prod-2",
            sku: "AGUA-600",
            title: "Agua San Luis 600ml",
            price: 2.0,
            tax_id: "tax-igv",
        },
        {
            id: "prod-3",
            sku: "PAN-FRAN",
            title: "Pan Francés",
            price: 0.3,
            tax_id: "tax-igv",
        },
    ];

    for (const product of products) {
        await db.execute(
            `INSERT OR IGNORE INTO products (id, sku, title, price, tax_id) 
       VALUES (?, ?, ?, ?, ?)`,
            [product.id, product.sku, product.title, product.price, product.tax_id]
        );
    }

    // 8. Crear inventario inicial
    for (const product of products) {
        await db.execute(
            `INSERT OR IGNORE INTO inventory_movements 
       (id, store_id, product_id, quantity, movement_type, notes) 
       VALUES (?, 'store-1', ?, 100, 'IN', 'Stock inicial')`,
            [`inv-${product.id}`, product.id]
        );
    }

    console.log("✅ Seed completado");
}
