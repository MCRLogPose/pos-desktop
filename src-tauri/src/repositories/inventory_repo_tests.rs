//! Tests de la reposicion de mercaderia sobre un producto existente.
//!
//! Regresion que motivan: el modal multiplicaba el costo base del producto por la
//! cantidad en el frontend y mandaba dos comandos sueltos. Con costo base 0 el
//! gasto quedaba en 0 sin avisar, el costo nunca se actualizaba, y una venta
//! concurrente se perdia porque el stock se calculaba en el cliente.

use super::inventory_repo::InventoryRepository;
use sqlx::migrate::Migrator;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;

const PRODUCT_ID: i64 = 1;
const STORE_ID: i64 = 1;

async fn test_pool() -> SqlitePool {
    let opts = SqliteConnectOptions::from_str("sqlite::memory:")
        .unwrap()
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
        .unwrap();
    static MIGRATOR: Migrator = sqlx::migrate!("./migrations");
    MIGRATOR.run(&pool).await.unwrap();
    crate::db::ensure_user_identity_v2(&pool).await.unwrap();
    pool
}

/// Producto con stock 10 y costo 30.
///
/// La sede `id=1` (MAIN) ya la crea la migracion 005, asi que aqui no se vuelve
/// a insertar: hacerlo con `id=1` explicito choca con el UNIQUE y el seed falla.
async fn seed_product(pool: &SqlitePool) {
    sqlx::query(
        "INSERT INTO products (id, code, name, price, cost, stock, min_stock, is_active, store_id, created_at)
         VALUES (?1, 'SHO-001', 'Short M', 50.0, 30.0, 10, 5, 1, ?2, datetime('now','localtime'))",
    )
    .bind(PRODUCT_ID)
    .bind(STORE_ID)
    .execute(pool)
    .await
    .unwrap();
}

async fn stock_of(pool: &SqlitePool) -> i64 {
    sqlx::query_scalar("SELECT stock FROM products WHERE id = ?")
        .bind(PRODUCT_ID)
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn cost_of(pool: &SqlitePool) -> f64 {
    sqlx::query_scalar("SELECT cost FROM products WHERE id = ?")
        .bind(PRODUCT_ID)
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn expense_amounts(pool: &SqlitePool) -> Vec<f64> {
    sqlx::query_scalar("SELECT amount FROM expenses ORDER BY id")
        .fetch_all(pool)
        .await
        .unwrap()
}

/// El gasto es exactamente costo_ingresado x cantidad, con el costo nuevo y no
/// con el que el producto traia antes.
#[tokio::test]
async fn gasto_usa_el_costo_ingresado_y_no_el_base() {
    let pool = test_pool().await;
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    let outcome = repo
        .add_stock_to_product(
            PRODUCT_ID,
            6,
            42.75,
            STORE_ID,
            Some("Acme"),
            "cash",
            "expense-uuid-1",
        )
        .await
        .unwrap();

    // El costo base era 30. Con el bug, el gasto habria sido 6 x 30 = 180.
    assert_eq!(outcome.expense_amount, 6.0 * 42.75);
    assert_eq!(expense_amounts(&pool).await, vec![256.5]);
    assert_eq!(outcome.new_stock, 16);
}

/// El costo del producto queda en el precio de compra actual, para que las
/// margenes futuras se calculen sobre el costo vigente.
#[tokio::test]
async fn el_costo_del_producto_se_actualiza() {
    let pool = test_pool().await;
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    repo.add_stock_to_product(PRODUCT_ID, 3, 18.40, STORE_ID, None, "virtual", "expense-uuid-2")
        .await
        .unwrap();

    assert_eq!(cost_of(&pool).await, 18.40);
    assert_eq!(stock_of(&pool).await, 13);
}

/// Un costo 0 se rechaza antes de tocar nada. Con el bug, el gasto se
/// registraba en 0 y el stock subia igual.
#[tokio::test]
async fn costo_cero_se_rechaza_sin_tocar_stock() {
    let pool = test_pool().await;
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    let err = repo
        .add_stock_to_product(PRODUCT_ID, 5, 0.0, STORE_ID, None, "cash", "expense-uuid-3")
        .await
        .unwrap_err();

    assert!(err.contains("costo"), "el error debe explicar el motivo: {err}");
    assert_eq!(stock_of(&pool).await, 10, "el stock no debe moverse");
    assert_eq!(cost_of(&pool).await, 30.0);
    assert!(expense_amounts(&pool).await.is_empty(), "no debe haber gasto");
}

#[tokio::test]
async fn cantidad_no_positiva_se_rechaza() {
    let pool = test_pool().await;
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    assert!(repo
        .add_stock_to_product(PRODUCT_ID, 0, 30.0, STORE_ID, None, "cash", "expense-uuid-4")
        .await
        .is_err());
    assert_eq!(stock_of(&pool).await, 10);
    assert!(expense_amounts(&pool).await.is_empty());
}

/// Un producto inexistente o borrado logicamente no debe crear stock fantasma ni
/// un gasto huerfano.
#[tokio::test]
async fn producto_inexistente_no_crea_gasto() {
    let pool = test_pool().await;
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    let err = repo
        .add_stock_to_product(9999, 4, 25.0, STORE_ID, None, "cash", "expense-uuid-5")
        .await
        .unwrap_err();

    assert!(err.contains("no existe"), "esperado: producto inexistente, veio: {err}");
    assert!(expense_amounts(&pool).await.is_empty());
}

/// El gasto queda como `standalone` de Mercadería, con su uuid y su proveedor:
/// es el mismo registro que antes creaba `add_expense_standalone`.
#[tokio::test]
async fn el_gasto_se_registra_como_mercaderia_standalone() {
    let pool = test_pool().await;
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    repo.add_stock_to_product(PRODUCT_ID, 2, 10.0, STORE_ID, Some("Acme"), "virtual", "exp-uuid-6")
        .await
        .unwrap();

    let row: (String, Option<String>, String, Option<String>, String) = sqlx::query_as(
        "SELECT description, supplier, payment_method, cash_session_id, source
         FROM expenses WHERE uuid = 'exp-uuid-6'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(row.0, "Ingreso mercadería: Short M");
    assert_eq!(row.1.as_deref(), Some("Acme"));
    assert_eq!(row.2, "virtual");
    assert!(row.3.is_none(), "un gasto standalone no cuelga de una sesion de caja");
    assert_eq!(row.4, "standalone");
}

/// Reposiciones repetidas acumulan stock y cada una genera su propio gasto, que
/// es justo lo que se pierde al calcular el total en el cliente.
#[tokio::test]
async fn varias_reposiciones_acumulan() {
    let pool = test_pool().await;
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    repo.add_stock_to_product(PRODUCT_ID, 5, 20.0, STORE_ID, None, "cash", "exp-a")
        .await
        .unwrap();
    repo.add_stock_to_product(PRODUCT_ID, 7, 22.0, STORE_ID, None, "cash", "exp-b")
        .await
        .unwrap();

    assert_eq!(stock_of(&pool).await, 22);
    assert_eq!(cost_of(&pool).await, 22.0, "el ultimo costo de compra gana");
    assert_eq!(expense_amounts(&pool).await, vec![100.0, 154.0]);
}