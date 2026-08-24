use sqlx::sqlite::SqlitePool;
use std::fs;
use tauri::AppHandle;
use tauri::Manager;

pub async fn init_db(app_handle: &AppHandle) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    let app_dir = app_handle.path().app_data_dir()?;
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }
    let db_path = app_dir.join("pos.db");
    let db_url = format!("sqlite://{}", db_path.to_string_lossy());

    if !std::path::Path::new(&db_path).exists() {
        std::fs::File::create(&db_path)?;
    }

    let pool = SqlitePool::connect(&db_url).await?;

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;
    ensure_user_identity_v2(&pool).await?;

    Ok(pool)
}

/// Identidad compuesta (sede, username) para `users`.
///
/// No puede vivir en el migrador: sqlx-sqlite envuelve cada migracion en una
/// transaccion y los PRAGMA (foreign_keys / legacy_alter_table) son no-ops
/// dentro de una transaccion. Aqui se ejecuta en autocommit, donde si aplican.
///
/// Idempotente: se detecta por la existencia del indice compuesto.
pub async fn ensure_user_identity_v2(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    let already_applied: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_users_store_username'",
    )
    .fetch_one(pool)
    .await?;

    if already_applied > 0 {
        return Ok(());
    }

    let mut conn = pool.acquire().await?;

    // Requiere AMBOS: foreign_keys=OFF (si esta activo, el RENAME reescribe las
    // clausulas REFERENCES sin importar legacy_alter_table) y
    // legacy_alter_table=ON (el RENAME no toca nada mas). Fuera de transaccion
    // ambos pragmas si aplican.
    sqlx::raw_sql("PRAGMA foreign_keys = OFF; PRAGMA legacy_alter_table = ON;")
        .execute(&mut *conn)
        .await?;

    sqlx::raw_sql(
        r#"
        BEGIN;
        ALTER TABLE users RENAME TO users_legacy;
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          cargo TEXT,
          email TEXT,
          store_id INTEGER,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          uuid TEXT,
          FOREIGN KEY (store_id) REFERENCES stores(id)
        );
        INSERT INTO users (id, username, password_hash, cargo, email, store_id, is_active, created_at, uuid)
        SELECT id, username, password_hash, cargo, email, store_id, is_active, created_at, uuid
        FROM users_legacy;
        DROP TABLE users_legacy;
        CREATE UNIQUE INDEX idx_users_uuid ON users(uuid);
        CREATE UNIQUE INDEX idx_users_store_username ON users (COALESCE(store_id, -1), username);
        CREATE INDEX idx_users_username ON users(username);
        COMMIT;
        "#,
    )
    .execute(&mut *conn)
    .await?;

    sqlx::raw_sql("PRAGMA foreign_keys = ON; PRAGMA legacy_alter_table = OFF;")
        .execute(&mut *conn)
        .await?;

    log::info!("[db] identidad compuesta (sede, username) aplicada");
    Ok(())
}
