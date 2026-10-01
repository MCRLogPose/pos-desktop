# VESTIKPOS — Plan de pruebas de sincronización (2 máquinas, Tailscale)

**Fecha:** 2026-09-20
**Estado:** Configuración de sync disponible **desde la UI** (solo ADMIN). Pendiente: publicar build y ejecutar las pruebas en 2 máquinas.
**Última sesión:** identidad de sede por `device_id`, "Probar conexión" corregido, procedencia de producto y descarga CSV.

---

## 0. Resumen ejecutivo

| Qué | Estado |
|---|---|
| `pnpm build` (frontend ts + vite) | ✅ OK (dist/ generado) |
| `cargo check` (Rust) | ✅ OK |
| `cargo test` | ✅ 24/24 OK (incl. tests sync/apply + normalización de URL) |
| Servidor Axum sync en Primary (puerto 8787, Bearer token) | ✅ implementado |
| Cliente Réplica (outbox → POST a Primary) | ✅ implementado |
| Encolado de outbox en todas las escrituras | ✅ implementado |
| **UI para configurar `primary_url` / `sync_token` / `store_code`** | ✅ **Configuración → Sincronización (solo ADMIN)** |
| Botón `force_sync_now` ("Sincronizar ahora") | ✅ en Configuración (solo Replica) |
| Workflow CI para Release en GitHub | ❌ NO existe (se sube a mano) |
| Identidad de sede por `device_id` (`MAIN-<8 hex>`) | ✅ implemented (una sede por réplica, sin colisión por nombre) |
| Procedencia de producto (tienda / equipo / usuario) | ✅ en el detalle y en el CSV de inventario |
| Descarga de inventario en CSV | ✅ botón en Inventario |
| Pruebas reales Primary ↔ Réplica | ❌ Pendientes |

**Conclusión:** la configuración ya no se hace por SQL. Ver §4.

---

## 1. Cómo funciona la sync (recuerdo rápido)

- **Primary:** al iniciar en modo `primary`, levanta un servidor HTTP Axum en `0.0.0.0:8787` (`src-tauri/src/sync/server.rs`). Genera un `sync_token` aleatorio (UUID) en el primer arranque y lo guarda en su DB (`src-tauri/src/lib.rs:73-84`). Valida cada request con `Authorization: Bearer <token>`.
- **Réplica:** cada escritura registra una fila en la outbox (`sync_outbox`). Al **cerrar caja** se ejecuta `sync_client.sync_all()` que agrupa por topic (`sales`, `inventory`, `purchases`, `cash`, `catalog`, `anulaciones`) y hace POST a `{primary_url}/sync/{topic}` con el token (`src-tauri/src/sync/client.rs`).
- El comando `force_sync_now` (sync manual) tiene botón en la UI: **Configuración → Sincronizar ahora** (solo modo Replica).
- `operating_mode` y el arranque del server se leen **al iniciar la app** → cambiar Primary↔Réplica requiere reiniciar la app. El modal de la Primary indica si el servidor está escuchando.
- `primary_url` y `sync_token` se leen en **cada** `sync_all()` → cambiar la IP o el token aplica sin reiniciar.

---

## 2. Dónde vive la configuración (NO es .env ni archivo de código)

Todo está en la tabla **`app_config`** de la SQLite de la app, pero **la escribe la UI** desde Configuración.

**Ruta de la DB por máquina (Windows):**
```
C:\Users\<usuario>\AppData\Roaming\com.cruzr.vestikPOS\pos.db
```

| Clave | Quién la escribe | Para qué |
|---|---|---|
| `operating_mode` | SetupPage (UI) — valores `primary` / `replica` / `hybrid` | Define el rol |
| `device_id` | Auto en `lib.rs` (UUID v4) | Identidad única de la máquina |
| `sync_port` | UI (Primary), default 8787 | Puerto del servidor; requiere reiniciar |
| `sync_token` | Primary: auto al arrancar, se **copia** desde la UI · Replica: se **pega** en la UI | Bearer token compartido |
| `primary_url` | Réplica: se escribe en la UI (basta con la IP) | A dónde envía la Réplica |
| `store_code` | Réplica: opcional, en la UI | **Nombre referencial** de la sede en la Primary. No es la identidad: esta se deriva de `device_id` (`MAIN-<8 hex>`) |

> La Réplica falla con "falta configuracion primary_url en la Replica" si no tiene `primary_url` y `sync_token`.

---

## 3. Datos de red conocidos (Tailscale)

- IP Primary (referencia): `100.100.162.18`
- IP Réplica (referencia): `100.107.82.109`
- Puerto sync: `8787`
- La Primary debe escuchar en `0.0.0.0:8787` (ya lo hace) → en **Firewall de Windows de la Primary** hay que permitir el puerto 8787 por la red Tailscale, y la Réplica debe poder alcanzar `http://100.100.162.18:8787` (probar con `curl http://100.100.162.18:8787/health`).

---

## 4. Configuración por UI ( ADMIN ) — el camino normal

En **ambas** máquinas, iniciar sesión como `admin` y abrir **Configuración**. La tarjeta
**Sincronización** solo aparece para usuarios ADMIN.

### 4.1 En la máquina PRIMARY

1. **Configuración → Ver token**. El modal muestra:
   - **Token de sincronización** (con botón de copiar). Si no hay token, se genera ahí mismo.
   - **Estado del servidor**: "Servidor activo escuchando en el puerto 8787". Si dice que no
     está escuchando, cerrar y volver a abrir la app (el modo se lee al arrancar).
   - **IP de esta máquina**: lista las IPv4 detectadas, cada una con botón de copiar. Usar la de
     Tailscale (`100.x`) si ambas máquinas están en la misma red.
2. Dejar el **Puerto** en 8787 salvo que el firewall lo impida.

### 4.2 En la máquina RÉPLICA

1. En la Primary, copiar el token (icono de copiar) y la IP.
2. **Configuración → Configurar conexión** en la Réplica y:
   - **IP o dirección de la Primary**: se puede escribir solo `100.100.162.18`; la app agrega
     `http://` y `:8787` automáticamente.
   - **Token de sincronización**: pegar el copiado.
   - **Nombre de esta tienda en la Primary**: opcional pero recomendado (ej: `Gamarra`). Es el
     nombre con el que la sede aparecerá en la Primary. La identidad técnica de la sede se
     deriva sola del `device_id` de este equipo (`MAIN-<8 hex>`), así que dos réplicas nunca
     colisionan aunque ambas se llamen "Tienda Principal".
3. **Probar conexión** → debe responder "Conexión correcta con vestikpos-sync". Si falla con 401,
   el token no coincide con el de la Primary; si no responde, es IP/puerto o firewall.
4. **Guardar**. A partir de ahí, la Réplica envía al cerrar caja o con **Sincronizar ahora**.

### 4.3 Firewall (Primary, una sola vez)

El servidor escucha en `0.0.0.0:8787`, hay que permitirlo en el **Firewall de Windows** para la
red Tailscale. Verificar desde la Réplica: `curl http://<ip-primary>:8787/health` debe responder
`{"status":"ok"...}`.

### 4.4 Respaldo: configuración manual por DB

Solo como recurso de emergencia (p. ej. si no se puede entrar a la UI):

```python
import sqlite3
db = r"C:\Users\<usuario>\AppData\Roaming\com.cruzr.vestikPOS\pos.db"
c = sqlite3.connect(db)
def set(key, value):
    c.execute(
        "INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
        (key, value),
    )
    c.commit()

# --- MÁQUINA PRIMARY ---
set("operating_mode", "primary")
set("sync_port", "8787")
print(c.execute("SELECT value FROM app_config WHERE key='sync_token'").fetchone())

# --- MÁQUINA RÉPLICA ---
set("operating_mode", "replica")
set("primary_url", "http://100.100.162.18:8787")
set("sync_token", "<token copiado de la Primary>")
set("store_code", "<codigo-de-tienda>")   # opcional
```

---

## 5. Cómo probar A↔B (swap de roles)

1. **Configurar cada máquina** según §4.1 (Primary) y §4.2 (Réplica).
2. **Reiniciar la app** en la máquina que cambia de rol (el arranque del servidor y `operating_mode` se leen al inicio).
3. Al cambiar quién es Primary: la **nueva** Primary genera su **propio token** → recopiarlo desde
   su modal a la(s) réplica(s), junto con su nueva IP.
4. Prueba mínima:
   - En la Réplica: abrir caja → registrar venta(s) → **Sincronizar ahora** (o cerrar caja).
   - En la Primary: revisar que llegó (`SELECT * FROM sync_log;` ordenado por id desc) y que la venta apareció en `orders`.
5. "Probar conexión" en la Réplica debe responder correcto. Para verificar a mano por consola,
   `/health` **también exige token**:
   `curl -H "Authorization: Bearer <token>" http://<primary-ip>:8787/health` → `{"status":"ok"...}`.
   Sin token responde 401 tanto en `/health` como en `/sync/*` (correcto).
6. En la Primary, **Configuración → Tiendas** debe listar la Tienda Principal local más una sede
   por cada réplica que haya sincronizado. Las ventas de la réplica aparecen solo en su sede.

---

## 6. Build y publicación en GitHub Release

Repositorio: `https://github.com/MCRLogPose/pos-desktop` (branch `main`).

```bash
pnpm install
pnpm build                # frontend (dist/)
cd src-tauri
cargo check && cargo test # verificación (ambos en verde)
cd ..
pnpm tauri build          # genera instaladores Windows
```

Artefactos generados:
- `src-tauri/target/release/bundle/nsis/*.exe` (instalador NSIS)
- `src-tauri/target/release/bundle/msi/*.msi`

Publicar (no hay CI; se sube a mano):
```bash
gh release create v0.1.0 "src-tauri/target/release/bundle/nsis/*.exe" "src-tauri/target/release/bundle/msi/*.msi" --title "v0.1.0" --notes "Primera release de pruebas de sincronización"
```

Instalar el .exe/.msi en ambas máquinas (reproducir los pasos 4 y 5).

---

## 7. Pendientes

Resuelto en esta sesión (opción 3 de las antes planteadas):
- ✅ UI de Sincronización en Configuración (solo ADMIN): token con copiar + IPs de la máquina en
  Primary; IP, token y código de tienda en Replica; "Probar conexión" y "Sincronizar ahora".
- ✅ `force_sync_now` con botón en la UI (mismo lugar).

Otros pendientes conocidos (no bloquean la prueba básica):
- El gate ADMIN es **solo de frontend** (no hay sesión en el backend): cualquier código del
  frontend puede invocar `get_sync_token`. Si se requiere, hay que agregar verificación en Rust.
- Crear/eliminar tiendas sigue restringido en Primary (`reject_in_primary` en `commands/store.rs`).
- Restringir en Réplica el alta/eliminación de tiendas (solo la asignada).
- Worker de reintento automático en background en Réplica (hoy la sync depende del cierre de caja o
  del botón "Sincronizar ahora").
- `sync_all` usa `reqwest::Client::new()` sin timeout: si la Primary no responde, el cierre de caja
  queda esperando.

---

## 8. Referencias

- `docs/SINCRONIZACION_REPLICA.md` — contrato completo Réplica → Primary (estado 1.2.0).
- `docs/IMPLEMENTACION_V2.md`, `docs/ARCHITECTURE_DESIGN.md` — diseño.
- `src-tauri/src/sync/` — `client.rs` (envío + `test_connection`), `queue.rs` (outbox), `server.rs` (Axum), `apply.rs` (aplicación en Primary), `net.rs` (IPs locales y normalización de URL).
- `src-tauri/src/commands/sync.rs` — comandos de la UI de Sincronización.
- `src-tauri/src/lib.rs` — arranque del server, generación de `device_id` y `sync_token`.
- `src-tauri/src/services/config_service.rs` — servicio de `app_config`.
- `src/services/syncService.ts` — llamadas Tauri de sincronización.
- `src/features/user/components/modals/SyncSettingsModal.tsx` — modal de Sincronización.
- `src/features/user/pages/SettingsPage.tsx` — tarjeta de Sincronización (solo ADMIN).
- `src/features/setup/pages/SetupPage.tsx` — selección de modo inicial.
