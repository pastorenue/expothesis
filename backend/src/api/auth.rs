use actix_web::{web, HttpResponse, Responder};
use uuid::Uuid;

use crate::config::Config;
use crate::models::{EnableTotpRequest, LoginRequest, RegisterRequest, VerifyOtpRequest, VerifyTotpRequest};
use crate::services::AuthService;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/auth")
            .route("/register", web::post().to(register))
            .route("/login", web::post().to(login))
            .route("/verify-otp", web::post().to(verify_otp))
            .route("/totp/setup", web::post().to(setup_totp))
            .route("/totp/verify", web::post().to(verify_totp))
            .route("/me/{id}", web::get().to(me)),
    );
}

async fn register(
    pool: web::Data<sqlx::PgPool>,
    config: web::Data<Config>,
    payload: web::Json<RegisterRequest>,
) -> impl Responder {
    let service = AuthService::new(pool.get_ref().clone(), config.get_ref().clone());
    match service.register(&payload.email, &payload.password).await {
        Ok(result) => HttpResponse::Ok().json(result),
        Err(err) => HttpResponse::BadRequest().json(serde_json::json!({ "error": err.to_string() })),
    }
}

async fn login(
    pool: web::Data<sqlx::PgPool>,
    config: web::Data<Config>,
    payload: web::Json<LoginRequest>,
) -> impl Responder {
    let service = AuthService::new(pool.get_ref().clone(), config.get_ref().clone());
    match service.login(&payload.email, &payload.password).await {
        Ok(result) => HttpResponse::Ok().json(result),
        Err(err) => HttpResponse::BadRequest().json(serde_json::json!({ "error": err.to_string() })),
    }
}

async fn verify_otp(
    pool: web::Data<sqlx::PgPool>,
    config: web::Data<Config>,
    payload: web::Json<VerifyOtpRequest>,
) -> impl Responder {
    let service = AuthService::new(pool.get_ref().clone(), config.get_ref().clone());
    match service
        .verify_otp(&payload.email, &payload.code, payload.totp_code.as_deref())
        .await
    {
        Ok(result) => HttpResponse::Ok().json(result),
        Err(err) => HttpResponse::BadRequest().json(serde_json::json!({ "error": err.to_string() })),
    }
}

async fn setup_totp(
    pool: web::Data<sqlx::PgPool>,
    config: web::Data<Config>,
    payload: web::Json<EnableTotpRequest>,
) -> impl Responder {
    let service = AuthService::new(pool.get_ref().clone(), config.get_ref().clone());
    match service.enable_totp(payload.user_id).await {
        Ok(result) => HttpResponse::Ok().json(result),
        Err(err) => HttpResponse::BadRequest().json(serde_json::json!({ "error": err.to_string() })),
    }
}

async fn verify_totp(
    pool: web::Data<sqlx::PgPool>,
    config: web::Data<Config>,
    payload: web::Json<VerifyTotpRequest>,
) -> impl Responder {
    let service = AuthService::new(pool.get_ref().clone(), config.get_ref().clone());
    match service.verify_totp(payload.user_id, &payload.code).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "status": "ok" })),
        Err(err) => HttpResponse::BadRequest().json(serde_json::json!({ "error": err.to_string() })),
    }
}

async fn me(
    pool: web::Data<sqlx::PgPool>,
    config: web::Data<Config>,
    id: web::Path<Uuid>,
) -> impl Responder {
    let service = AuthService::new(pool.get_ref().clone(), config.get_ref().clone());
    match service.me(id.into_inner()).await {
        Ok(user) => HttpResponse::Ok().json(user),
        Err(err) => HttpResponse::BadRequest().json(serde_json::json!({ "error": err.to_string() })),
    }
}
