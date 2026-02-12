use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub server_host: String,
    pub server_port: u16,
    pub clickhouse_url: String,
    pub log_level: String,
    pub tracking_api_key: Option<String>,
    pub session_ttl_minutes: Option<i64>,
}

impl Config {
    pub fn from_env() -> Self {
        dotenv::dotenv().ok();

        Self {
            server_host: std::env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            server_port: std::env::var("SERVER_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .expect("SERVER_PORT must be a valid number"),
            clickhouse_url: std::env::var("CLICKHOUSE_URL")
                .unwrap_or_else(|_| "http://clickhouse:8123".to_string()),
            log_level: std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
            tracking_api_key: std::env::var("TRACKING_API_KEY").ok().filter(|key| !key.is_empty()),
            session_ttl_minutes: std::env::var("SESSION_TTL_MINUTES")
                .ok()
                .and_then(|value| value.parse::<i64>().ok())
                .filter(|value| *value > 0),
        }
    }
}
