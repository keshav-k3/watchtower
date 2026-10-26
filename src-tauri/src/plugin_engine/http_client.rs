use reqwest::blocking::Client;
use std::sync::OnceLock;
use std::time::Duration;

fn build_client(ignore_tls: bool) -> Client {
    let mut builder = Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .pool_max_idle_per_host(4)
        .connect_timeout(Duration::from_secs(10));
    if let Some(resolved) = crate::config::get_resolved_proxy() {
        builder = builder.proxy(resolved.proxy.clone());
    }
    if ignore_tls {
        builder = builder.danger_accept_invalid_certs(true);
    }
    builder
        .build()
        .expect("shared HTTP client could not be built")
}

pub(crate) fn shared_client(ignore_tls: bool) -> &'static Client {
    if ignore_tls {
        static INSECURE: OnceLock<Client> = OnceLock::new();
        INSECURE.get_or_init(|| build_client(true))
    } else {
        static SECURE: OnceLock<Client> = OnceLock::new();
        SECURE.get_or_init(|| build_client(false))
    }
}

#[cfg(test)]
mod tests {
    use super::shared_client;

    #[test]
    fn shared_http_client_is_reused() {
        let first = shared_client(false);
        let second = shared_client(false);
        assert!(std::ptr::eq(first, second));

        let insecure = shared_client(true);
        let insecure_again = shared_client(true);
        assert!(std::ptr::eq(insecure, insecure_again));
        assert!(!std::ptr::eq(first, insecure));
    }
}
