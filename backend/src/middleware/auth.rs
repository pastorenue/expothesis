use actix_web::body::EitherBody;
use actix_web::dev::{Service, ServiceRequest, ServiceResponse, Transform};
use actix_web::{Error, HttpResponse};
use actix_web::HttpMessage;
use futures_util::future::{ok, LocalBoxFuture, Ready};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use sqlx::{PgPool, Row};
use std::rc::Rc;
use uuid::Uuid;

use crate::config::Config;

#[derive(Clone, Debug)]
pub struct AuthedUser {
    pub user_id: Uuid,
    pub org_id: Uuid,
    pub role: String,
}

#[derive(Debug, Deserialize)]
struct Claims {
    sub: String,
    token_id: String,
    exp: usize,
}

pub struct AuthMiddleware {
    pool: PgPool,
    config: Config,
}

impl AuthMiddleware {
    pub fn new(pool: PgPool, config: Config) -> Self {
        Self { pool, config }
    }
}

impl<S, B> Transform<S, ServiceRequest> for AuthMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = AuthMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(AuthMiddlewareService {
            service: Rc::new(service),
            pool: self.pool.clone(),
            config: self.config.clone(),
        })
    }
}

pub struct AuthMiddlewareService<S> {
    service: Rc<S>,
    pool: PgPool,
    config: Config,
}

impl<S, B> Service<ServiceRequest> for AuthMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(
        &self,
        ctx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        self.service.poll_ready(ctx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let pool = self.pool.clone();
        let config = self.config.clone();

        Box::pin(async move {
            if req.method() == actix_web::http::Method::OPTIONS {
                return service.call(req).await.map(|res| res.map_into_left_body());
            }

            let path = req.path().to_string();
            if path == "/health"
                || path.starts_with("/api/auth")
                || path.starts_with("/api/track")
                || path.starts_with("/api/sdk/feature-flags")
            {
                return service.call(req).await.map(|res| res.map_into_left_body());
            }

            let auth_header = req
                .headers()
                .get("Authorization")
                .and_then(|value| value.to_str().ok())
                .unwrap_or("");
            let token = auth_header.strip_prefix("Bearer ").unwrap_or("");

            if token.is_empty() {
                return Ok(req
                    .into_response(HttpResponse::Unauthorized().json(serde_json::json!({
                        "error": "Missing Authorization token"
                    }))
                    .map_into_right_body()));
            }

            let decoded = decode::<Claims>(
                token,
                &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
                &Validation::new(Algorithm::HS256),
            );

            let claims = match decoded {
                Ok(data) => data.claims,
                Err(_) => {
                    return Ok(req
                        .into_response(HttpResponse::Unauthorized().json(serde_json::json!({
                            "error": "Invalid token"
                        }))
                        .map_into_right_body()))
                }
            };

            let user_id = Uuid::parse_str(&claims.sub).ok();
            let token_id = Uuid::parse_str(&claims.token_id).ok();
            if user_id.is_none() || token_id.is_none() {
                return Ok(req
                    .into_response(HttpResponse::Unauthorized().json(serde_json::json!({
                        "error": "Invalid token payload"
                    }))
                    .map_into_right_body()));
            }

            let session_exists = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM sessions WHERE user_id = $1 AND token_id = $2 AND expires_at > NOW()",
            )
            .bind(user_id.unwrap())
            .bind(token_id.unwrap())
            .fetch_one(&pool)
            .await
            .unwrap_or(0);

            if session_exists == 0 {
                return Ok(req
                    .into_response(HttpResponse::Unauthorized().json(serde_json::json!({
                        "error": "Session expired"
                    }))
                    .map_into_right_body()));
            }

            // Allow org listing/creation without prior org header (still requires auth)
            let requires_org = !path.starts_with("/api/organizations");
            let mut authed_user: Option<AuthedUser> = None;

            if requires_org {
                let org_header = req
                    .headers()
                    .get("X-Org-Id")
                    .and_then(|value| value.to_str().ok());

                // If header missing/invalid, fall back to user's first membership to avoid hard 400s
                let header_org = org_header.and_then(|v| Uuid::parse_str(v).ok());

                let membership = sqlx::query(
                    r#"
                    SELECT org_id, role
                    FROM organization_memberships
                    WHERE user_id = $1
                    ORDER BY created_at ASC
                    LIMIT 1
                    "#,
                )
                .bind(user_id.unwrap())
                .fetch_optional(&pool)
                .await
                .unwrap_or(None);

                let (org_id, role) = match (header_org, membership) {
                    (Some(id), _) => {
                        // Validate membership for the provided org
                        let row = sqlx::query(
                            "SELECT role FROM organization_memberships WHERE org_id = $1 AND user_id = $2",
                        )
                        .bind(id)
                        .bind(user_id.unwrap())
                        .fetch_optional(&pool)
                        .await
                        .unwrap_or(None);

                        match row {
                            Some(rec) => (id, rec.get::<String, _>("role")),
                            None => {
                                return Ok(req
                                    .into_response(HttpResponse::Forbidden().json(serde_json::json!({
                                        "error": "User is not a member of this organization"
                                    }))
                                    .map_into_right_body()));
                            }
                        }
                    }
                    (None, Some(rec)) => {
                        let org_id: Uuid = rec.get("org_id");
                        let role: String = rec.get("role");
                        (org_id, role)
                    }
                    (None, None) => {
                        return Ok(req
                            .into_response(HttpResponse::BadRequest().json(serde_json::json!({
                                "error": "Missing X-Org-Id and no memberships found"
                            }))
                            .map_into_right_body()));
                    }
                };

                authed_user = Some(AuthedUser {
                    user_id: user_id.unwrap(),
                    org_id,
                    role,
                });
            }

            if let Some(user) = authed_user {
                req.extensions_mut().insert(user);
            } else {
                // Attach user_id even when org header not required
                req.extensions_mut().insert(AuthedUser {
                    user_id: user_id.unwrap(),
                    org_id: Uuid::nil(),
                    role: String::new(),
                });
            }

            service.call(req).await.map(|res| res.map_into_left_body())
        })
    }
}
