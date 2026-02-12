use actix_web::{web, HttpResponse, Responder};
use uuid::Uuid;

use crate::models::*;
use crate::services::FeatureFlagService;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/feature-flags")
            .route("", web::post().to(create_flag))
            .route("", web::get().to(list_flags))
            .route("/{id}", web::get().to(get_flag))
            .route("/{id}", web::put().to(update_flag))
            .route("/{id}", web::delete().to(delete_flag)),
    );
}

async fn create_flag(
    service: web::Data<FeatureFlagService>,
    req: web::Json<CreateFeatureFlagRequest>,
) -> impl Responder {
    match service.create_flag(req.into_inner()).await {
        Ok(flag) => HttpResponse::Created().json(flag),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn list_flags(service: web::Data<FeatureFlagService>) -> impl Responder {
    match service.list_flags().await {
        Ok(flags) => HttpResponse::Ok().json(flags),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn get_flag(
    service: web::Data<FeatureFlagService>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match service.get_flag(id.into_inner()).await {
        Ok(flag) => HttpResponse::Ok().json(flag),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn update_flag(
    service: web::Data<FeatureFlagService>,
    id: web::Path<Uuid>,
    req: web::Json<UpdateFeatureFlagRequest>,
) -> impl Responder {
    match service.update_flag(id.into_inner(), req.into_inner()).await {
        Ok(flag) => HttpResponse::Ok().json(flag),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn delete_flag(
    service: web::Data<FeatureFlagService>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match service.delete_flag(id.into_inner()).await {
        Ok(()) => HttpResponse::NoContent().finish(),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}
