mod api;
mod config;
mod db;
mod models;
mod services;
mod stats;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use log::info;

use config::Config;
use db::ClickHouseClient;
use services::{
    AnalyticsService, EventService, ExperimentService, FeatureFlagService, FeatureGateService,
    TrackingService, UserGroupService,
};

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

    // Initialize database
    let db_client =
        ClickHouseClient::new(&config.clickhouse_url).expect("Failed to create ClickHouse client");

    // Initialize schema
    db_client
        .init_schema()
        .await
        .expect("Failed to initialize database schema");

    // Create services with database set
    let db_with_auth = db_client.clone().with_database("expothesis");
    let experiment_service = web::Data::new(ExperimentService::new(db_with_auth.clone()));
    let user_group_service = web::Data::new(UserGroupService::new(db_with_auth.clone()));
    let feature_flag_service = web::Data::new(FeatureFlagService::new(db_with_auth.clone()));
    let feature_gate_service = web::Data::new(FeatureGateService::new(db_with_auth.clone()));
    let event_service = web::Data::new(EventService::new(db_with_auth.clone()));
    let analytics_service = web::Data::new(AnalyticsService::new(db_with_auth.clone()));
    let tracking_service = web::Data::new(TrackingService::new(db_with_auth.clone(), config.session_ttl_minutes));
    let config_data = web::Data::new(config.clone());

    // Start HTTP server
    let server_addr = format!("{}:{}", config.server_host, config.server_port);
    info!("Server listening on {}", server_addr);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(experiment_service.clone())
            .app_data(user_group_service.clone())
            .app_data(feature_flag_service.clone())
            .app_data(feature_gate_service.clone())
            .app_data(event_service.clone())
            .app_data(analytics_service.clone())
            .app_data(tracking_service.clone())
            .app_data(config_data.clone())
            .configure(api::experiments::configure)
            .configure(api::user_groups::configure)
            .configure(api::events::configure)
            .configure(api::analytics::configure)
            .configure(api::feature_flags::configure)
            .configure(api::feature_gates::configure)
            .configure(api::track::configure)
            .route("/health", web::get().to(health_check))
    })
    .bind(server_addr)?
    .run()
    .await
}

async fn health_check() -> &'static str {
    "OK"
}
