use crate::models::inventory::{Category, ProductWithCategory};
use crate::models::inventory::Product;
use crate::sync::payloads::{CategorySync, ProductUpsertSync, StockMovementSync, StockReason};
use crate::sync::queue::SyncQueue;
use sqlx::SqlitePool;

/// Namespace fijo para derivar el `item_uuid` de un movimiento de stock.
///
/// `sync_outbox` tiene un indice UNIQUE sobre `item_uuid`: el movimiento no puede
/// usar el uuid del producto porque ese ya lo ocupa el `product_upsert` y la
/// insercion se descartaria en silencio. Derivarlo con uuid5 da una identidad
/// estable y distinta por producto, y ademas repetible ante un reintento.
const STOCK_MOVEMENT_NAMESPACE: uuid::Uuid = uuid::Uuid::from_bytes([
    0x9e, 0x1f, 0x4b, 0x2c, 0x6d, 0x53, 0x4a, 0x8e, 0x9c, 0x37, 0x21, 0x5b, 0x44, 0x0d, 0x77, 0xa9,
]);

/// Encola el movimiento de stock de un producto y deja constancia de cuanto se
/// le comunico a la Primary.
///
/// El delta viaja como evento, no como valor absoluto. El producto vive en la
/// sede que la Primary asigno a esta replica (`resolve_product_id` resuelve
/// dentro del `store_id`), y el stock de esa sede se reconstruye sumando los
/// movimientos que envia esa replica. Ademas, como la suma es ciega a repeticiones,
/// cada delta tiene que viajar exactamente una vez: por eso el `item_uuid` es
/// estable y la deduplicacion de la Primary es la unica barrera contra un doble
/// conteo.
///
/// El `item_uuid` se deriva del uuid del producto mas el numero de generacion
/// (`stock_moves_synced`, que solo crece). Usar el stock absoluto como clave
/// no serviria: un producto que vuelve al mismo stock -se vende y luego se anula
/// esa venta- generaria el mismo item_uuid y la Primary lo tomaria por
/// duplicado, perdiendo ese delta.
///
/// El avance de `stock_synced` y la fila de la outbox van en la misma
/// transaccion a proposito. Por separado, un cierre entre ambas dejaria el
/// contador adelantado sin movimiento encolado (delta perdido para siempre) o el
/// movimiento encolado sin contador (la reconciliacion lo mandaria otra vez y la
/// Primary sumaria de mas).
///
/// Se invoca SIEMPRE despues del commit de la escritura que produjo el delta.
pub(crate) async fn enqueue_stock_movement(
    pool: &SqlitePool,
    product_id: i64,
    delta: i64,
    reason: StockReason,
    reference_uuid: Option<String>,
) -> Result<(), sqlx::Error> {
    if delta == 0 {
        return Ok(());
    }
    let queue = SyncQueue::new(pool.clone());
    if !queue.is_replica().await {
        return Ok(());
    }

    let mut tx = pool.begin().await?;

    // (uuid, code, nombre, stock actual, stock ya comunicado, movimientos enviados)
    let row: Option<(Option<String>, Option<String>, String, i64, i64, i64)> = sqlx::query_as(
        "SELECT uuid, code, name, stock, stock_synced, stock_moves_synced
         FROM products WHERE id = ?",
    )
    .bind(product_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((product_uuid, code, name, stock, stock_synced, generation)) = row else {
        tx.rollback().await?;
        return Ok(());
    };
    // Sin identidad no hay deduplicacion posible en la Primary: es preferible
    // saltarse el movimiento (la reconciliacion lo recuperara) que encolar un
    // item con uuid vacio, que colisionaria con cualquier otro.
    let Some(product_uuid) = product_uuid else {
        tx.rollback().await?;
        return Ok(());
    };

    let item_uuid = uuid::Uuid::new_v5(
        &STOCK_MOVEMENT_NAMESPACE,
        format!("{product_uuid}:stock:{}", generation + 1).as_bytes(),
    )
    .to_string();

    let movement = StockMovementSync {
        sync_uuid: item_uuid.clone(),
        product_code: code,
        product_name: name,
        delta,
        reason,
        reference_uuid,
        resulting_stock: Some(stock),
        occurred_at: chrono::Local::now().to_rfc3339(),
    };
    let payload = serde_json::to_string(&movement)
        .map_err(|e| sqlx::Error::Protocol(format!("serializar movimiento de stock: {e}").into()))?;

    sqlx::query(
        "INSERT INTO sync_outbox (topic, item_uuid, entity, entity_id, payload)
         VALUES ('inventory', ?1, 'stock_movement', ?2, ?3)
         ON CONFLICT(item_uuid) DO UPDATE SET
            payload = excluded.payload, synced = 0, last_error = NULL,
            updated_at = datetime('now','localtime')",
    )
    .bind(&item_uuid)
    .bind(&product_id.to_string())
    .bind(&payload)
    .execute(&mut *tx)
    .await?;

    sqlx::query("UPDATE products SET stock_synced = ?1, stock_moves_synced = ?2 WHERE id = ?3")
        .bind(stock_synced + delta)
        .bind(generation + 1)
        .bind(product_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}

pub struct InventoryRepository {
    pool: SqlitePool,
}

/// Resultado de reponer mercadería sobre un producto existente.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddStockOutcome {
    pub product_id: i64,
    pub new_stock: i64,
    pub expense_id: i64,
    pub expense_amount: f64,
}

impl InventoryRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    // Categories
    pub async fn get_categories(&self) -> Result<Vec<Category>, sqlx::Error> {
        sqlx::query_as::<_, Category>("SELECT * FROM categories ORDER BY name ASC")
            .fetch_all(&self.pool)
            .await
    }

    pub async fn create_category(&self, name: &str) -> Result<Category, sqlx::Error> {
        let result = sqlx::query("INSERT INTO categories (name) VALUES (?)")
            .bind(name)
            .execute(&self.pool)
            .await?;

        let id = result.last_insert_rowid();

        let pool = self.pool.clone();
        let name_owned = name.to_string();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_category(&pool, id, name_owned).await {
                log::warn!("[sync] no se pudo encolar categoria {id}: {e}");
            }
        });

        Ok(Category {
            id,
            name: name.to_string(),
        })
    }

    pub async fn update_category(&self, id: i64, name: &str) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE categories SET name = ? WHERE id = ?")
            .bind(name)
            .bind(id)
            .execute(&self.pool)
            .await?;

        let pool = self.pool.clone();
        let name_owned = name.to_string();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_category(&pool, id, name_owned).await {
                log::warn!("[sync] no se pudo encolar categoria {id}: {e}");
            }
        });
        Ok(())
    }

    pub async fn delete_category(&self, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM categories WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // Products
    pub async fn get_products(&self, store_id: i64) -> Result<Vec<ProductWithCategory>, sqlx::Error> {
        let sql = r#"
            SELECT 
                p.id, p.code, p.name, p.display_name, p.category_id, c.name as category_name,
                p.price, p.cost, p.stock, p.min_stock, p.unit, p.image_url, p.is_active, p.store_id, p.created_at,
                p.supplier_name, u.username as created_by_name,
                s.name as store_name,
                p.origin_device_id, p.origin_username
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN stores s ON p.store_id = s.id
            WHERE p.is_active = 1 AND p.store_id = ?
            ORDER BY p.name ASC
        "#;
        sqlx::query_as::<_, ProductWithCategory>(sql)
            .bind(store_id)
            .fetch_all(&self.pool)
            .await
    }

    pub async fn create_product(
        &self,
        code: Option<&str>,
        name: &str,
        display_name: Option<&str>,
        category_id: Option<i64>,
        price: f64,
        cost: f64,
        stock: i64,
        unit: Option<&str>,
        image_url: Option<&str>,
        store_id: i64,
        supplier_name: Option<&str>,
        created_by: Option<i64>,
    ) -> Result<i64, sqlx::Error> {
        // El `uuid` es la identidad que la Primary usa para deduplicar el catalogo.
// Sin el, `enqueue_product` no puede leer la fila y el producto nunca se
// sincroniza: por eso se genera aqui y no se deja en NULL.
let product_uuid = uuid::Uuid::new_v4().to_string();
        let result = sqlx::query(
            "INSERT INTO products (code, name, display_name, category_id, price, cost, stock, unit, image_url, store_id, supplier_name, created_by, uuid, origin_device_id, origin_username)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT value FROM app_config WHERE key = 'device_id'), (SELECT u.username FROM users u WHERE u.id = ?))"
        )
        .bind(code)
        .bind(name)
        .bind(display_name)
        .bind(category_id)
        .bind(price)
        .bind(cost)
        .bind(stock)
        .bind(unit)
        .bind(image_url)
        .bind(store_id)
        .bind(supplier_name)
        .bind(created_by)
        .bind(&product_uuid)
        .bind(created_by)
        .execute(&self.pool)
        .await?;

        let id = result.last_insert_rowid();

        let pool = self.pool.clone();
        let initial_stock = stock;
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_product(&pool, id).await {
                log::warn!("[sync] no se pudo encolar producto {id}: {e}");
            }
            // La ficha del producto no lleva la cantidad: en la Primary el
            // producto nace en 0 y la cantidad llega como movimiento. Sin esto,
            // un producto creado con 50 unidades aparecia "agotado" en la
            // Primary aunque la replica lo tuviera.
            if let Err(e) = enqueue_stock_movement(
                &pool,
                id,
                initial_stock,
                StockReason::Initial,
                None,
            )
            .await
            {
                log::warn!("[sync] no se pudo encolar el stock inicial del producto {id}: {e}");
            }
        });

        Ok(id)
    }

    /// `stock: Some(n)` escribe ese valor; `None` deja el stock como esta.
    ///
    /// La distincion importa porque no todos los que editan un producto tocan la
    /// cantidad. El ingreso de un lote actualiza precio y costo del producto
    /// existente y suma el stock por su cuenta: si aqui se escribiera un valor
    /// absoluto calculado antes, una venta ocurrida en medio se perderia.
    pub async fn update_product(
        &self,
        id: i64,
        code: Option<&str>,
        name: &str,
        display_name: Option<&str>,
        category_id: Option<i64>,
        price: f64,
        cost: f64,
        stock: Option<i64>,
        unit: Option<&str>,
        image_url: Option<&str>,
        store_id: i64,
        supplier_name: Option<&str>,
        created_by: Option<i64>,
    ) -> Result<(), sqlx::Error> {
        // Lectura y escritura van en la misma transaccion: el delta se calcula
        // sobre el estado real de la fila en el momento de guardar, no sobre el
        // valor que envio el cliente (el formulario puede llevar abierto mientras
        // se vende) ni sobre una lectura que otra venta pudo cambiar entre medio.
        let mut tx = self.pool.begin().await?;
        let previous_stock: Option<i64> =
            sqlx::query_scalar("SELECT stock FROM products WHERE id = ?")
                .bind(id)
                .fetch_optional(&mut *tx)
                .await?;
        let delta = match (stock, previous_stock) {
            (Some(new), Some(old)) => new - old,
            _ => 0,
        };

        // `uuid = COALESCE(uuid, ?)` en vez de pisarlo: el uuid ya encolado en la
        // outbox debe seguir coincidiendo con el de la fila, o la Primary lo
        // trataria como un producto distinto. Solo se rellena si falta.
        sqlx::query(
            "UPDATE products SET code=?, name=?, display_name=?, category_id=?, price=?, cost=?, stock=COALESCE(?, stock), unit=?, image_url=?, store_id=?, supplier_name=COALESCE(?, supplier_name), created_by=COALESCE(?, created_by), uuid=COALESCE(uuid, ?) WHERE id=?"
        )
        .bind(code)
        .bind(name)
        .bind(display_name)
        .bind(category_id)
        .bind(price)
        .bind(cost)
        .bind(stock)
        .bind(unit)
        .bind(image_url)
        .bind(store_id)
        .bind(supplier_name)
        .bind(created_by)
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(id)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        let pool = self.pool.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_product(&pool, id).await {
                log::warn!("[sync] no se pudo encolar producto {id}: {e}");
            }
            if let Err(e) =
                enqueue_stock_movement(&pool, id, delta, StockReason::Adjustment, None).await
            {
                log::warn!("[sync] no se pudo encolar el ajuste de stock del producto {id}: {e}");
            }
        });
        Ok(())
    }

    /// Suma `quantity` al stock del producto y actualiza su costo de compra.
    ///
    /// El incremento se hace en SQL (`stock = stock + ?`) y no con un valor
    /// absoluto calculado afuera, porque entre que se lee el producto y se
    /// escribe el stock puede haber una venta: el snapshot traeria la cantidad
    /// anterior y la sobreescritura dejaria la mercaderia vendida como si
    /// siguiera en bodega.
    pub async fn increase_stock(
        &self,
        id: i64,
        quantity: i64,
        unit_cost: f64,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE products SET stock = stock + ?1, cost = ?2 WHERE id = ?3")
            .bind(quantity)
            .bind(unit_cost)
            .bind(id)
            .execute(&self.pool)
            .await?;

        let pool = self.pool.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(e) =
                enqueue_stock_movement(&pool, id, quantity, StockReason::Purchase, None).await
            {
                log::warn!("[sync] no se pudo encolar el ingreso de stock del producto {id}: {e}");
            }
        });
        Ok(())
    }

    /// Reposicion de un producto existente: suma stock, actualiza el costo al
    /// precio de compra actual y registra el gasto por `unit_cost * quantity`,
    /// todo en una sola transaccion.
    ///
    /// El stock se suma en SQL (`stock = stock + ?`) a proposito: calcularlo en
    /// el cliente con `stock + qty` sobre un snapshot viejo pisaba las ventas
    /// que ocurrieran mientras el modal estaba abierto. Y el gasto va en la misma
    /// transaccion porque antes eran dos comandos independientes: si el segundo
    /// fallaba, el stock ya habia subido sin gasto que lo respaldara.
    pub async fn add_stock_to_product(
        &self,
        id: i64,
        quantity: i64,
        unit_cost: f64,
        store_id: i64,
        supplier_name: Option<&str>,
        payment_method: &str,
        expense_uuid: &str,
    ) -> Result<AddStockOutcome, String> {
        if quantity <= 0 {
            return Err("la cantidad debe ser mayor a 0".into());
        }
        if unit_cost <= 0.0 {
            return Err(
                "ingresa el costo de compra de esta mercadería: con costo 0 el gasto se \
                 registraría en 0 y las márgenes quedarían infladas"
                    .into(),
            );
        }

        let expense_amount = unit_cost * quantity as f64;
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| format!("no se pudo iniciar la operación: {e}"))?;

        let name: Option<String> =
            sqlx::query_scalar("SELECT name FROM products WHERE id = ? AND is_active = 1")
                .bind(id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| format!("no se pudo leer el producto: {e}"))?;

        let name = name.ok_or_else(|| "el producto no existe o está eliminado".to_string())?;

        sqlx::query("UPDATE products SET stock = stock + ?1, cost = ?2 WHERE id = ?3")
            .bind(quantity)
            .bind(unit_cost)
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("no se pudo actualizar el stock: {e}"))?;

        let new_stock: i64 =
            sqlx::query_scalar("SELECT stock FROM products WHERE id = ?")
                .bind(id)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| format!("no se pudo leer el stock resultante: {e}"))?;

        let description = format!("Ingreso mercadería: {name}");
        let expense_id = sqlx::query(
            "INSERT INTO expenses (uuid, cash_session_id, description, amount, payment_method, category, supplier, store_id, source, created_at)
             VALUES (?, NULL, ?, ?, ?, 'Mercadería', ?, ?, 'standalone', datetime('now', 'localtime'))",
        )
        .bind(expense_uuid)
        .bind(&description)
        .bind(expense_amount)
        .bind(payment_method)
        .bind(supplier_name)
        .bind(store_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("no se pudo registrar el gasto: {e}"))?
        .last_insert_rowid();

        tx.commit()
            .await
            .map_err(|e| format!("no se pudo confirmar la operación: {e}"))?;

        // Los encolados van despues del commit: si fallan, el dato local ya esta
        // y el outbox se recupera en el proximo sync.
        let pool = self.pool.clone();
        let uuid_owned = expense_uuid.to_string();
        let description_owned = description.clone();
        let payment_method_owned = payment_method.to_string();
        let supplier_owned = supplier_name.map(str::to_string);
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_product(&pool, id).await {
                log::warn!("[sync] no se pudo encolar producto {id}: {e}");
            }
            if let Err(e) =
                enqueue_stock_movement(&pool, id, quantity, StockReason::Purchase, None).await
            {
                log::warn!("[sync] no se pudo encolar la reposicion del producto {id}: {e}");
            }
            if let Err(e) = crate::repositories::cash_repo::enqueue_expense_standalone(
                &pool,
                &uuid_owned,
                expense_id,
                &description_owned,
                expense_amount,
                &payment_method_owned,
                Some("Mercadería".to_string()),
                supplier_owned,
            )
            .await
            {
                log::warn!("[sync] no se pudo encolar gasto general {expense_id}: {e}");
            }
        });

        Ok(AddStockOutcome {
            product_id: id,
            new_stock,
            expense_id,
            expense_amount,
        })
    }

    pub async fn soft_delete_product(&self, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE products SET is_active = 0 WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        // Dar de baja tambien es estado, no ausencia: sin reencolar, la Primary
        // seguiria mostrando el producto como disponible para siempre.
        let pool = self.pool.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = enqueue_product(&pool, id).await {
                log::warn!("[sync] no se pudo encolar la baja del producto {id}: {e}");
            }
        });
        Ok(())
    }

    /// Devuelve true si el usuario tiene cargo ADMIN.
    pub async fn user_is_admin(&self, user_id: i64) -> Result<bool, sqlx::Error> {
        let cargo: Option<String> =
            sqlx::query_scalar("SELECT cargo FROM users WHERE id = ?")
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(cargo
            .as_deref()
            .map(|c| c.eq_ignore_ascii_case("ADMIN"))
            .unwrap_or(false))
    }

    pub async fn find_by_code(
        &self,
        code: &str,
        store_id: i64,
    ) -> Result<Option<Product>, sqlx::Error> {
        sqlx::query_as::<_, Product>(
            "SELECT * FROM products WHERE code = ? AND store_id = ? AND is_active = 1",
        )
        .bind(code)
        .bind(store_id)
        .fetch_optional(&self.pool)
        .await
    }

    /// Reencola el catalogo completo y la diferencia de stock de cada producto.
    ///
    /// `sync_outbox` es un log de cambios, no un snapshot: solo viaja lo que se
    /// encolo en el momento de escribirse. Un producto que se creo mientras la
    /// maquina operaba como Primary, o antes de que existiera el encolado, nunca
    /// llegaria a la Primary por mas syncs manuales que se lancen. Este metodo es
    /// el mecanismo reutilizable que cierra ese hueco, en las dos dimensiones:
    ///
    /// - **catalogo**: reencola cada producto con su `item_uuid` real,
    ///   incluidos los inactivos (dar de baja se propaga como estado, no como
    ///   ausencia).
    /// - **stock**: encola `stock - stock_synced`, o sea solo lo que todavia no
    ///   se le comunico a la Primary. Es idempotente: si ya esta al dia, el delta
    ///   es 0 y no se encola nada.
    ///
    /// Repetirlo es seguro. En la Primary el `product_upsert` se reaplica sobre
    /// la misma fila y los movimientos ya aceptados responden `duplicate`.
    pub async fn reconcile_with_primary(&self) -> Result<ReconcileReport, String> {
        let queue = SyncQueue::new(self.pool.clone());
        if !queue.is_replica().await {
            return Err("solo la maquina en modo Replica envia datos a la Primary".into());
        }

        // Las categorias primero: el `product_upsert` las referencia por nombre
        // y la Primary las crea al vuelo si no llegan antes.
        let categories: Vec<(i64, String)> =
            sqlx::query_as("SELECT id, name FROM categories ORDER BY id")
                .fetch_all(&self.pool)
                .await
                .map_err(|e| format!("no se pudo leer el catalogo de categorias: {e}"))?;
        for (id, name) in &categories {
            enqueue_category(&self.pool, *id, name.clone())
                .await
                .map_err(|e| format!("no se pudo reencolar la categoria '{name}': {e}"))?;
        }

        let products: Vec<(i64, i64, i64)> = sqlx::query_as(
            "SELECT id, stock, stock_synced FROM products ORDER BY id",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("no se pudo leer el catalogo de productos: {e}"))?;

        let mut report = ReconcileReport {
            categories: categories.len(),
            products: 0,
            stock_movements: 0,
        };
        for (id, stock, stock_synced) in products {
            enqueue_product(&self.pool, id)
                .await
                .map_err(|e| format!("no se pudo reencolar el producto {id}: {e}"))?;
            report.products += 1;

            let delta = stock - stock_synced;
            if delta != 0 {
                enqueue_stock_movement(
                    &self.pool,
                    id,
                    delta,
                    // Razon `Initial`: para la Primary es la primera vez que ve
                    // esta mercaderia, sin importar que aqui sea una correccion.
                    StockReason::Initial,
                    None,
                )
                .await
                .map_err(|e| format!("no se pudo encolar la diferencia de stock del producto {id}: {e}"))?;
                report.stock_movements += 1;
            }
        }
        Ok(report)
    }
}

/// Resumen de lo que reencolo `reconcile_with_primary`.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconcileReport {
    pub categories: usize,
    pub products: usize,
    pub stock_movements: usize,
}

async fn enqueue_category(pool: &SqlitePool, id: i64, name: String) -> Result<(), sqlx::Error> {
    let queue = SyncQueue::new(pool.clone());
    let sync_uuid: Option<String> =
        sqlx::query_scalar("SELECT uuid FROM categories WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
    let Some(sync_uuid) = sync_uuid else {
        return Ok(());
    };
    queue
        .enqueue(
            "inventory",
            &sync_uuid,
            "category",
            &id.to_string(),
            &CategorySync {
                sync_uuid: sync_uuid.clone(),
                local_category_id: id,
                name,
            },
        )
        .await
}

async fn enqueue_product(pool: &SqlitePool, id: i64) -> Result<(), sqlx::Error> {
    let queue = SyncQueue::new(pool.clone());
let row: Option<(
            Option<String>,
            Option<String>,
            String,
            Option<String>,
            Option<String>,
            f64,
            f64,
            Option<i64>,
            Option<String>,
            Option<String>,
            bool,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        )> = sqlx::query_as(
            "SELECT p.uuid, p.code, p.name, p.display_name, c.name, p.price, p.cost, p.min_stock, p.unit, p.image_url, p.is_active,
                p.supplier_name, u.username,
                p.origin_device_id, p.origin_username
         FROM products p LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN users u ON p.created_by = u.id
         WHERE p.id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    let Some((
        sync_uuid,
        code,
        name,
        display_name,
        category_name,
        price,
        cost,
        min_stock,
        unit,
        image_url,
        is_active,
        supplier_name,
        created_by_username,
        origin_device_id,
        origin_username,
    )) = row
    else {
        return Ok(());
    };

    // Un producto sin `uuid` (creado antes de la migracion 022) no tiene
    // identidad con la que deduplicar en la Primary. Antes esto fallaba al
    // decodificar NULL en un String y el producto no se encolaba nunca, que es
    // como la Primary se quedaba sin nombre, categoria, costo ni cantidad.
    // Se le asigna uno aqui para que cualquier fila recupera la que le falte.
    let Some(sync_uuid) = sync_uuid else {
        let generated = uuid::Uuid::new_v4().to_string();
        sqlx::query("UPDATE products SET uuid = ? WHERE id = ? AND uuid IS NULL")
            .bind(&generated)
            .bind(id)
            .execute(pool)
            .await?;
        return queue
            .enqueue(
                "inventory",
                &generated,
                "product",
                &id.to_string(),
                &ProductUpsertSync {
                    sync_uuid: generated.clone(),
                    local_product_id: id,
                    code,
                    name,
                    display_name,
                    category_name,
                    price,
                    cost,
                    min_stock,
                    unit,
                    image_url,
                    is_active,
                    supplier_name,
                    created_by_username,
                    origin_device_id,
                    origin_username,
                    occurred_at: chrono::Local::now().to_rfc3339(),
                },
            )
            .await;
    };

    queue
        .enqueue(
            "inventory",
            &sync_uuid,
            "product",
            &id.to_string(),
            &ProductUpsertSync {
                sync_uuid: sync_uuid.clone(),
                local_product_id: id,
                code,
                name,
                display_name,
                category_name,
                price,
                cost,
                min_stock,
                unit,
                image_url,
                is_active,
                supplier_name,
                created_by_username,
                origin_device_id,
                origin_username,
                occurred_at: chrono::Local::now().to_rfc3339(),
            },
        )
        .await
}
