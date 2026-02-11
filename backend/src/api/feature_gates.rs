use actix_web::{web, HttpResponse, Responder};
use uuid::Uuid;

use crate::models::*;
use crate::services::FeatureGateService;

#[derive(serde::Deserialize)]
pub struct FeatureGateQuery {
    pub flag_id: Option<Uuid>,
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/feature-gates")
            .route("", web::post().to(create_gate))
            .route("", web::get().to(list_gates))
            .route("/{id}", web::get().to(get_gate))
            .route("/{id}/evaluate", web::post().to(evaluate_gate)),
    );
}

async fn create_gate(
    service: web::Data<FeatureGateService>,
    req: web::Json<CreateFeatureGateRequest>,
) -> impl Responder {
    match service.create_gate(req.into_inner()).await {
        Ok(gate) => HttpResponse::Created().json(gate),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn list_gates(
    service: web::Data<FeatureGateService>,
    query: web::Query<FeatureGateQuery>,
) -> impl Responder {
    match service.list_gates(query.flag_id).await {
        Ok(gates) => HttpResponse::Ok().json(gates),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn get_gate(
    service: web::Data<FeatureGateService>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match service.get_gate(id.into_inner()).await {
        Ok(gate) => HttpResponse::Ok().json(gate),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn evaluate_gate(
    service: web::Data<FeatureGateService>,
    id: web::Path<Uuid>,
    req: web::Json<EvaluateFeatureGateRequest>,
) -> impl Responder {
    match service.evaluate_gate(id.into_inner(), req.into_inner()).await {
        Ok(result) => HttpResponse::Ok().json(result),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}
