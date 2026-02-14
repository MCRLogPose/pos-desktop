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

    Ok(pool)
}
