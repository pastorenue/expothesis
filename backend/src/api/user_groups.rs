use actix_web::{web, HttpResponse, Responder};
use uuid::Uuid;

use crate::models::*;
use crate::services::UserGroupService;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/user-groups")
            .route("", web::post().to(create_user_group))
            .route("", web::get().to(list_user_groups))
            .route("/{id}", web::get().to(get_user_group))
            .route("/{id}/move", web::post().to(move_user_group))
            .route("/{id}/metrics", web::get().to(get_group_metrics))
            .route("/assign", web::post().to(assign_user)),
    );
}

async fn create_user_group(
    service: web::Data<UserGroupService>,
    req: web::Json<CreateUserGroupRequest>,
) -> impl Responder {
    match service.create_user_group(req.into_inner()).await {
        Ok(group) => HttpResponse::Created().json(group),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn list_user_groups(service: web::Data<UserGroupService>) -> impl Responder {
    match service.list_user_groups().await {
        Ok(groups) => HttpResponse::Ok().json(groups),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn get_user_group(
    service: web::Data<UserGroupService>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match service.get_user_group(id.into_inner()).await {
        Ok(group) => HttpResponse::Ok().json(group),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn move_user_group(
    service: web::Data<UserGroupService>,
    id: web::Path<Uuid>,
    req: web::Json<MoveUserGroupRequest>,
) -> impl Responder {
    match service
        .move_user_group(
            id.into_inner(),
            req.from_experiment_id,
            req.to_experiment_id,
        )
        .await
    {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "User group moved successfully"
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn get_group_metrics(
    service: web::Data<UserGroupService>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match service.get_group_metrics(id.into_inner()).await {
        Ok(metrics) => HttpResponse::Ok().json(metrics),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn assign_user(
    service: web::Data<UserGroupService>,
    req: web::Json<AssignUserRequest>,
) -> impl Responder {
    let req = req.into_inner();
    match service
        .assign_user_auto(
            &req.user_id,
            req.experiment_id,
            req.group_id,
            req.attributes,
        )
        .await
    {
        Ok(assignment) => HttpResponse::Ok().json(assignment),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}
