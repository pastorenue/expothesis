use crate::config::Config;
use crate::models::{
    EndSessionRequest, ListSessionsResponse, StartSessionRequest, TrackEventRequest,
    TrackReplayRequest,
};
use crate::services::{SdkTokenService, TrackingService};
use actix_web::{web, HttpRequest, HttpResponse, Responder};
use log::error;
use sqlx::Row;
use uuid::Uuid;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/track")
            .app_data(web::JsonConfig::default().limit(10 * 1024 * 1024))
            .route("/session/start", web::post().to(start_session))
            .route("/session/end", web::post().to(end_session))
            .route("/event", web::post().to(track_event))
            .route("/replay", web::post().to(track_replay))
            .route("/replay/{session_id}", web::get().to(get_replay))
            .route("/sessions", web::get().to(list_sessions))
            .route("/events", web::get().to(list_events)),
    );
}

async fn start_session(
    tracking_service: web::Data<TrackingService>,
    config: web::Data<Config>,
    pool: web::Data<sqlx::PgPool>,
    http_req: HttpRequest,
    payload: web::Json<StartSessionRequest>,
) -> impl Responder {
    if let Err(response) = verify_tracking_key(&http_req, &config, &pool).await {
        return response;
    }
    match tracking_service.start_session(payload.into_inner()).await {
        Ok(session) => HttpResponse::Ok().json(session),
        Err(e) => {
            error!("Failed to start session: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to start session: {}", e)
            }))
        }
    }
}

async fn end_session(
    tracking_service: web::Data<TrackingService>,
    config: web::Data<Config>,
    pool: web::Data<sqlx::PgPool>,
    http_req: HttpRequest,
    payload: web::Json<EndSessionRequest>,
) -> impl Responder {
    if let Err(response) = verify_tracking_key(&http_req, &config, &pool).await {
        return response;
    }
    match tracking_service.end_session(payload.into_inner()).await {
        Ok(session) => HttpResponse::Ok().json(session),
        Err(e) => {
            error!("Failed to end session: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to end session: {}", e)
            }))
        }
    }
}

async fn track_event(
    tracking_service: web::Data<TrackingService>,
    config: web::Data<Config>,
    pool: web::Data<sqlx::PgPool>,
    http_req: HttpRequest,
    payload: web::Json<TrackEventRequest>,
) -> impl Responder {
    if let Err(response) = verify_tracking_key(&http_req, &config, &pool).await {
        return response;
    }
    match tracking_service.track_event(payload.into_inner()).await {
        Ok(event) => HttpResponse::Ok().json(event),
        Err(e) => {
            error!("Failed to track event: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to track event: {}", e)
            }))
        }
    }
}

async fn track_replay(
    tracking_service: web::Data<TrackingService>,
    config: web::Data<Config>,
    pool: web::Data<sqlx::PgPool>,
    http_req: HttpRequest,
    payload: web::Json<TrackReplayRequest>,
) -> impl Responder {
    if let Err(response) = verify_tracking_key(&http_req, &config, &pool).await {
        return response;
    }
    match tracking_service.track_replay(payload.into_inner()).await {
        Ok(offset) => HttpResponse::Ok().json(serde_json::json!({ "sequence_start": offset })),
        Err(e) => {
            error!("Failed to track replay: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to track replay: {}", e)
            }))
        }
    }
}

async fn get_replay(
    tracking_service: web::Data<TrackingService>,
    config: web::Data<Config>,
    pool: web::Data<sqlx::PgPool>,
    http_req: HttpRequest,
    path: web::Path<String>,
    query: web::Query<ReplayQuery>,
) -> impl Responder {
    if let Err(response) = verify_tracking_key(&http_req, &config, &pool).await {
        return response;
    }
    let limit = query.limit.unwrap_or(1200);
    let offset = query.offset.unwrap_or(0);
    match tracking_service
        .get_replay_events(&path, limit, offset)
        .await
    {
        Ok(events) => HttpResponse::Ok().json(events),
        Err(e) => {
            error!("Failed to fetch replay: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to fetch replay: {}", e)
            }))
        }
    }
}

#[derive(serde::Deserialize)]
struct SessionQuery {
    limit: Option<usize>,
    offset: Option<usize>,
}

#[derive(serde::Deserialize)]
struct ReplayQuery {
    limit: Option<usize>,
    offset: Option<usize>,
}

async fn list_sessions(
    tracking_service: web::Data<TrackingService>,
    config: web::Data<Config>,
    pool: web::Data<sqlx::PgPool>,
    http_req: HttpRequest,
    query: web::Query<SessionQuery>,
) -> impl Responder {
    if let Err(response) = verify_tracking_key(&http_req, &config, &pool).await {
        return response;
    }
    let limit = query.limit.unwrap_or(20);
    let offset = query.offset.unwrap_or(0);
    match tracking_service.list_sessions(limit, offset).await {
        Ok((sessions, total)) => HttpResponse::Ok().json(ListSessionsResponse {
            sessions,
            total,
            limit,
            offset,
        }),
        Err(e) => {
            error!("Failed to list sessions: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to list sessions: {}", e)
            }))
        }
    }
}

#[derive(serde::Deserialize)]
struct EventsQuery {
    session_id: String,
    event_type: Option<String>,
    limit: Option<usize>,
}

async fn list_events(
    tracking_service: web::Data<TrackingService>,
    config: web::Data<Config>,
    pool: web::Data<sqlx::PgPool>,
    http_req: HttpRequest,
    query: web::Query<EventsQuery>,
) -> impl Responder {
    if let Err(response) = verify_tracking_key(&http_req, &config, &pool).await {
        return response;
    }
    let limit = query.limit.unwrap_or(200);
    match tracking_service
        .list_activity_events(&query.session_id, query.event_type.as_deref(), limit)
        .await
    {
        Ok(events) => HttpResponse::Ok().json(events),
        Err(e) => {
            error!("Failed to list events: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to list events: {}", e)
            }))
        }
    }
}

async fn verify_tracking_key(
    req: &HttpRequest,
    config: &Config,
    pool: &sqlx::PgPool,
) -> Result<(), HttpResponse> {
    let service = SdkTokenService::new(pool.clone());

    // For tracking, we use the default account for now
    let account_id = match sqlx::query("SELECT id FROM accounts LIMIT 1")
        .fetch_one(pool)
        .await
    {
        Ok(row) => row.get::<Uuid, _>("id"),
        Err(_) => return Ok(()),
    };

    let expected = match service
        .ensure_tokens(
            account_id,
            config.tracking_api_key.clone(),
            config.feature_flags_api_key.clone(),
        )
        .await
    {
        Ok(tokens) => tokens.tracking_api_key,
        Err(_) => return Ok(()),
    };

    let header_key = req
        .headers()
        .get("x-expothesis-key")
        .and_then(|value| value.to_str().ok());

    let bearer_key = req
        .headers()
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .or_else(|| {
            req.headers()
                .get("Authorization")
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.strip_prefix("Bearer "))
        });

    let provided = header_key.or(bearer_key);

    match provided {
        Some(value) if value == expected => Ok(()),
        _ => Err(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Invalid tracking key"
        }))),
    }
}
