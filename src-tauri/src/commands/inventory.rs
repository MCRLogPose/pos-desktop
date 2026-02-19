use tauri::State;
use crate::commands::auth::AppState;
use crate::models::inventory::{Category, ProductWithCategory};

// Categories CRUD

#[tauri::command]
pub async fn get_categories(state: State<'_, AppState>) -> Result<Vec<Category>, String> {
    state.inventory_service.get_categories().await
}

#[tauri::command]
pub async fn create_category(state: State<'_, AppState>, name: String) -> Result<Category, String> {
    state.inventory_service.create_category(&name).await
}

#[tauri::command]
pub async fn update_category(state: State<'_, AppState>, id: i64, name: String) -> Result<(), String> {
    state.inventory_service.update_category(id, &name).await
}

#[tauri::command]
pub async fn delete_category(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.inventory_service.delete_category(id).await
}

// Products CRUD

#[tauri::command]
pub async fn get_products(state: State<'_, AppState>) -> Result<Vec<ProductWithCategory>, String> {
    state.inventory_service.get_products().await
}

#[tauri::command]
pub async fn create_product(
    state: State<'_, AppState>, 
    code: Option<String>, 
    name: String, 
    category_id: Option<i64>, 
    price: f64, 
    cost: f64, 
    stock: i64, 
    unit: Option<String>, 
    image_url: Option<String>
) -> Result<i64, String> {
    state.inventory_service.create_product(
        code.as_deref(),
        &name,
        category_id,
        price,
        cost,
        stock,
        unit.as_deref(),
        image_url.as_deref()
    ).await
}

#[tauri::command]
pub async fn update_product(
    state: State<'_, AppState>, 
    id: i64,
    code: Option<String>, 
    name: String, 
    category_id: Option<i64>, 
    price: f64, 
    cost: f64, 
    stock: i64, 
    unit: Option<String>, 
    image_url: Option<String>
) -> Result<(), String> {
    state.inventory_service.update_product(
        id,
        code.as_deref(),
        &name,
        category_id,
        price,
        cost,
        stock,
        unit.as_deref(),
        image_url.as_deref()
    ).await
}

#[tauri::command]
pub async fn delete_product(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.inventory_service.delete_product(id).await
}
