//! Utilidades de red para la configuracion de sincronizacion.
//!
//! La Primary expone el servidor de sync en `0.0.0.0:<port>`, por lo que la
//! Replica debe apuntar a una IP concreta de esa maquina. Estas funciones
//! permiten al administrador ver las IPs de su propia maquina y escribir en la
//! Replica solo la IP (el esquema y el puerto se completan solos).

/// IPv4 utilizables de esta maquina (excluye loopback y link-local).
///
/// En Windows se lee `ipconfig`, que funciona en español e inglés: se toma el
/// texto despues del ultimo `:` de cada linea y se filtra lo que parsea como
/// IPv4. En otras plataformas devuelve vacio (la app es Windows-only).
pub fn local_ipv4_addresses() -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("ipconfig").output();
        let Ok(output) = output else {
            return Vec::new();
        };
        let text = String::from_utf8_lossy(&output.stdout);
        let mut found: Vec<String> = Vec::new();
        for line in text.lines() {
            let Some((_, value)) = line.rsplit_once(':') else {
                continue;
            };
            let candidate = value.trim();
            if is_usable_ipv4(candidate) && !found.iter().any(|ip| ip == candidate) {
                found.push(candidate.to_string());
            }
        }
        found
    }
    #[cfg(not(target_os = "windows"))]
    {
        Vec::new()
    }
}

fn is_usable_ipv4(value: &str) -> bool {
    let parts: Vec<&str> = value.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    let mut octets = [0u8; 4];
    for (idx, part) in parts.iter().enumerate() {
        let Ok(octet) = part.parse::<u8>() else {
            return false;
        };
        octets[idx] = octet;
    }
    octets[0] != 0 && octets[0] != 127 && !(octets[0] == 169 && octets[1] == 254)
}

/// Normaliza lo que el administrador escribe en la Replica.
///
/// Acepta `100.100.162.18`, `100.100.162.18:8787`, `http://100.100.162.18:8787/`
/// o una URL con ruta, y devuelve siempre `http://host:puerto` sin path, que es
/// lo que el cliente concatena con `/sync/<topic>`.
pub fn normalize_primary_url(input: &str, default_port: u16) -> Result<String, String> {
    let raw = input.trim();
    if raw.is_empty() {
        return Err("Ingresa la IP o direccion web de la maquina Primary".to_string());
    }

    let with_scheme = if raw.contains("://") {
        raw.to_string()
    } else {
        format!("http://{raw}")
    };

    let mut url = reqwest::Url::parse(&with_scheme)
        .map_err(|e| format!("Direccion no valida: {e}"))?;

    if url.scheme() != "http" && url.scheme() != "https" {
        return Err("La direccion debe empezar con http:// o https://".to_string());
    }
    if url.host_str().unwrap_or_default().is_empty() {
        return Err("No se encontro una IP o dominio en la direccion".to_string());
    }

    if url.port().is_none() {
        url.set_port(Some(default_port))
            .map_err(|_| "No se pudo asignar el puerto".to_string())?;
    }

    // La ruta/query/fragmento no forman parte de la base: el cliente agrega
    // `/sync/<topic>` y `/health`.
    url.set_path("");
    url.set_query(None);
    url.set_fragment(None);

    Ok(url.to_string().trim_end_matches('/').to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sync::DEFAULT_SYNC_PORT;

    #[test]
    fn bare_ip_gets_scheme_and_default_port() {
        assert_eq!(
            normalize_primary_url("100.100.162.18", DEFAULT_SYNC_PORT).unwrap(),
            "http://100.100.162.18:8787"
        );
    }

    #[test]
    fn explicit_port_is_preserved() {
        assert_eq!(
            normalize_primary_url("100.100.162.18:9000", DEFAULT_SYNC_PORT).unwrap(),
            "http://100.100.162.18:9000"
        );
    }

    #[test]
    fn scheme_path_and_trailing_slash_are_cleaned() {
        assert_eq!(
            normalize_primary_url("  http://100.100.162.18:8787/  ", DEFAULT_SYNC_PORT).unwrap(),
            "http://100.100.162.18:8787"
        );
        assert_eq!(
            normalize_primary_url("http://servidor.local/sync/sales", DEFAULT_SYNC_PORT).unwrap(),
            "http://servidor.local:8787"
        );
    }

    #[test]
    fn empty_or_invalid_input_is_rejected() {
        assert!(normalize_primary_url("   ", DEFAULT_SYNC_PORT).is_err());
        assert!(normalize_primary_url("ftp://100.100.162.18", DEFAULT_SYNC_PORT).is_err());
    }

    #[test]
    fn loopback_and_link_local_are_filtered() {
        assert!(!is_usable_ipv4("127.0.0.1"));
        assert!(!is_usable_ipv4("169.254.10.1"));
        assert!(!is_usable_ipv4("0.0.0.0"));
        assert!(!is_usable_ipv4("::1"));
        assert!(!is_usable_ipv4("100.100.162"));
        assert!(is_usable_ipv4("100.100.162.18"));
    }
}
