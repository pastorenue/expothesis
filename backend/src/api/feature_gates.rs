use actix_web::{web, HttpMessage, HttpRequest, HttpResponse, Responder};
use uuid::Uuid;

use crate::middleware::auth::AuthedUser;
use crate::models::*;
use crate::services::FeatureGateService;

#[derive(serde::Deserialize)]
pub struct FeatureGateQuery {
    pub flag_id: Option<Uuid>,
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/feature-gates")
            .route("", web::post().to(create_gate))
            .route("", web::get().to(list_gates))
            .route("/{id}", web::get().to(get_gate))
            .route("/{id}/evaluate", web::post().to(evaluate_gate)),
    );
}

fn authed(req: &HttpRequest) -> Option<AuthedUser> {
    req.extensions().get::<AuthedUser>().cloned()
}

async fn create_gate(
    service: web::Data<FeatureGateService>,
    req: web::Json<CreateFeatureGateRequest>,
    http: HttpRequest,
) -> impl Responder {
    let Some(user) = authed(&http) else {
        return HttpResponse::Unauthorized().finish();
    };
    match service.create_gate(req.into_inner(), user.account_id).await {
        Ok(gate) => HttpResponse::Created().json(gate),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn list_gates(
    service: web::Data<FeatureGateService>,
    query: web::Query<FeatureGateQuery>,
    http: HttpRequest,
) -> impl Responder {
    let Some(user) = authed(&http) else {
        return HttpResponse::Unauthorized().finish();
    };
    match service.list_gates(user.account_id, query.flag_id).await {
        Ok(gates) => HttpResponse::Ok().json(gates),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn get_gate(
    service: web::Data<FeatureGateService>,
    id: web::Path<Uuid>,
    http: HttpRequest,
) -> impl Responder {
    let Some(user) = authed(&http) else {
        return HttpResponse::Unauthorized().finish();
    };
    match service.get_gate(id.into_inner(), user.account_id).await {
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
    http: HttpRequest,
) -> impl Responder {
    let Some(user) = authed(&http) else {
        return HttpResponse::Unauthorized().finish();
    };
    match service
        .evaluate_gate(id.into_inner(), user.account_id, req.into_inner())
        .await
    {
        Ok(result) => HttpResponse::Ok().json(result),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}
