pub mod commands;
pub mod db;
pub mod models;
pub mod repositories;
pub mod services;

use commands::auth::AppState;
use services::auth_service::AuthService;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            // Initialize DB

            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let pool = db::init_db(&app_handle).await.expect("Failed to init DB");

                let auth_service = AuthService::new(pool.clone());
                let inventory_service =
                    services::inventory_service::InventoryService::new(pool.clone());
                let sales_service = services::sales_service::SalesService::new(pool.clone());
                let cash_service = services::cash_service::CashService::new(pool);

                // Initialize Admin if needed
                auth_service
                    .initialize_admin()
                    .await
                    .expect("Failed to initialize admin");

                // Manage State
                app_handle.manage(AppState {
                    auth_service,
                    inventory_service,
                    sales_service,
                    cash_service,
                });
            });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::login,
            commands::auth::create_user,
            commands::auth::get_users,
            commands::auth::verify_password,
            commands::store::get_stores,
            commands::store::create_store,
            commands::store::update_store,
            commands::store::delete_store,
            commands::user::get_all_users,
            commands::user::create_staff_user,
            commands::user::update_user,
            commands::user::delete_user,
            commands::user::get_users_by_store,
            // Inventory
            commands::inventory::get_categories,
            commands::inventory::create_category,
            commands::inventory::update_category,
            commands::inventory::delete_category,
            commands::inventory::get_products,
            commands::inventory::create_product,
            commands::inventory::update_product,
            commands::inventory::delete_product,
            // Sales
            commands::sales::create_sale,
            commands::sales::get_sales,
            commands::sales::get_sale_detail,
            commands::sales::get_all_order_items,
            // Cash
            commands::cash::get_active_cash_session,
            commands::cash::get_last_closed_cash_session,
            commands::cash::open_cash_session,
            commands::cash::close_cash_session,
            commands::cash::add_cash_expense,
            commands::cash::add_cash_other_income,
            commands::cash::get_cash_session_transactions,
        ])
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
