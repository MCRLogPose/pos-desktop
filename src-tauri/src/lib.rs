pub mod commands;
pub mod db;
pub mod models;
pub mod repositories;
pub mod services;
pub mod sync;

use commands::auth::AppState;
use services::auth_service::AuthService;
use services::config_service::ConfigService;
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
            let cash_service = services::cash_service::CashService::new(pool.clone());
            let purchase_order_service =
                services::purchase_order_service::PurchaseOrderService::new(pool.clone());
            let sync_pool_for_server = pool.clone();
            let config_service = ConfigService::new(pool.clone());
            let sync_queue = sync::queue::SyncQueue::new(pool.clone());
            let sync_client = sync::client::SyncClient::new(pool);

                // Initialize Admin if needed
                auth_service
                    .initialize_admin()
                    .await
                    .expect("Failed to initialize admin");

                // Identidad unica de esta maquina para la sincronizacion
                if config_service
                    .get_config("device_id")
                    .await
                    .ok()
                    .flatten()
                    .is_none()
                {
                    let _ = config_service
                        .set_config("device_id", &uuid::Uuid::new_v4().to_string())
                        .await;
                }

                // El servidor de sincronizacion SOLO corre en Primary.
                // Replica no expone puertos: usara el cliente HTTP hacia la Primary.
                // Hybrid es local y no participa en sincronizacion.
                let mode = config_service
                    .get_operating_mode()
                    .await
                    .unwrap_or_else(|_| "hybrid".to_string());
                if mode == "primary" {
                    let sync_port = config_service
                        .get_config("sync_port")
                        .await
                        .ok()
                        .flatten()
                        .and_then(|v| v.parse::<u16>().ok())
                        .unwrap_or(8787);

                    // Token compartido que las replicas presentan como Authorization: Bearer
                    let sync_token = match config_service.get_config("sync_token").await {
                        Ok(Some(token)) if !token.is_empty() => token,
                        _ => {
                            let token = uuid::Uuid::new_v4().to_string();
                            if let Err(e) =
                                config_service.set_config("sync_token", &token).await
                            {
                                log::warn!("[sync] no se pudo guardar sync_token: {e}");
                            }
                            token
                        }
                    };

                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = sync::server::run_server(
                            sync_pool_for_server,
                            sync_port,
                            sync_token,
                        )
                        .await
                        {
                            log::error!("[sync] {e}");
                        }
                    });
                }

                // Manage State
                app_handle.manage(AppState {
                    auth_service,
                    inventory_service,
                    sales_service,
                    cash_service,
                    purchase_order_service,
                    config_service,
                    sync_queue,
                    sync_client,
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
            commands::auth::change_password,
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
            commands::sales::get_session_payment_summary,
            commands::sales::get_all_order_items,
            commands::sales::anular_venta,
            commands::sales::get_anulaciones,
            commands::sales::get_all_items_anulados,
            // Cash
            commands::cash::get_active_cash_session,
            commands::cash::get_last_closed_cash_session,
            commands::cash::get_cash_sessions,
            commands::cash::open_cash_session,
            commands::cash::close_cash_session,
            commands::cash::add_cash_expense,
            commands::cash::add_cash_other_income,
            commands::cash::get_cash_session_transactions,
            commands::cash::get_all_expenses,
            commands::cash::get_all_other_income,
            commands::cash::update_expense,
            commands::cash::delete_expense,
            commands::cash::add_expense_standalone,
            // Purchase Orders
            commands::purchase_order::create_purchase_order,
            commands::purchase_order::get_purchase_orders,
            commands::purchase_order::get_purchase_order_detail,
            // Config
            commands::config::get_operating_mode,
            commands::config::has_app_config,
            commands::config::set_operating_mode,
            commands::config::get_app_config,
            commands::config::set_app_config,
            commands::sync::force_sync_now,
        ])
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
