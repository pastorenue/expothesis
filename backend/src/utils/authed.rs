use crate::middleware::auth::AuthedUser;
use actix_web::{HttpMessage, HttpRequest};

pub fn authed(req: &HttpRequest) -> Option<AuthedUser> {
    req.extensions().get::<AuthedUser>().cloned()
}
