pub mod analytics;
pub mod ai;
pub mod auth;
pub mod events;
pub mod experiments;
pub mod feature_flags;
pub mod feature_gates;
pub mod organizations;
pub mod sdk;
pub mod track;
pub mod user_groups;

use actix_web::web;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .configure(auth::configure)
            .configure(experiments::configure)
            .configure(user_groups::configure)
            .configure(events::configure)
            .configure(analytics::configure)
            .configure(feature_flags::configure)
            .configure(feature_gates::configure)
            .configure(organizations::configure)
            .configure(sdk::configure)
            .configure(ai::configure)
            .configure(track::configure),
    );
}
