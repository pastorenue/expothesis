use actix_web::{get, post, web, HttpResponse, HttpRequest, HttpMessage};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use sqlx::Row;
use uuid::Uuid;

use crate::middleware::auth::AuthedUser;

#[derive(Serialize)]
struct OrganizationResponse {
    id: Uuid,
    name: String,
    created_at: chrono::DateTime<chrono::Utc>,
    role: String,
}

#[derive(Deserialize)]
struct CreateOrgRequest {
    name: String,
}

#[get("")]
async fn list_orgs(pool: web::Data<PgPool>, req: HttpRequest) -> HttpResponse {
    let authed = match req.extensions().get::<AuthedUser>().cloned() {
        Some(user) => user,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Missing auth context"
            }))
        }
    };

    let rows = sqlx::query(
        r#"
        SELECT o.id, o.name, o.created_at, m.role
        FROM organizations o
        JOIN organization_memberships m ON m.org_id = o.id
        WHERE m.user_id = $1
        ORDER BY o.created_at
        "#,
    )
    .bind(authed.user_id)
    .fetch_all(pool.get_ref())
    .await;

    match rows {
        Ok(data) => {
            let resp: Vec<OrganizationResponse> = data
                .into_iter()
                .map(|row| OrganizationResponse {
                    id: row.get::<Uuid, _>("id"),
                    name: row.get::<String, _>("name"),
                    created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                    role: row.get::<String, _>("role"),
                })
                .collect();
            HttpResponse::Ok().json(resp)
        }
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": err.to_string() })),
    }
}

#[post("")]
async fn create_org(
    pool: web::Data<PgPool>,
    req: actix_web::HttpRequest,
    payload: web::Json<CreateOrgRequest>,
) -> HttpResponse {
    let authed = match req.extensions().get::<AuthedUser>().cloned() {
        Some(user) => user,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Missing auth context"
            }))
        }
    };

    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(err) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({ "error": err.to_string() }))
        }
    };

    let org_id = Uuid::new_v4();
    if let Err(err) = sqlx::query("INSERT INTO organizations (id, name) VALUES ($1, $2)")
        .bind(org_id)
        .bind(&payload.name)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        return HttpResponse::InternalServerError().json(serde_json::json!({ "error": err.to_string() }));
    }

    if let Err(err) = sqlx::query("INSERT INTO organization_memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')")
        .bind(org_id)
        .bind(authed.user_id)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        return HttpResponse::InternalServerError().json(serde_json::json!({ "error": err.to_string() }));
    }

    if let Err(err) = tx.commit().await {
        return HttpResponse::InternalServerError().json(serde_json::json!({ "error": err.to_string() }));
    }

    HttpResponse::Created().json(serde_json::json!({ "id": org_id }))
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/organizations")
            .service(list_orgs)
            .service(create_org),
    );
}
