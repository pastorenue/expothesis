use actix_web::{web, HttpResponse, Responder};

use crate::models::AnalyticsAlertRequest;
use crate::services::AnalyticsService;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/analytics")
            .route("/overview", web::get().to(get_overview))
            .route("/alerts", web::post().to(ingest_alert)),
    );
}

async fn get_overview(service: web::Data<AnalyticsService>) -> impl Responder {
    match service.get_overview().await {
        Ok(overview) => HttpResponse::Ok().json(overview),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn ingest_alert(
    service: web::Data<AnalyticsService>,
    req: web::Json<AnalyticsAlertRequest>,
) -> impl Responder {
    match service.ingest_alert(req.into_inner()).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "status": "ok" })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}
