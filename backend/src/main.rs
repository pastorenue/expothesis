mod api;
mod config;
mod db;
mod middleware;
mod models;
mod services;
mod stats;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use log::info;

use config::Config;
use db::{ClickHouseClient, connect_postgres};
use middleware::auth::AuthMiddleware;
use services::{
    AnalyticsService, CupedService, EventService, ExperimentService, FeatureFlagService,
    FeatureGateService, SdkTokenService, TrackingService, UserGroupService,
};
use services::AuthService;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load configuration
    let config = Config::from_env();

    // Initialize logging
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or(&config.log_level))
        .init();

    info!("Starting Expothesis Backend Server");
    info!("Server: {}:{}", config.server_host, config.server_port);
    info!("ClickHouse: {}", config.clickhouse_url);
    info!("Postgres: {}", config.postgres_url);

    // Initialize database
    let db_client =
        ClickHouseClient::new(&config.clickhouse_url).expect("Failed to create ClickHouse client");

    // Initialize schema
    db_client
        .init_schema()
        .await
        .expect("Failed to initialize database schema");

    let pg_pool = connect_postgres(&config.postgres_url)
        .await
        .expect("Failed to connect to Postgres");
    if let Err(err) = sqlx::migrate!("./migrations").run(&pg_pool).await {
        panic!("Failed to run Postgres migrations: {err}");
    }

    if let (Some(email), Some(password)) = (
        config.default_admin_email.clone(),
        config.default_admin_password.clone(),
    ) {
        let auth_service = AuthService::new(pg_pool.clone(), config.clone());
        if let Err(err) = auth_service.ensure_admin(&email, &password).await {
            log::warn!("Failed to create default admin: {}", err);
        }
    }

    let sdk_token_service = SdkTokenService::new(pg_pool.clone());
    if let Err(err) = sdk_token_service
        .ensure_tokens(
            config.tracking_api_key.clone(),
            config.feature_flags_api_key.clone(),
        )
        .await
    {
        log::warn!("Failed to ensure SDK tokens: {}", err);
    }

    // Create services with database set
    let db_with_auth = db_client.clone().with_database("expothesis");
    let experiment_service = web::Data::new(ExperimentService::new(db_with_auth.clone()));
    let user_group_service = web::Data::new(UserGroupService::new(db_with_auth.clone()));
    let feature_flag_service = web::Data::new(FeatureFlagService::new(db_with_auth.clone()));
    let feature_gate_service = web::Data::new(FeatureGateService::new(db_with_auth.clone()));
    let event_service = web::Data::new(EventService::new(db_with_auth.clone()));
    let analytics_service = web::Data::new(AnalyticsService::new(db_with_auth.clone()));
    let cuped_service = web::Data::new(CupedService::new(db_with_auth.clone()));
    let tracking_service = web::Data::new(TrackingService::new(
        db_with_auth.clone(),
        config.session_ttl_minutes,
    ));
    let config_data = web::Data::new(config.clone());
    let pg_pool_data = web::Data::new(pg_pool);

    // Start HTTP server
    let server_addr = format!("{}:{}", config.server_host, config.server_port);
    info!("Server listening on {}", server_addr);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin("http://localhost:3000")
            .allowed_origin("http://localhost:3001")
            .allow_any_method()
            .allow_any_header()
            .supports_credentials()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .wrap(AuthMiddleware::new(pg_pool_data.get_ref().clone(), config_data.get_ref().clone()))
            .app_data(experiment_service.clone())
            .app_data(cuped_service.clone())
            .app_data(user_group_service.clone())
            .app_data(feature_flag_service.clone())
            .app_data(feature_gate_service.clone())
            .app_data(event_service.clone())
            .app_data(analytics_service.clone())
            .app_data(tracking_service.clone())
            .app_data(pg_pool_data.clone())
            .app_data(config_data.clone())
            .configure(api::experiments::configure)
            .configure(api::user_groups::configure)
            .configure(api::events::configure)
            .configure(api::analytics::configure)
            .configure(api::feature_flags::configure)
            .configure(api::feature_gates::configure)
            .configure(api::organizations::configure)
            .configure(api::track::configure)
            .configure(api::sdk::configure)
            .configure(api::ai::configure)
            .configure(api::auth::configure)
            .route("/health", web::get().to(health_check))
    })
    .bind(server_addr)?
    .run()
    .await
}

async fn health_check() -> &'static str {
    "OK"
}
