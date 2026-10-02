use super::queue::SyncQueue;
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
    sqlx::query("INSERT OR REPLACE INTO app_config (key, value) VALUES ('operating_mode', 'replica')")
        .execute(&pool)
        .await
        .unwrap();
    pool
}

async fn synced(pool: &SqlitePool, item_uuid: &str) -> i64 {
    sqlx::query_scalar("SELECT synced FROM sync_outbox WHERE item_uuid = ?")
        .bind(item_uuid)
        .fetch_one(pool)
        .await
        .unwrap()
}

/// Editar un producto mientras su catalogo viaja no puede perder el cambio.
///
/// El ACK de la Primary vuelve por `item_uuid`, y una edicion posterior usa el
/// mismo `item_uuid`. Si el ACK marcara la fila a ciegas, la version nueva
/// quedaria como sincronizada sin haberse enviado nunca: el unico sintoma era
/// que el cambio no aparecia hasta que alguien pedia un reenvio completo.
#[tokio::test]
async fn el_ack_no_marca_un_payload_que_cambio_en_vuelo() {
    let pool = test_pool().await;
    let queue = SyncQueue::new(pool.clone());

    queue
        .enqueue(
            "inventory",
            "prod-1",
            "product",
            "1",
            &serde_json::json!({ "sync_uuid": "prod-1", "name": "version 1" }),
        )
        .await
        .unwrap();

    let enviado = queue.pending().await.unwrap();
    assert_eq!(enviado.len(), 1);
    let en_vuelo = enviado[0].revision;

    // El usuario edita el producto mientras el POST sigue en el camino.
    queue
        .enqueue(
            "inventory",
            "prod-1",
            "product",
            "1",
            &serde_json::json!({ "sync_uuid": "prod-1", "name": "version 2" }),
        )
        .await
        .unwrap();

    // Llega el ACK de lo que se envio.
    queue
        .mark_synced(&[("prod-1".to_string(), en_vuelo)])
        .await
        .unwrap();
    assert_eq!(
        synced(&pool, "prod-1").await,
        0,
        "la version nueva no puede quedar marcada como enviada"
    );

    // Y sale en el siguiente sync, ya con el dato nuevo.
    let siguiente = queue.pending().await.unwrap();
    assert_eq!(siguiente.len(), 1);
    assert_eq!(siguiente[0].payload["name"], "version 2");
    assert!(siguiente[0].revision > en_vuelo);

    queue
        .mark_synced(&[("prod-1".to_string(), siguiente[0].revision)])
        .await
        .unwrap();
    assert_eq!(synced(&pool, "prod-1").await, 1);
    assert!(queue.pending().await.unwrap().is_empty());
}

/// El camino normal: nada cambio mientras viajaba, asi que el ACK marca la fila.
#[tokio::test]
async fn el_ack_marca_el_item_si_no_cambio() {
    let pool = test_pool().await;
    let queue = SyncQueue::new(pool.clone());
    queue
        .enqueue(
            "inventory",
            "prod-2",
            "product",
            "2",
            &serde_json::json!({ "sync_uuid": "prod-2" }),
        )
        .await
        .unwrap();

    let item = queue.pending().await.unwrap().remove(0);
    queue.mark_synced(&[("prod-2".to_string(), item.revision)]).await.unwrap();

    assert_eq!(synced(&pool, "prod-2").await, 1);
}
/// El detalle de la cola tiene que decir *que* falta y *por que*.
///
/// Un contador no distingue "no hay nada pendiente" de "tres filas lleva dias
/// fallando en silencio", y esa distincion es justo lo que impide diagnosticar
/// una replica que parece al dia y en realidad no lo esta.
#[tokio::test]
async fn el_detalle_de_la_cola_distingue_enviado_de_fallido() {
    let pool = test_pool().await;
    let queue = SyncQueue::new(pool.clone());

    queue
        .enqueue("sales", "sale-ok", "order", "1", &serde_json::json!({ "sync_uuid": "sale-ok" }))
        .await
        .unwrap();
    queue
        .enqueue("sales", "sale-espera", "order", "2", &serde_json::json!({ "sync_uuid": "sale-espera" }))
        .await
        .unwrap();
    queue
        .enqueue("cash", "cash-falla", "session", "1", &serde_json::json!({ "sync_uuid": "cash-falla" }))
        .await
        .unwrap();

    let enviado = queue.pending().await.unwrap().remove(0);
    queue.mark_synced(&[("sale-ok".to_string(), enviado.revision)]).await.unwrap();
    queue.mark_failed("sale-espera", "la Primary rechazo el vendedor").await.unwrap();

    assert_eq!(queue.pending_count().await.unwrap(), 2);
    assert_eq!(queue.failed_count().await.unwrap(), 1);
    assert_eq!(queue.synced_count().await.unwrap(), 1);

    let items = queue.pending_items(10).await.unwrap();
    assert_eq!(items.len(), 2);
    // Los que tienen error salen primero: son los que requieren atencion.
    assert_eq!(items[0].item_uuid, "sale-espera");
    assert_eq!(items[0].last_error.as_deref(), Some("la Primary rechazo el vendedor"));
    assert_eq!(items[1].item_uuid, "cash-falla");
    assert!(items[1].last_error.is_none(), "este todavia no se envio: no hay error");
    assert_eq!(items[1].topic, "cash");

    // Lo ya confirmado no aparece: son miles de filas y no aportan nada.
    assert!(items.iter().all(|i| i.item_uuid != "sale-ok"));
}

/// El limite protege de volcar una cola enorme en la UI.
#[tokio::test]
async fn el_detalle_de_la_cola_respeta_el_limite() {
    let pool = test_pool().await;
    let queue = SyncQueue::new(pool.clone());
    for i in 0..5 {
        queue
            .enqueue("sales", &format!("sale-{i}"), "order", &i.to_string(), &serde_json::json!({ "n": i }))
            .await
            .unwrap();
    }
    assert_eq!(queue.pending_items(2).await.unwrap().len(), 2);
}
