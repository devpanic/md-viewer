use actix_web::{web, HttpResponse, Result};
use std::path::PathBuf;
use std::sync::Arc;

use crate::file_browser;
use crate::markdown;

pub struct AppState {
    pub watch_dir: PathBuf,
}

pub async fn get_files(data: web::Data<Arc<AppState>>) -> Result<HttpResponse> {
    match file_browser::build_file_tree(&data.watch_dir) {
        Ok(tree) => Ok(HttpResponse::Ok().json(tree)),
        Err(e) => {
            log::error!("Failed to build file tree: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to build file tree"
            })))
        }
    }
}

pub async fn get_file_content(
    path: web::Path<String>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    let requested_path = path.into_inner();
    
    // Security: prevent path traversal
    if requested_path.contains("..") {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid path"
        })));
    }

    let full_path = data.watch_dir.join(requested_path.trim_start_matches('/'));

    // Ensure the path is within the watch directory
    if !full_path.starts_with(&data.watch_dir) {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid path"
        })));
    }

    match tokio::fs::read_to_string(&full_path).await {
        Ok(content) => Ok(HttpResponse::Ok().body(content)),
        Err(e) => {
            log::error!("Failed to read file {:?}: {}", full_path, e);
            Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "File not found"
            })))
        }
    }
}

pub async fn render_markdown(
    path: web::Path<String>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    let requested_path = path.into_inner();
    
    // Security: prevent path traversal
    if requested_path.contains("..") {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid path"
        })));
    }

    let full_path = data.watch_dir.join(requested_path.trim_start_matches('/'));

    // Ensure the path is within the watch directory
    if !full_path.starts_with(&data.watch_dir) {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid path"
        })));
    }

    match tokio::fs::read_to_string(&full_path).await {
        Ok(content) => {
            let html = markdown::render_markdown(&content);
            Ok(HttpResponse::Ok().body(html))
        }
        Err(e) => {
            log::error!("Failed to read file {:?}: {}", full_path, e);
            Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "File not found"
            })))
        }
    }
}
