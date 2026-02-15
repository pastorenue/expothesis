use actix_web::{web, HttpResponse, Responder};
use futures_util::StreamExt;
use serde_json::Value;
use serde::{Deserialize, Serialize};

use crate::config::Config;

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub model: Option<String>,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct ChatResponse {
    pub model: String,
    pub message: ChatMessage,
    pub usage: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct LiteLLMChatResponse {
    model: String,
    choices: Vec<LiteLLMChoice>,
}

#[derive(Debug, Deserialize)]
struct LiteLLMChoice {
    message: ChatMessage,
}

#[derive(Debug, Serialize)]
pub struct ModelListResponse {
    pub models: Vec<String>,
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/ai")
            .route("/chat", web::post().to(chat))
            .route("/chat/stream", web::post().to(chat_stream))
            .route("/models", web::get().to(models)),
    );
}

async fn models(config: web::Data<Config>) -> impl Responder {
    let Some(base_url) = config.litellm_base_url.clone() else {
        return HttpResponse::Ok().json(ModelListResponse {
            models: config.litellm_models.clone(),
        });
    };

    let url = format!("{}/models", base_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let mut request = client.get(&url);
    if let Some(api_key) = config.litellm_api_key.as_ref() {
        request = request.bearer_auth(api_key);
    }

    let response = request.send().await;
    match response {
        Ok(resp) => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(data) = json.get("data").and_then(|value| value.as_array()) {
                    let models = data
                        .iter()
                        .filter_map(|item| item.get("id").and_then(|id| id.as_str()))
                        .map(|value| value.to_string())
                        .collect::<Vec<String>>();
                    return HttpResponse::Ok().json(ModelListResponse { models });
                }
            }
            HttpResponse::Ok().json(ModelListResponse {
                models: config.litellm_models.clone(),
            })
        }
        Err(_) => HttpResponse::Ok().json(ModelListResponse {
            models: config.litellm_models.clone(),
        }),
    }
}

async fn chat(
    config: web::Data<Config>,
    payload: web::Json<ChatRequest>,
) -> impl Responder {
    let Some(base_url) = config.litellm_base_url.clone() else {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "LITELLM_BASE_URL is not configured"
        }));
    };

    let default_model = config
        .litellm_default_model
        .clone()
        .unwrap_or_else(|| "gpt-4o-mini".to_string());

    let requested_model = payload.model.clone().unwrap_or_else(|| default_model.clone());
    let model = if config.litellm_models.is_empty() {
        requested_model
    } else if config.litellm_models.contains(&requested_model) {
        requested_model
    } else {
        default_model.clone()
    };

    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let mut request = client.post(&url);
    if let Some(api_key) = config.litellm_api_key.as_ref() {
        request = request.bearer_auth(api_key);
    }

    let temperature = payload.temperature.unwrap_or(0.4);
    let max_tokens = payload.max_tokens.unwrap_or(512);

    let body = serde_json::json!({
        "model": model,
        "messages": payload.messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    });

    match request.json(&body).send().await {
        Ok(resp) => match resp.json::<Value>().await {
            Ok(result) => {
                let model = result
                    .get("model")
                    .and_then(|value| value.as_str())
                    .unwrap_or(&default_model)
                    .to_string();
                let message = result
                    .get("choices")
                    .and_then(|choices| choices.as_array())
                    .and_then(|choices| choices.first())
                    .and_then(|choice| choice.get("message"))
                    .and_then(|message| serde_json::from_value::<ChatMessage>(message.clone()).ok());

                if let Some(message) = message {
                    if let Some(usage) = result.get("usage") {
                        log::info!("AI usage: {}", usage);
                    }
                    return HttpResponse::Ok().json(ChatResponse {
                        model,
                        message,
                        usage: result.get("usage").cloned(),
                    });
                }

                HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "No choices returned from model"
                }))
            }
            Err(err) => HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("Failed to parse response: {}", err)
            })),
        },
        Err(err) => HttpResponse::BadGateway().json(serde_json::json!({
            "error": format!("Failed to reach LiteLLM: {}", err)
        })),
    }
}

async fn chat_stream(
    config: web::Data<Config>,
    payload: web::Json<ChatRequest>,
) -> impl Responder {
    let Some(base_url) = config.litellm_base_url.clone() else {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "LITELLM_BASE_URL is not configured"
        }));
    };

    let default_model = config
        .litellm_default_model
        .clone()
        .unwrap_or_else(|| "gpt-4o-mini".to_string());

    let requested_model = payload.model.clone().unwrap_or_else(|| default_model.clone());
    let model = if config.litellm_models.is_empty() {
        requested_model
    } else if config.litellm_models.contains(&requested_model) {
        requested_model
    } else {
        default_model.clone()
    };

    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let mut request = client.post(&url);
    if let Some(api_key) = config.litellm_api_key.as_ref() {
        request = request.bearer_auth(api_key);
    }

    let temperature = payload.temperature.unwrap_or(0.4);
    let max_tokens = payload.max_tokens.unwrap_or(512);

    let body = serde_json::json!({
        "model": model,
        "messages": payload.messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": true,
    });

    let response = match request.json(&body).send().await {
        Ok(resp) => resp,
        Err(err) => {
            return HttpResponse::BadGateway().json(serde_json::json!({
                "error": format!("Failed to reach LiteLLM: {}", err)
            }))
        }
    };

    let stream = response.bytes_stream().map(|chunk| match chunk {
        Ok(bytes) => Ok::<web::Bytes, actix_web::Error>(web::Bytes::from(bytes)),
        Err(err) => Ok::<web::Bytes, actix_web::Error>(web::Bytes::from(format!(
            "data: {{\"error\":\"{}\"}}\n\n",
            err
        ))),
    });

    HttpResponse::Ok()
        .content_type("text/event-stream")
        .streaming(stream)
}
