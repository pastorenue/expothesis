use actix_web::{web, HttpRequest, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::config::Config;
use crate::models::{EvaluateFeatureGateRequest, FeatureFlagStatus, FeatureGateStatus};
use crate::services::{FeatureFlagService, FeatureGateService, SdkTokenService};

#[derive(Debug, Deserialize)]
struct EvaluateFlagsRequest {
    pub user_id: Option<String>,
    pub attributes: Option<Value>,
    pub flags: Option<Vec<String>>,
    pub environment: Option<String>,
}

#[derive(Debug, Serialize)]
struct SdkFlagEvaluation {
    pub name: String,
    pub enabled: bool,
    pub gate_id: Option<Uuid>,
    pub reason: String,
}

#[derive(Debug, Serialize)]
struct SdkFlagsResponse {
    pub flags: Vec<SdkFlagEvaluation>,
}

#[derive(Debug, Serialize)]
struct SdkTokensResponse {
    pub tracking_api_key: Option<String>,
    pub feature_flags_api_key: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RotateTokensRequest {
    pub kind: String,
}

#[derive(Debug, Serialize)]
struct SdkFlagSummary {
    pub name: String,
    pub environment: String,
    pub status: FeatureFlagStatus,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize)]
struct SdkFlagListResponse {
    pub flags: Vec<SdkFlagSummary>,
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/sdk")
            .route("/tokens", web::get().to(tokens))
            .route("/tokens/rotate", web::post().to(rotate_tokens))
            .route("/feature-flags", web::get().to(list_flags))
            .route("/feature-flags/evaluate", web::post().to(evaluate_flags)),
    );
}

async fn tokens(pool: web::Data<sqlx::PgPool>, config: web::Data<Config>) -> impl Responder {
    let service = SdkTokenService::new(pool.get_ref().clone());
    match service
        .ensure_tokens(
            config.tracking_api_key.clone(),
            config.feature_flags_api_key.clone(),
        )
        .await
    {
        Ok(tokens) => HttpResponse::Ok().json(SdkTokensResponse {
            tracking_api_key: Some(tokens.tracking_api_key),
            feature_flags_api_key: Some(tokens.feature_flags_api_key),
        }),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": err.to_string()
        })),
    }
}

async fn rotate_tokens(
    pool: web::Data<sqlx::PgPool>,
    payload: web::Json<RotateTokensRequest>,
) -> impl Responder {
    let service = SdkTokenService::new(pool.get_ref().clone());
    let kind = payload.kind.to_lowercase();
    let result = match kind.as_str() {
        "tracking" => service.rotate_tracking().await,
        "feature_flags" => service.rotate_feature_flags().await,
        "all" => service.rotate_all().await,
        _ => Err(anyhow::anyhow!("Invalid rotation kind")),
    };

    match result {
        Ok(tokens) => HttpResponse::Ok().json(SdkTokensResponse {
            tracking_api_key: Some(tokens.tracking_api_key),
            feature_flags_api_key: Some(tokens.feature_flags_api_key),
        }),
        Err(err) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": err.to_string()
        })),
    }
}

async fn list_flags(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<sqlx::PgPool>,
    service: web::Data<FeatureFlagService>,
) -> impl Responder {
    if let Err(response) = verify_feature_flags_key(&req, &config, &pool).await {
        return response;
    }

    match service.list_flags().await {
        Ok(flags) => {
            let summaries = flags
                .into_iter()
                .filter(|flag| matches!(flag.status, FeatureFlagStatus::Active))
                .map(|flag| SdkFlagSummary {
                    name: flag.name,
                    environment: flag.environment,
                    status: flag.status,
                    tags: flag.tags,
                })
                .collect::<Vec<_>>();
            HttpResponse::Ok().json(SdkFlagListResponse { flags: summaries })
        }
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": err.to_string()
        })),
    }
}

async fn evaluate_flags(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<sqlx::PgPool>,
    flag_service: web::Data<FeatureFlagService>,
    gate_service: web::Data<FeatureGateService>,
    payload: web::Json<EvaluateFlagsRequest>,
) -> impl Responder {
    if let Err(response) = verify_feature_flags_key(&req, &config, &pool).await {
        return response;
    }

    let requested_flags = payload
        .flags
        .clone()
        .unwrap_or_default()
        .into_iter()
        .map(|flag| flag.to_lowercase())
        .collect::<Vec<_>>();
    let requested_env = payload.environment.clone().unwrap_or_default();

    let flags = match flag_service.list_flags().await {
        Ok(flags) => flags,
        Err(err) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": err.to_string()
            }))
        }
    };

    let mut evaluations = Vec::new();
    for flag in flags {
        if !requested_flags.is_empty()
            && !requested_flags
                .iter()
                .any(|name| name == &flag.name.to_lowercase())
        {
            continue;
        }

        if !requested_env.is_empty() && flag.environment != requested_env {
            continue;
        }

        if matches!(flag.status, FeatureFlagStatus::Inactive) {
            evaluations.push(SdkFlagEvaluation {
                name: flag.name,
                enabled: false,
                gate_id: None,
                reason: "Flag inactive".to_string(),
            });
            continue;
        }

        let gates = match gate_service.list_gates(Some(flag.id)).await {
            Ok(gates) => gates,
            Err(_) => {
                evaluations.push(SdkFlagEvaluation {
                    name: flag.name,
                    enabled: false,
                    gate_id: None,
                    reason: "Failed to load gates".to_string(),
                });
                continue;
            }
        };

        let active_gate = gates.into_iter().find(|gate| matches!(gate.status, FeatureGateStatus::Active));
        if let Some(gate) = active_gate {
            let request = EvaluateFeatureGateRequest {
                attributes: payload.attributes.clone(),
            };
            match gate_service.evaluate_gate(gate.id, request).await {
                Ok(result) => {
                    evaluations.push(SdkFlagEvaluation {
                        name: flag.name,
                        enabled: result.pass,
                        gate_id: Some(gate.id),
                        reason: result.reason,
                    });
                }
                Err(_) => {
                    evaluations.push(SdkFlagEvaluation {
                        name: flag.name,
                        enabled: false,
                        gate_id: Some(gate.id),
                        reason: "Gate evaluation failed".to_string(),
                    });
                }
            }
        } else {
            evaluations.push(SdkFlagEvaluation {
                name: flag.name,
                enabled: false,
                gate_id: None,
                reason: "No active gates".to_string(),
            });
        }
    }

    HttpResponse::Ok().json(SdkFlagsResponse { flags: evaluations })
}

async fn verify_feature_flags_key(
    req: &HttpRequest,
    config: &Config,
    pool: &sqlx::PgPool,
) -> Result<(), HttpResponse> {
    let service = SdkTokenService::new(pool.clone());
    let expected = match service
        .ensure_tokens(
            config.tracking_api_key.clone(),
            config.feature_flags_api_key.clone(),
        )
        .await
    {
        Ok(tokens) => tokens.feature_flags_api_key,
        Err(_) => {
            return Err(HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Feature flags SDK key not configured"
            })))
        }
    };

    let header = req
        .headers()
        .get("x-expothesis-key")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");

    if header != expected {
        return Err(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Invalid feature flags SDK key"
        })));
    }

    Ok(())
}
