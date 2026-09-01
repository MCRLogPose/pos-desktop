use super::apply::*;
use crate::sync::payloads::*;
use crate::sync::SyncItemStatus;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::migrate::Migrator;
use sqlx::SqlitePool;
use std::str::FromStr;

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
    seed(&pool).await;
    pool
}

async fn seed(pool: &SqlitePool) {
    // vendedor1 pertenece a la sede MAIN (id=1, sembrada por migracion 005):
    // asi la identidad compuesta (sede, username) resuelve al usuario local.
    sqlx::query("INSERT INTO users (username, password_hash, cargo, store_id, is_active, created_at) VALUES ('vendedor1', 'hash', 'VENDEDOR', 1, 1, datetime('now','localtime'))")
        .execute(pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO products (code, name, category_id, price, cost, stock, min_stock, is_active, store_id, created_at) VALUES ('SHO-001', 'Short M', 1, 50.0, 30.0, 10, 5, 1, 1, datetime('now','localtime'))")
        .execute(pool)
        .await
        .unwrap();
}

async fn count(pool: &SqlitePool, sql: &str) -> i64 {
    sqlx::query_scalar(sql).fetch_one(pool).await.unwrap()
}

async fn f64_at(pool: &SqlitePool, sql: &str) -> f64 {
    sqlx::query_scalar(sql).fetch_one(pool).await.unwrap()
}

#[tokio::test]
async fn sales_apply_once_and_link_items() {
    let pool = test_pool().await;
    let batch = SalesBatch {
        sales: vec![SaleSync {
            sync_uuid: "sale-0001".into(),
            local_order_id: 7,
            seller_username: Some("vendedor1".into()),
            client_document: Some("12345678".into()),
            client_phone: None,
            client_name: Some("Cliente SAC".into()),
            payment_method: "yape".into(),
            subtotal: 84.74,
            igv: 15.26,
            total: 100.0,
            cash_session_uuid: None,
            created_at: "2026-08-23 14:00:00".into(),
            items: vec![SaleItemSync {
                product_code: Some("SHO-001".into()),
                product_name: "Short M".into(),
                unit_price: 50.0,
                quantity: 2,
                subtotal: 100.0,
            }],
        }],
    };

    let acks = apply_sales_batch(&pool, &batch, "dev-1", Some("MAIN")).await;
    assert_eq!(acks[0].status, SyncItemStatus::Accepted);
    assert!(acks[0].primary_id.is_some());

    let replay = apply_sales_batch(&pool, &batch, "dev-1", Some("MAIN")).await;
    assert_eq!(replay[0].status, SyncItemStatus::Duplicate);

    assert_eq!(count(&pool, "SELECT COUNT(*) FROM orders").await, 1);
    assert_eq!(count(&pool, "SELECT COUNT(*) FROM order_items").await, 1);
    assert_eq!(
        f64_at(&pool, "SELECT total FROM orders WHERE uuid = 'sale-0001'").await,
        100.0
    );
}

#[tokio::test]
async fn unknown_seller_is_rejected_and_not_persisted() {
    let pool = test_pool().await;
    let batch = SalesBatch {
        sales: vec![SaleSync {
            sync_uuid: "sale-bad".into(),
            local_order_id: 1,
            seller_username: Some("fantasma".into()),
            client_document: None,
            client_phone: None,
            client_name: None,
            payment_method: "cash".into(),
            subtotal: 10.0,
            igv: 0.0,
            total: 10.0,
            cash_session_uuid: None,
            created_at: "2026-08-23 15:00:00".into(),
            items: vec![],
        }],
    };

    let acks = apply_sales_batch(&pool, &batch, "dev-1", Some("MAIN")).await;
    assert_eq!(acks[0].status, SyncItemStatus::Rejected);
    assert!(acks[0].message.as_deref().unwrap().contains("fantasma"));
    assert_eq!(count(&pool, "SELECT COUNT(*) FROM orders").await, 0);
    assert_eq!(
        count(&pool, "SELECT COUNT(*) FROM sync_applied_items").await,
        0
    );
}

#[tokio::test]
async fn stock_movements_apply_exactly_once() {
    let pool = test_pool().await;
    let batch = InventoryBatch {
        categories: vec![],
        product_upserts: vec![],
        stock_movements: vec![StockMovementSync {
            sync_uuid: "mov-0001".into(),
            product_code: Some("SHO-001".into()),
            product_name: "Short M".into(),
            delta: -3,
            reason: StockReason::Sale,
            reference_uuid: None,
            resulting_stock: Some(7),
            occurred_at: "2026-08-23 14:05:00".into(),
        }],
    };

    let acks = apply_inventory_batch(&pool, &batch, "dev-1", Some("MAIN")).await;
    assert_eq!(acks[0].status, SyncItemStatus::Accepted);
    assert_eq!(
        count(&pool, "SELECT stock FROM products WHERE code = 'SHO-001'").await,
        7
    );

    let replay = apply_inventory_batch(&pool, &batch, "dev-1", Some("MAIN")).await;
    assert_eq!(replay[0].status, SyncItemStatus::Duplicate);
    assert_eq!(
        count(&pool, "SELECT stock FROM products WHERE code = 'SHO-001'").await,
        7
    );
}

#[tokio::test]
async fn catalog_upsert_updates_existing_rows() {
    let pool = test_pool().await;
    let batch = CatalogBatch {
        stores: vec![StoreSync {
            sync_uuid: "store-0001".into(),
            local_store_id: 9,
            code: Some("SANJUAN".into()),
            name: "San Juan".into(),
            address: Some("Av. 1".into()),
            is_active: true,
            created_at: None,
        }],
        users: vec![UserSync {
            sync_uuid: "user-0001".into(),
            local_user_id: 55,
            username: "vendedor1".into(),
            cargo: Some("ADMIN".into()),
            email: None,
            store_code: Some("MAIN".into()),
            role_name: None,
            is_active: true,
            created_at: None,
        }],
    };

    let acks = apply_catalog_batch(&pool, &batch, "dev-1", None).await;
    assert!(acks.iter().all(|a| a.status == SyncItemStatus::Accepted));

    let cargo: String =
        sqlx::query_scalar("SELECT cargo FROM users WHERE username = 'vendedor1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(cargo, "ADMIN");
    assert_eq!(count(&pool, "SELECT COUNT(*) FROM stores").await, 2);
    assert_eq!(count(&pool, "SELECT COUNT(*) FROM users").await, 1);

    let replay = apply_catalog_batch(&pool, &batch, "dev-1", None).await;
    assert!(replay.iter().all(|a| a.status == SyncItemStatus::Accepted));
    assert_eq!(count(&pool, "SELECT COUNT(*) FROM stores").await, 2);
}

#[tokio::test]
async fn user_sync_preserves_local_password() {
    let pool = test_pool().await;
    let batch = CatalogBatch {
        stores: vec![],
        users: vec![UserSync {
            sync_uuid: "user-0001".into(),
            local_user_id: 55,
            username: "vendedor1".into(),
            cargo: Some("VENDEDOR".into()),
            email: Some("nuevo@x.com".into()),
            store_code: Some("MAIN".into()),
            role_name: None,
            is_active: true,
            created_at: None,
        }],
    };

    let acks = apply_catalog_batch(&pool, &batch, "dev-1", None).await;
    assert!(acks.iter().all(|a| a.status == SyncItemStatus::Accepted));

    // El hash local ('hash') debe sobrevivir al sync: las credenciales nunca viajan.
    let hash: String =
        sqlx::query_scalar("SELECT password_hash FROM users WHERE username = 'vendedor1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(hash, "hash");

    let email: String =
        sqlx::query_scalar("SELECT email FROM users WHERE username = 'vendedor1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(email, "nuevo@x.com");
}

#[tokio::test]
async fn directory_users_cannot_login_locally() {
    let pool = test_pool().await;
    let batch = CatalogBatch {
        stores: vec![StoreSync {
            sync_uuid: "store-0002".into(),
            local_store_id: 9,
            code: Some("SANJUAN".into()),
            name: "San Juan".into(),
            address: None,
            is_active: true,
            created_at: None,
        }],
        users: vec![UserSync {
            sync_uuid: "user-0002".into(),
            local_user_id: 56,
            username: "cajera01".into(),
            cargo: Some("VENDEDOR".into()),
            email: None,
            store_code: Some("SANJUAN".into()),
            role_name: None,
            is_active: true,
            created_at: None,
        }],
    };

    let acks = apply_catalog_batch(&pool, &batch, "dev-2", None).await;
    assert!(acks.iter().all(|a| a.status == SyncItemStatus::Accepted));

    let hash: String =
        sqlx::query_scalar("SELECT password_hash FROM users WHERE username = 'cajera01'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(!hash.starts_with("$2")); // no es un hash bcrypt valido
}

#[tokio::test]
async fn admin_account_is_never_synced() {
    let pool = test_pool().await;
    let batch = CatalogBatch {
        stores: vec![],
        users: vec![UserSync {
            sync_uuid: "user-admin-1".into(),
            local_user_id: 99,
            username: "admin".into(),
            cargo: Some("ADMIN".into()),
            email: None,
            store_code: Some("MAIN".into()),
            role_name: None,
            is_active: true,
            created_at: None,
        }],
    };

    let acks = apply_catalog_batch(&pool, &batch, "dev-otro", None).await;
    assert_eq!(acks[0].status, SyncItemStatus::Rejected);
    assert!(acks[0].message.as_deref().unwrap_or_default().contains("admin"));
    assert_eq!(
        count(&pool, "SELECT COUNT(*) FROM users WHERE username = 'admin'").await,
        0
    );
}

#[tokio::test]
async fn same_username_in_different_stores_coexist() {
    let pool = test_pool().await;
    let mk_store = |uuid: &str, code: &str| StoreSync {
        sync_uuid: uuid.into(),
        local_store_id: 0,
        code: Some(code.into()),
        name: format!("Sede {code}"),
        address: None,
        is_active: true,
        created_at: None,
    };
    let mk_user = |uuid: &str, store_code: &str| UserSync {
        sync_uuid: uuid.into(),
        local_user_id: 0,
        username: "cajero01".into(),
        cargo: Some("VENDEDOR".into()),
        email: None,
        store_code: Some(store_code.into()),
        role_name: None,
        is_active: true,
        created_at: None,
    };

    let batch = CatalogBatch {
        stores: vec![mk_store("store-A", "SANJUAN"), mk_store("store-B", "MIRAFLORES")],
        users: vec![mk_user("user-A", "SANJUAN"), mk_user("user-B", "MIRAFLORES")],
    };

    let acks = apply_catalog_batch(&pool, &batch, "multi-dev", None).await;
    assert!(acks.iter().all(|a| a.status == SyncItemStatus::Accepted));
    assert_eq!(
        count(&pool, "SELECT COUNT(*) FROM users WHERE username = 'cajero01'").await,
        2
    );

    // Reenvio del mismo lote: upserts idempotentes, sin duplicar filas.
    let replay = apply_catalog_batch(&pool, &batch, "multi-dev", None).await;
    assert!(replay.iter().all(|a| a.status == SyncItemStatus::Accepted));
    assert_eq!(
        count(&pool, "SELECT COUNT(*) FROM users WHERE username = 'cajero01'").await,
        2
    );
}

#[tokio::test]
async fn purchase_order_with_generated_expense_applies_once() {
    let pool = test_pool().await;
    let batch = PurchasesBatch {
        purchase_orders: vec![PurchaseOrderSync {
            sync_uuid: "po-0001".into(),
            local_purchase_order_id: 3,
            supplier_name: Some("Textiles SAC".into()),
            batch_date: "2026-08-23".into(),
            alias: Some("Lote viernes".into()),
            total_cost: 300.0,
            created_by_username: Some("vendedor1".into()),
            created_at: "2026-08-23 11:00:00".into(),
            items: vec![PurchaseItemSync {
                product_code: Some("SHO-001".into()),
                product_name: "Short M".into(),
                sku: None,
                category_name: Some("Short".into()),
                quantity: 10,
                unit_cost: 30.0,
                unit_price: 50.0,
            }],
            generated_expense: Some(ExpenseSync {
                sync_uuid: "exp-po-0001".into(),
                cash_session_uuid: None,
                source: "purchase".into(),
                description: "Compra Lote viernes".into(),
                amount: 300.0,
                payment_method: "cash".into(),
                category: Some("Mercaderia".into()),
                supplier: Some("Textiles SAC".into()),
                created_at: "2026-08-23 11:00:00".into(),
            }),
        }],
    };

    let acks = apply_purchases_batch(&pool, &batch, "dev-1", Some("MAIN")).await;
    eprintln!("ACK: {acks:?}");
    assert_eq!(acks[0].status, SyncItemStatus::Accepted);
    assert_eq!(count(&pool, "SELECT COUNT(*) FROM purchase_orders").await, 1);
    assert_eq!(
        count(&pool, "SELECT COUNT(*) FROM purchase_order_items").await,
        1
    );
    assert_eq!(count(&pool, "SELECT COUNT(*) FROM expenses").await, 1);

    let replay = apply_purchases_batch(&pool, &batch, "dev-1", Some("MAIN")).await;
    assert_eq!(replay[0].status, SyncItemStatus::Duplicate);
    assert_eq!(count(&pool, "SELECT COUNT(*) FROM expenses").await, 1);
}

#[tokio::test]
async fn income_without_session_links_to_latest() {
    let pool = test_pool().await;
    let sessions = CashBatch {
        sessions: vec![CashSessionSync {
            sync_uuid: "sess-0001".into(),
            local_session_id: 12,
            opened_by_username: Some("vendedor1".into()),
            opened_at: "2026-08-23 09:00:00".into(),
            closed_by_username: None,
            closed_at: None,
            opening_cash: 100.0,
            opening_virtual: 50.0,
            expected_closing_cash: 150.0,
            expected_closing_virtual: 60.0,
            real_closing_cash: None,
            real_closing_virtual: None,
            difference: None,
            justification: None,
            status: "open".into(),
        }],
        expenses: vec![],
        incomes: vec![OtherIncomeSync {
            sync_uuid: "inc-0001".into(),
            cash_session_uuid: None,
            description: "Deposito yape extra".into(),
            amount: 25.0,
            payment_method: "virtual".into(),
            created_at: "2026-08-23 13:00:00".into(),
        }],
    };

    let acks = apply_cash_batch(&pool, &sessions, "dev-1", Some("MAIN")).await;
    assert!(acks.iter().all(|a| a.status == SyncItemStatus::Accepted));
    assert_eq!(count(&pool, "SELECT COUNT(*) FROM cash_sessions").await, 1);
    assert_eq!(count(&pool, "SELECT COUNT(*) FROM other_income").await, 1);

    let linked: i64 = sqlx::query_scalar(
        "SELECT cash_session_id FROM other_income WHERE uuid = 'inc-0001'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(linked, 1);
}

#[tokio::test]
async fn anulacion_borra_y_registra_justificacion() {
    use crate::repositories::sales_repo::SalesRepository;

    let pool = test_pool().await;

    // ADMIN para la prueba de permisos
    sqlx::query("INSERT INTO users (username, password_hash, cargo, store_id, is_active) VALUES ('admin2', 'hash', 'ADMIN', 1, 1)")
        .execute(&pool)
        .await
        .unwrap();

    // Sesion de caja abierta
    sqlx::query("INSERT INTO cash_sessions (uuid, store_id, opened_by, opening_cash, opening_virtual, expected_closing_cash, expected_closing_virtual, status) VALUES ('cs-1', 1, 1, 0, 0, 0, 0, 'open')")
        .execute(&pool)
        .await
        .unwrap();

    // Venta: vendedor1 (id sera el que corresponda), pago en efectivo, 1 item
    let seller_id: i64 =
        sqlx::query_scalar("SELECT id FROM users WHERE username = 'vendedor1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    let order_id = sqlx::query(
        "INSERT INTO orders (user_id, store_id, payment_method, subtotal, igv, total, cash_session_id, created_at, uuid, synced) VALUES (?, 1, 'cash', 42.37, 7.63, 50.0, 1, datetime('now','localtime'), 'order-uuid-1', 0)",
    )
    .bind(seller_id)
    .execute(&pool)
    .await
    .unwrap()
    .last_insert_rowid();
    sqlx::query(
        "INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal) VALUES (?, 1, 'Short M', 25.0, 2, 50.0)",
    )
    .bind(order_id)
    .execute(&pool)
    .await
    .unwrap();

    let stock_before: i64 =
        sqlx::query_scalar("SELECT stock FROM products WHERE id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(stock_before, 10);

    let repo = SalesRepository::new(pool.clone());

    // El vendedor que creo la venta puede anularla
    let res = repo.anular_venta(order_id, seller_id, "cliente se retracto".into(), None).await.unwrap();
    assert_eq!(res.total_anulado, 50.0);
    assert_eq!(res.items_count, 1);

    // orders y order_items eliminados
    assert_eq!(count(&pool, &format!("SELECT COUNT(*) FROM orders WHERE id = {order_id}")).await, 0);
    assert_eq!(count(&pool, "SELECT COUNT(*) FROM order_items").await, 0);
    // stock restaurado
    assert_eq!(count(&pool, "SELECT stock FROM products WHERE id = 1").await, 12);
    // esperado de caja revertido
    let expected_cash: f64 = sqlx::query_scalar("SELECT expected_closing_cash FROM cash_sessions WHERE id = 1")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(expected_cash, -50.0);
    // registro de anulacion creado
    assert_eq!(count(&pool, "SELECT COUNT(*) FROM ventas_anuladas").await, 1);
    assert_eq!(count(&pool, "SELECT COUNT(*) FROM items_anulados").await, 1);
    let reason: String = sqlx::query_scalar("SELECT reason FROM ventas_anuladas")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(reason, "cliente se retracto");
}

#[tokio::test]
async fn anulacion_valida_permisos_y_sync() {
    use crate::repositories::sales_repo::SalesRepository;

    let pool = test_pool().await;
    let _ = sqlx::query("INSERT INTO users (username, password_hash, cargo, store_id, is_active) VALUES ('admin2', 'hash', 'ADMIN', 1, 1)")
        .execute(&pool)
        .await
        .unwrap();
    let _ = sqlx::query("INSERT INTO users (username, password_hash, cargo, store_id, is_active) VALUES ('otro', 'hash', 'VENDEDOR', 1, 1)")
        .execute(&pool)
        .await
        .unwrap();

    let seller_id: i64 =
        sqlx::query_scalar("SELECT id FROM users WHERE username = 'vendedor1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    let otro_id: i64 =
        sqlx::query_scalar("SELECT id FROM users WHERE username = 'otro'")
            .fetch_one(&pool)
            .await
            .unwrap();
    let admin_id: i64 =
        sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin2'")
            .fetch_one(&pool)
            .await
            .unwrap();

    async fn make_order(pool: &SqlitePool, seller_id: i64, synced: i64) -> i64 {
        let oid = sqlx::query(
            "INSERT INTO orders (user_id, store_id, payment_method, subtotal, igv, total, cash_session_id, created_at, uuid, synced) VALUES (?, 1, 'cash', 42.37, 7.63, 50.0, NULL, datetime('now','localtime'), lower(hex(randomblob(16))), ?)",
        )
        .bind(seller_id)
        .bind(synced)
        .execute(pool)
        .await
        .unwrap()
        .last_insert_rowid();
        sqlx::query(
            "INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal) VALUES (?, 1, 'Short M', 25.0, 2, 50.0)",
        )
        .bind(oid)
        .execute(pool)
        .await
        .unwrap();
        oid
    }

    let repo = SalesRepository::new(pool.clone());

    // Vendedor sin permisos (no fue quien creo la venta) -> rechazado
    let o1 = make_order(&pool, seller_id, 0).await;
    let err = repo.anular_venta(o1, otro_id, "sin motivo".into(), None).await.unwrap_err();
    assert!(err.to_string().contains("ADMIN") || err.to_string().contains("creó"));

    // Venta ya sincronizada -> rechazada
    let o2 = make_order(&pool, seller_id, 1).await;
    let err = repo.anular_venta(o2, seller_id, "motivo".into(), None).await.unwrap_err();
    assert!(err.to_string().contains("sincronizada"));

    // ADMIN puede anular
    let o3 = make_order(&pool, seller_id, 0).await;
    repo.anular_venta(o3, admin_id, "motivo admin".into(), None).await.unwrap();
    assert_eq!(count(&pool, "SELECT COUNT(*) FROM ventas_anuladas").await, 1);

    // Justificacion obligatoria
    let o4 = make_order(&pool, seller_id, 0).await;
    let err = repo.anular_venta(o4, admin_id, "   ".into(), None).await.unwrap_err();
    assert!(err.to_string().contains("justificacion"));
}

#[tokio::test]
async fn anulaciones_se_listan_y_exportan() {
    use crate::repositories::sales_repo::SalesRepository;

    let pool = test_pool().await;

    // ADMIN que ejecutara la anulacion
    let admin_id = sqlx::query(
        "INSERT INTO users (username, password_hash, cargo, store_id, is_active) VALUES ('admin_t', 'hash', 'ADMIN', 1, 1)",
    )
    .execute(&pool)
    .await
    .unwrap()
    .last_insert_rowid();

    // Crear una venta (seller vendedor1) y anularla
    let seller_id: i64 =
        sqlx::query_scalar("SELECT id FROM users WHERE username = 'vendedor1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    let order_id = sqlx::query(
        "INSERT INTO orders (user_id, store_id, payment_method, subtotal, igv, total, cash_session_id, created_at, uuid, synced) VALUES (?, 1, 'yape', 84.74, 15.26, 100.0, NULL, datetime('now','localtime'), 'o-uuid-list', 0)",
    )
    .bind(seller_id)
    .execute(&pool)
    .await
    .unwrap()
    .last_insert_rowid();
    sqlx::query(
        "INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal) VALUES (?, 1, 'Short M', 50.0, 2, 100.0)",
    )
    .bind(order_id)
    .execute(&pool)
    .await
    .unwrap();

    let repo = SalesRepository::new(pool.clone());
    repo.anular_venta(order_id, admin_id, "error de digitacion".into(), None).await.unwrap();

    // Listado de cabeceras
    let list = repo.get_anulaciones(1).await.unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].reason, "error de digitacion");
    assert_eq!(list[0].payment_method, "yape");
    assert_eq!(list[0].total, 100.0);
    assert_eq!(list[0].order_id, Some(order_id));
    assert_eq!(list[0].cancelled_by.as_deref(), Some("admin_t"));

    // Detalle de items para exportacion
    let items = repo.get_all_items_anulados(1).await.unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].product_name, "Short M");
    assert_eq!(items[0].quantity, 2);
    assert_eq!(items[0].subtotal, 100.0);
    assert_eq!(items[0].anulacion_id, list[0].id);
}

#[tokio::test]
async fn detalle_venta_incluye_items() {
    use crate::repositories::sales_repo::SalesRepository;

    let pool = test_pool().await;

    let seller_id: i64 =
        sqlx::query_scalar("SELECT id FROM users WHERE username = 'vendedor1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    let order_id = sqlx::query(
        "INSERT INTO orders (user_id, store_id, payment_method, subtotal, igv, total, cash_session_id, created_at, uuid, synced) VALUES (?, 1, 'cash', 42.37, 7.63, 50.0, NULL, datetime('now','localtime'), 'o-uuid-detail', 0)",
    )
    .bind(seller_id)
    .execute(&pool)
    .await
    .unwrap()
    .last_insert_rowid();
    sqlx::query(
        "INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal) VALUES (?, 1, 'Short M', 25.0, 2, 50.0)",
    )
    .bind(order_id)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal) VALUES (?, 1, 'Jean Azul', 30.0, 1, 30.0)",
    )
    .bind(order_id)
    .execute(&pool)
    .await
    .unwrap();

    let repo = SalesRepository::new(pool.clone());
    let detail = repo.get_sale_detail(order_id).await.unwrap().expect("detalle no encontrado");

    assert_eq!(detail.items.len(), 2);
    assert_eq!(detail.items[0].product_name, "Short M");
    assert_eq!(detail.items[1].product_name, "Jean Azul");
    assert_eq!(detail.items[1].quantity, 1);
    // La cabecera debe incluir store_id para poder mapearse correctamente
    assert_eq!(detail.sale.id, order_id);
    assert_eq!(detail.sale.store_id, 1);
    assert_eq!(detail.sale.total, 50.0);
}

#[tokio::test]
async fn eliminar_producto_solo_admin() {
    use crate::repositories::inventory_repo::InventoryRepository;

    let pool = test_pool().await;

    let seller_id: i64 =
        sqlx::query_scalar("SELECT id FROM users WHERE username = 'vendedor1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    let admin_id: i64 = sqlx::query(
        "INSERT INTO users (username, password_hash, cargo, store_id, is_active) VALUES ('admin_del', 'hash', 'ADMIN', 1, 1)",
    )
    .execute(&pool)
    .await
    .unwrap()
    .last_insert_rowid();

    let product_id: i64 = sqlx::query(
        "INSERT INTO products (code, name, category_id, price, cost, stock, min_stock, is_active, store_id, created_at) VALUES ('DEL-001', 'Producto a eliminar', 1, 20.0, 10.0, 5, 2, 1, 1, datetime('now','localtime'))",
    )
    .execute(&pool)
    .await
    .unwrap()
    .last_insert_rowid();

    let repo = InventoryRepository::new(pool.clone());

    let err = repo
        .soft_delete_product(product_id)
        .await
        .map_err(|e| e.to_string());
    assert!(err.is_ok(), "el borrado del repo debe funcionar por si solo");

    let product_id2: i64 = sqlx::query(
        "INSERT INTO products (code, name, category_id, price, cost, stock, min_stock, is_active, store_id, created_at) VALUES ('DEL-002', 'Otro producto', 1, 20.0, 10.0, 5, 2, 1, 1, datetime('now','localtime'))",
    )
    .execute(&pool)
    .await
    .unwrap()
    .last_insert_rowid();

    // Un vendedor NO puede eliminarlo
    let err = sqlx::query_scalar::<_, bool>(
        "SELECT cargo = 'ADMIN' FROM users WHERE id = ?",
    )
    .bind(seller_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(!err, "vendedor1 no debe ser admin");

    // Un ADMIN sí
    let is_admin_admin: bool = sqlx::query_scalar("SELECT cargo = 'ADMIN' FROM users WHERE id = ?")
        .bind(admin_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(is_admin_admin, "admin_del debe ser admin");

    assert!(repo.user_is_admin(admin_id).await.unwrap());
    assert!(!repo.user_is_admin(seller_id).await.unwrap());

    // El servicio vuelve error para no-admin
    let svc = crate::services::inventory_service::InventoryService::new(pool.clone());
    let err = svc.delete_product(product_id2, seller_id).await.unwrap_err();
    assert!(err.contains("ADMIN"));

    // y éxito para admin
    svc.delete_product(product_id2, admin_id).await.unwrap();

    let is_active: bool = sqlx::query_scalar("SELECT is_active FROM products WHERE id = ?")
        .bind(product_id2)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(!is_active, "el producto debe quedar desactivado tras el borrado admin");
}
