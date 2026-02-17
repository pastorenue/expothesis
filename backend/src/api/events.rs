use crate::models::IngestEventRequest;
use crate::services::event_service::EventService;
use actix_web::{web, HttpResponse, Responder};
use log::error;
use crate::middleware::auth::AuthedUser;
use actix_web::HttpMessage;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(web::scope("/api/events").route("", web::post().to(ingest_event)));
}

async fn ingest_event(
    event_service: web::Data<EventService>,
    req: web::Json<IngestEventRequest>,
    http: actix_web::HttpRequest,
) -> impl Responder {
    let Some(user) = http.extensions().get::<AuthedUser>().cloned() else {
        return HttpResponse::Unauthorized().finish();
    };

    match event_service.ingest_event(req.into_inner(), user.org_id).await {
        Ok(event) => HttpResponse::Ok().json(event),
        Err(e) => {
            error!("Failed to ingest event: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to ingest event: {}", e)
            }))
        }
    }
}
