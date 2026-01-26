import Database from "@tauri-apps/plugin-sql";
import { isTauri } from "./tauri";

let db: Database | null = null;

export async function getDB(): Promise<Database> {
    const tauri = isTauri();

    if (!tauri) {
        throw new Error("No estamos en Tauri - SQLite no disponible");
    }

    if (!db) {
        db = await Database.load("sqlite:pos.db");
    }

    return db;
}

export async function runMigrations(): Promise<void> {
    const database = await getDB();

    const migrations = [
        "001_stores_users.sql",
        "002_products.sql",
        "003_inventory.sql",
        "004_sales.sql",
        "005_cash.sql",
        "006_sync.sql",
    ];

    console.log("🔄 Ejecutando migraciones...");

    for (const file of migrations) {
        try {
            const sql = await fetch(`/migrations/${file}`).then((r) => r.text());
            await database.execute(sql);
            console.log(`✅ Migración ${file} completada`);
        } catch (error) {
            console.error(`❌ Error en migración ${file}:`, error);
            throw error;
        }
    }

    console.log("✅ Todas las migraciones completadas");
}

export async function initDB(): Promise<void> {
    await runMigrations();
}
