use actix_web::{web, HttpResponse, Responder};
use uuid::Uuid;

use crate::models::*;
use crate::services::ExperimentService;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/experiments")
            .route("", web::post().to(create_experiment))
            .route("", web::get().to(list_experiments))
            .route("/{id}", web::get().to(get_experiment))
            .route("/{id}/start", web::post().to(start_experiment))
            .route("/{id}/pause", web::post().to(pause_experiment))
            .route("/{id}/stop", web::post().to(stop_experiment))
            .route("/{id}/analysis", web::get().to(get_analysis)),
    );
}

async fn create_experiment(
    service: web::Data<ExperimentService>,
    req: web::Json<CreateExperimentRequest>,
) -> impl Responder {
    match service.create_experiment(req.into_inner()).await {
        Ok(experiment) => HttpResponse::Created().json(experiment),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn list_experiments(service: web::Data<ExperimentService>) -> impl Responder {
    match service.list_experiments().await {
        Ok(experiments) => HttpResponse::Ok().json(experiments),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn get_experiment(
    service: web::Data<ExperimentService>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match service.get_experiment(id.into_inner()).await {
        Ok(experiment) => HttpResponse::Ok().json(experiment),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn start_experiment(
    service: web::Data<ExperimentService>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match service.start_experiment(id.into_inner()).await {
        Ok(experiment) => HttpResponse::Ok().json(experiment),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn pause_experiment(
    service: web::Data<ExperimentService>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match service.pause_experiment(id.into_inner()).await {
        Ok(experiment) => HttpResponse::Ok().json(experiment),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn stop_experiment(
    service: web::Data<ExperimentService>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match service.stop_experiment(id.into_inner()).await {
        Ok(experiment) => HttpResponse::Ok().json(experiment),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn get_analysis(
    service: web::Data<ExperimentService>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match service.analyze_experiment(id.into_inner()).await {
        Ok(analysis) => HttpResponse::Ok().json(analysis),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}
