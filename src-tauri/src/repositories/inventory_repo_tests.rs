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

/// Un producto recien creado nace con `uuid`.
///
/// Regresion: `create_product` no escribia esa columna, y como
/// `enqueue_product` la lee, el decode de NULL fallaba y el producto nunca se
/// encolaba. La Primary se quedaba sin nombre, categoria, costo ni cantidad.
#[tokio::test]
async fn producto_nuevo_nace_con_uuid_y_se_encola() {
    let pool = test_pool().await;
    // La outbox solo acumula si el equipo es Replica.
    sqlx::query("INSERT OR REPLACE INTO app_config (key, value) VALUES ('operating_mode', 'replica')")
        .execute(&pool)
        .await
        .unwrap();

    let repo = InventoryRepository::new(pool.clone());
    let id = repo
        .create_product(
            Some("NEW-900"),
            "CamisaNueva",
            None,
            None,
            50.0,
            20.0,
            3,
            Some("UND"),
            None,
            STORE_ID,
            None,
            None,
        )
        .await
        .unwrap();

    let uuid: Option<String> = sqlx::query_scalar("SELECT uuid FROM products WHERE id = ?")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    let uuid = uuid.expect("el producto debe nacer con uuid");

    // El spawn del encolado es background: hay que darle tiempo.
    for _ in 0..50 {
        let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE entity = 'product'")
            .fetch_one(&pool)
            .await
            .unwrap();
        if n > 0 {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }

    let row: Option<(String, String)> =
        sqlx::query_as("SELECT item_uuid, payload FROM sync_outbox WHERE entity = 'product' LIMIT 1")
            .fetch_optional(&pool)
            .await
            .unwrap();
    let (item_uuid, payload) = row.expect("el producto debe quedar en la outbox");

    assert_eq!(item_uuid, uuid, "el item_uuid debe ser el uuid del producto, no ''");
    assert!(!item_uuid.is_empty(), "un item_uuid vacio no identifica nada");

    let v: serde_json::Value = serde_json::from_str(&payload).unwrap();
    assert_eq!(v["sync_uuid"], uuid.as_str());
    assert_eq!(v["name"], "CamisaNueva");
    assert_eq!(v["code"], "NEW-900");
    assert_eq!(v["cost"], 20.0);
    assert_eq!(v["price"], 50.0);
}

/// Un producto con `uuid` NULL (creado antes de la 022) se recuperaba: se le
/// asigna identidad y se encola igual.
#[tokio::test]
async fn producto_sin_uuid_se_recupera_al_encolar() {
    let pool = test_pool().await;
    sqlx::query("INSERT OR REPLACE INTO app_config (key, value) VALUES ('operating_mode', 'replica')")
        .execute(&pool)
        .await
        .unwrap();

    // Producto legacy: existe pero sin uuid, y sin fila en la outbox.
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO products (code, name, price, cost, stock, min_stock, is_active, store_id, created_at)
         VALUES ('LEGACY-1', 'ProductoLegacy', 30.0, 15.0, 4, 2, 1, ?1, datetime('now','localtime'))
         RETURNING id",
    )
    .bind(STORE_ID)
    .fetch_one(&pool)
    .await
    .unwrap();

    let repo = InventoryRepository::new(pool.clone());
    repo.update_product(
        id,
        Some("LEGACY-1"),
        "ProductoLegacy",
        None,
        None,
        30.0,
        15.0,
        Some(4),
        None,
        None,
        STORE_ID,
        None,
        None,
    )
    .await
    .unwrap();

    for _ in 0..50 {
        let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE entity = 'product'")
            .fetch_one(&pool)
            .await
            .unwrap();
        if n > 0 {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }

    let uuid: Option<String> = sqlx::query_scalar("SELECT uuid FROM products WHERE id = ?")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(uuid.is_some(), "update_product debe rellenar el uuid faltante");

    let item_uuid: Option<String> =
        sqlx::query_scalar("SELECT item_uuid FROM sync_outbox WHERE entity = 'product' LIMIT 1")
            .fetch_optional(&pool)
            .await
            .unwrap();
    assert!(item_uuid.is_some(), "el legacy tambien debe encolarse");
    assert!(!item_uuid.unwrap().is_empty());
}

/// `update_product` no debe cambiar el uuid de un producto que ya lo tiene: si
/// lo hiciera, la Primary lo veria como un producto distinto.
#[tokio::test]
async fn update_product_conserva_el_uuid_existente() {
    let pool = test_pool().await;
    sqlx::query("INSERT OR REPLACE INTO app_config (key, value) VALUES ('operating_mode', 'replica')")
        .execute(&pool)
        .await
        .unwrap();
    let repo = InventoryRepository::new(pool.clone());

    let id = repo
        .create_product(Some("KEEP-1"), "ConUuid", None, None, 10.0, 5.0, 1, None, None, STORE_ID, None, None)
        .await
        .unwrap();
    let before: String = sqlx::query_scalar("SELECT uuid FROM products WHERE id = ?")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();

    repo.update_product(id, Some("KEEP-1"), "ConUuid", None, None, 12.0, 6.0, Some(2), None, None, STORE_ID, None, None)
        .await
        .unwrap();

    let after: String = sqlx::query_scalar("SELECT uuid FROM products WHERE id = ?")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(before, after, "el uuid no debe rotar en una edicion normal");
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

// ───────────────────────── STOCK QUE VIAJA A LA PRIMARY ─────────────────────────
//
// La ficha del producto (`ProductUpsertSync`) no lleva la cantidad: la Primary
// crea el producto con stock 0 y la cantidad llega como evento en
// `StockMovementSync`. Ese canal existia pero no tenia productor, asi que en la
// Primary todo producto aparecia en 0 y por debajo de `min_stock`, es decir
// "agotado".

/// Espera a que la outbox tenga al menos `n` filas del tipo pedido.
///
/// Los encolados van en un `spawn` en segundo plano para no bloquear la UI, asi
/// que en un test hay que darles tiempo.
async fn wait_for_outbox(pool: &SqlitePool, entity: &str, n: i64) {
    for _ in 0..100 {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE entity = ?")
            .bind(entity)
            .fetch_one(pool)
            .await
            .unwrap();
        if count >= n {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    panic!("la outbox no alcanzo {n} filas de '{entity}'");
}

async fn set_replica(pool: &SqlitePool) {
    sqlx::query(
        "INSERT OR REPLACE INTO app_config (key, value) VALUES ('operating_mode', 'replica')",
    )
    .execute(pool)
    .await
    .unwrap();
}

async fn movement_deltas(pool: &SqlitePool, product_id: i64) -> Vec<i64> {
    let payloads: Vec<String> = sqlx::query_scalar(
        "SELECT payload FROM sync_outbox WHERE entity = 'stock_movement' AND entity_id = ?1
         ORDER BY id",
    )
    .bind(product_id.to_string())
    .fetch_all(pool)
    .await
    .unwrap();
    payloads
        .iter()
        .map(|p| {
            serde_json::from_str::<serde_json::Value>(p)
                .unwrap()
                .get("delta")
                .and_then(|v| v.as_i64())
                .expect("el payload debe traer delta")
        })
        .collect()
}

/// Crear un producto con 7 unidades encola un movimiento de +7.
///
/// Regresion del sintoma reportado: el producto llegaba completo a la Primary
/// (nombre, categoria, costo) pero con la cantidad en 0.
#[tokio::test]
async fn crear_producto_encola_el_stock_inicial() {
    let pool = test_pool().await;
    set_replica(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    let id = repo
        .create_product(
            Some("STK-1"),
            "ConStockInicial",
            None,
            None,
            10.0,
            4.0,
            7,
            None,
            None,
            STORE_ID,
            None,
            None,
        )
        .await
        .unwrap();

    wait_for_outbox(&pool, "stock_movement", 1).await;
    assert_eq!(movement_deltas(&pool, id).await, vec![7]);

    // El contador de "ya comunicado" queda igual al stock: si no, la
    // reconciliacion volveria a mandar el +7 y la Primary sumaria de mas.
    let (stock, synced): (i64, i64) =
        sqlx::query_as("SELECT stock, stock_synced FROM products WHERE id = ?")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(stock, 7);
    assert_eq!(synced, 7, "no debe quedar stock pendiente de comunicar");
}

/// Reponer mercaderia encola `+quantity`: es el camino que el cajero usa todos
/// los dias, y antes la Primary no recibia nada.
#[tokio::test]
async fn reposicion_encola_el_delta_de_stock() {
    let pool = test_pool().await;
    set_replica(&pool).await;
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    repo.add_stock_to_product(PRODUCT_ID, 6, 42.75, STORE_ID, None, "cash", "exp-stk-1")
        .await
        .unwrap();
    wait_for_outbox(&pool, "stock_movement", 1).await;

    assert_eq!(stock_of(&pool).await, 16);
    assert_eq!(movement_deltas(&pool, PRODUCT_ID).await, vec![6]);
}

/// Editar el producto sin tocar la cantidad no genera movimiento: se mandaria un
/// delta 0 que la Primary contaria como ruido en cada edicion de precio.
#[tokio::test]
async fn editar_sin_cambiar_el_stock_no_genera_movimiento() {
    let pool = test_pool().await;
    set_replica(&pool).await;
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    repo.update_product(
        PRODUCT_ID,
        Some("SHO-001"),
        "Short M",
        None,
        None,
        55.0,
        30.0,
        Some(10),
        None,
        None,
        STORE_ID,
        None,
        None,
    )
    .await
    .unwrap();

    wait_for_outbox(&pool, "product", 1).await;
    let n: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE entity = 'stock_movement'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(n, 0, "mismo stock, ningun movimiento");
}

/// Corregir el stock a mano desde el formulario manda la diferencia, no el valor
/// absoluto. Si mandara el valor absoluto, la Primary recibiria el mismo numero
/// que esta maquina y dejaria de acumular los deltas de las otras replicas.
#[tokio::test]
async fn edicion_de_stock_encola_solo_la_diferencia() {
    let pool = test_pool().await;
    set_replica(&pool).await;
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    repo.update_product(
        PRODUCT_ID,
        Some("SHO-001"),
        "Short M",
        None,
        None,
        50.0,
        30.0,
        Some(14),
        None,
        None,
        STORE_ID,
        None,
        None,
    )
    .await
    .unwrap();

    wait_for_outbox(&pool, "stock_movement", 1).await;
    assert_eq!(stock_of(&pool).await, 14);
    assert_eq!(movement_deltas(&pool, PRODUCT_ID).await, vec![4]);
}

/// Editar dos veces el mismo producto debe re-encolar la segunda version.
///
/// Regresion: `enqueue` usaba `INSERT OR IGNORE` y hay un indice UNIQUE sobre
/// `item_uuid`, que es el uuid del producto. La primera vez que se sincronizo, la
/// fila quedo con `synced = 1`; las ediciones siguientes caian contra ella y se
/// descartaban en silencio, asi que la Primary se quedaba con la primera version
/// para siempre (categoria, precio o nombre viejos).
#[tokio::test]
async fn editar_dos_veces_reencola_la_ultima_version() {
    let pool = test_pool().await;
    set_replica(&pool).await;
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    for (price, name) in [(50.0, "Short M"), (99.0, "Short M Rebajado")] {
        repo.update_product(
            PRODUCT_ID,
            Some("SHO-001"),
            name,
            None,
            None,
            price,
            30.0,
            Some(10),
            None,
            None,
            STORE_ID,
            None,
            None,
        )
        .await
        .unwrap();
    }
    wait_for_outbox(&pool, "product", 1).await;

    let (rows, payload): (i64, String) = sqlx::query_as(
        "SELECT COUNT(*), MAX(payload) FROM sync_outbox WHERE entity = 'product'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(rows, 1, "el mismo producto no debe ocupar dos filas");
    assert!(
        payload.contains("99"),
        "la ultima edicion es la que viaja: {payload}"
    );
    assert!(
        payload.contains("Short M Rebajado"),
        "y con su nombre nuevo: {payload}"
    );

    // Marcar la fila como sincronizada es lo que disparaba el bug: la segunda
    // edicion caia contra la fila ya aceptada.
    sqlx::query("UPDATE sync_outbox SET synced = 1")
        .execute(&pool)
        .await
        .unwrap();
    repo.update_product(
        PRODUCT_ID,
        Some("SHO-001"),
        "Short M Final",
        None,
        None,
        77.0,
        30.0,
        Some(10),
        None,
        None,
        STORE_ID,
        None,
        None,
    )
    .await
    .unwrap();

    for _ in 0..100 {
        let (synced, payload): (i64, String) = sqlx::query_as(
            "SELECT synced, payload FROM sync_outbox WHERE entity = 'product'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        if synced == 0 && payload.contains("77") {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    panic!("editar despues de sincronizar no reencolo la fila");
}

/// Vender y luego anular la venta no puede repetir el `item_uuid` del primer
/// movimiento.
///
/// El item_uuid se deriva del producto y de una generacion creciente, no del
/// stock resultante: con el stock como clave, la devolucion tras la anulacion
/// volveria a producir el mismo item_uuid, la Primary lo responderia como
/// `duplicate` y el delta se perderia.
#[tokio::test]
async fn venta_y_anulacion_no_repiten_el_item_uuid() {
    let pool = test_pool().await;
    set_replica(&pool).await;
    seed_product(&pool).await;

    sqlx::query(
        "UPDATE products SET uuid = 'prod-stk-test', stock = 10, stock_synced = 10 WHERE id = ?",
    )
    .bind(PRODUCT_ID)
    .execute(&pool)
    .await
    .unwrap();

    // Venta de 3 y devolucion de las 3: el stock vuelve a 10.
    crate::repositories::inventory_repo::enqueue_stock_movement(
        &pool,
        PRODUCT_ID,
        -3,
        crate::sync::payloads::StockReason::Sale,
        Some("order-1".into()),
    )
    .await
    .unwrap();
    crate::repositories::inventory_repo::enqueue_stock_movement(
        &pool,
        PRODUCT_ID,
        3,
        crate::sync::payloads::StockReason::Adjustment,
        Some("anulacion-1".into()),
    )
    .await
    .unwrap();

    let uuids: Vec<String> = sqlx::query_scalar(
        "SELECT item_uuid FROM sync_outbox WHERE entity = 'stock_movement' ORDER BY id",
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(uuids.len(), 2, "los dos movimientos deben coexistir");
    assert_ne!(
        uuids[0], uuids[1],
        "mismo item_uuid = la Primary lo vera como duplicado"
    );
    assert_eq!(movement_deltas(&pool, PRODUCT_ID).await, vec![-3, 3]);
}

/// Dar de baja un producto se propaga como estado.
///
/// Sin reencolar el `product_upsert` con `is_active = 0`, la Primary seguiria
/// mostrando la mercaderia como disponible para siempre.
#[tokio::test]
async fn dar_de_baja_el_producto_se_sincroniza() {
    let pool = test_pool().await;
    set_replica(&pool).await;
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    repo.soft_delete_product(PRODUCT_ID).await.unwrap();
    wait_for_outbox(&pool, "product", 1).await;

    let payload: String = sqlx::query_scalar("SELECT payload FROM sync_outbox WHERE entity = 'product'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(
        payload.contains("\"is_active\":false"),
        "la baja debe viajar: {payload}"
    );
}

// ───────────────────────── RECONCILIACION DEL CATALOGO ──────────────────────────

/// La reconciliacion recupera el stock que nunca se comunico.
///
/// Es el caso real que reporto el administrador: productos creados antes de que
/// existiera el encolado de movimientos. La outbox es un log de cambios, asi que
/// sin esto su stock no llegaria nunca, por mas syncs manuales que se hagan.
#[tokio::test]
async fn reconciliacion_manda_el_stock_pendiente_y_solo_una_vez() {
    let pool = test_pool().await;
    set_replica(&pool).await;
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    // Producto con 10 unidades de las que la Primary no sabe nada.
    let report = repo.reconcile_with_primary().await.unwrap();
    assert_eq!(report.products, 1);
    assert_eq!(report.stock_movements, 1);
    assert_eq!(movement_deltas(&pool, PRODUCT_ID).await, vec![10]);

    // Repetirla no duplica nada: el delta pendiente ya es 0.
    let again = repo.reconcile_with_primary().await.unwrap();
    assert_eq!(
        again.stock_movements, 0,
        "el stock ya estaba comunicado"
    );
    assert_eq!(movement_deltas(&pool, PRODUCT_ID).await, vec![10]);
}

/// La reconciliacion tambien reencola los productos inactivos.
///
/// Si no, dar de baja un producto en la replica se propagaria como ausencia y no
/// como estado, y el catalogo de la Primary quedaria desactualizado.
#[tokio::test]
async fn reconciliacion_incluye_productos_inactivos() {
    let pool = test_pool().await;
    set_replica(&pool).await;
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());
    repo.soft_delete_product(PRODUCT_ID).await.unwrap();

    let report = repo.reconcile_with_primary().await.unwrap();
    assert_eq!(
        report.products, 1,
        "un producto dado de baja tambien se reencola"
    );
    let payload: String = sqlx::query_scalar("SELECT payload FROM sync_outbox WHERE entity = 'product'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(payload.contains("\"is_active\":false"), "{payload}");
}

/// En modo Primary la reconciliacion no hace nada: la Primary no envia datos.
#[tokio::test]
async fn reconciliacion_no_hace_nada_en_primary() {
    let pool = test_pool().await;
    sqlx::query(
        "INSERT OR REPLACE INTO app_config (key, value) VALUES ('operating_mode', 'primary')",
    )
    .execute(&pool)
    .await
    .unwrap();
    seed_product(&pool).await;
    let repo = InventoryRepository::new(pool.clone());

    let err = repo.reconcile_with_primary().await.unwrap_err();
    assert!(err.contains("Replica"), "esperado aviso de modo, vino: {err}");

    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 0, "una Primary no debe acumular outbox");
}