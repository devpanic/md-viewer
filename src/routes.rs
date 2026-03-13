use actix_web::{web, HttpResponse, Result};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::file_browser;
use crate::file_watcher::FileWatcherService;
use crate::markdown;
use crate::project_manager::ProjectManager;

pub struct AppState {
    pub project_manager: Arc<ProjectManager>,
    pub file_watcher: Arc<Mutex<FileWatcherService>>,
}

pub async fn get_files(data: web::Data<Arc<AppState>>) -> Result<HttpResponse> {
    let watch_dir = match data.project_manager.get_current_watch_dir() {
        Some(dir) => dir,
        None => {
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "No project selected. Please select a project in the management tab."
            })));
        }
    };

    match file_browser::build_file_tree(&watch_dir) {
        Ok(tree) => Ok(HttpResponse::Ok().json(tree)),
        Err(e) => {
            log::error!("Failed to build file tree: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to build file tree"
            })))
        }
    }
}

#[derive(serde::Deserialize)]
pub struct FilePathParams {
    env_id: String,
    project_id: String,
    path: String,
}

pub async fn get_file_content(
    params: web::Path<FilePathParams>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    let config = data.project_manager.get_config();

    // Find environment
    let env = match config.environments.iter().find(|e| e.id == params.env_id) {
        Some(e) => e,
        None => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Environment not found"
            })));
        }
    };

    // Find project
    let project = match env.projects.iter().find(|p| p.id == params.project_id) {
        Some(p) => p,
        None => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Project not found"
            })));
        }
    };

    let watch_dir = PathBuf::from(&project.path);

    // Security: prevent path traversal
    if params.path.contains("..") {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid path"
        })));
    }

    let full_path = watch_dir.join(params.path.trim_start_matches('/'));

    // Ensure the path is within the watch directory
    if !full_path.starts_with(&watch_dir) {
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
    params: web::Path<FilePathParams>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    let config = data.project_manager.get_config();

    // Find environment
    let env = match config.environments.iter().find(|e| e.id == params.env_id) {
        Some(e) => e,
        None => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Environment not found"
            })));
        }
    };

    // Find project
    let project = match env.projects.iter().find(|p| p.id == params.project_id) {
        Some(p) => p,
        None => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Project not found"
            })));
        }
    };

    let watch_dir = PathBuf::from(&project.path);

    // Security: prevent path traversal
    if params.path.contains("..") {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid path"
        })));
    }

    let full_path = watch_dir.join(params.path.trim_start_matches('/'));

    // Ensure the path is within the watch directory
    if !full_path.starts_with(&watch_dir) {
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

// Project management API endpoints

pub async fn get_config(data: web::Data<Arc<AppState>>) -> Result<HttpResponse> {
    let config = data.project_manager.get_config();
    Ok(HttpResponse::Ok().json(config))
}

pub async fn get_project_tree(data: web::Data<Arc<AppState>>) -> Result<HttpResponse> {
    let config = data.project_manager.get_config();
    Ok(HttpResponse::Ok().json(config))
}

#[derive(serde::Deserialize)]
pub struct ProjectFilesPath {
    env_id: String,
    project_id: String,
}

pub async fn get_project_files(
    path: web::Path<ProjectFilesPath>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    let config = data.project_manager.get_config();

    // Find environment
    let env = match config.environments.iter().find(|e| e.id == path.env_id) {
        Some(e) => e,
        None => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Environment not found"
            })));
        }
    };

    // Find project
    let project = match env.projects.iter().find(|p| p.id == path.project_id) {
        Some(p) => p,
        None => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Project not found"
            })));
        }
    };

    let project_path = PathBuf::from(&project.path);

    // Check if path exists
    if !project_path.exists() {
        return Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Project path does not exist"
        })));
    }

    match file_browser::build_file_tree(&project_path) {
        Ok(tree) => Ok(HttpResponse::Ok().json(tree)),
        Err(e) => {
            log::error!("Failed to build file tree for project {}: {}", path.project_id, e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to build file tree"
            })))
        }
    }
}


#[derive(serde::Deserialize)]
pub struct AddEnvironmentRequest {
    id: String,
    name: String,
}

pub async fn add_environment(
    req: web::Json<AddEnvironmentRequest>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    match data.project_manager.add_environment(req.id.clone(), req.name.clone()) {
        Ok(_) => Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "message": "Environment added successfully"
        }))),
        Err(e) => Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        }))),
    }
}

#[derive(serde::Deserialize)]
pub struct UpdateEnvironmentRequest {
    id: String,
    name: String,
}

pub async fn update_environment(
    req: web::Json<UpdateEnvironmentRequest>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    match data.project_manager.update_environment(req.id.clone(), req.name.clone()) {
        Ok(_) => Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "message": "Environment updated successfully"
        }))),
        Err(e) => Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        }))),
    }
}

#[derive(serde::Deserialize)]
pub struct DeleteEnvironmentRequest {
    id: String,
}

pub async fn delete_environment(
    req: web::Json<DeleteEnvironmentRequest>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    match data.project_manager.delete_environment(req.id.clone()) {
        Ok(_) => Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "message": "Environment deleted successfully"
        }))),
        Err(e) => Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        }))),
    }
}

#[derive(serde::Deserialize)]
pub struct AddProjectRequest {
    env_id: String,
    id: String,
    name: String,
    path: String,
}

pub async fn add_project(
    req: web::Json<AddProjectRequest>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    match data.project_manager.add_project(
        req.env_id.clone(),
        req.id.clone(),
        req.name.clone(),
        req.path.clone(),
    ) {
        Ok(_) => {
            // Register new project with file watcher
            let path = PathBuf::from(&req.path);
            if let Ok(mut watcher) = data.file_watcher.lock() {
                let _ = watcher.watch_project(&path, &req.env_id, &req.id);
            }
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": "Project added successfully"
            })))
        }
        Err(e) => Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        }))),
    }
}

#[derive(serde::Deserialize)]
pub struct UpdateProjectRequest {
    env_id: String,
    id: String,
    name: String,
    path: String,
}

pub async fn update_project(
    req: web::Json<UpdateProjectRequest>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    match data.project_manager.update_project(
        req.env_id.clone(),
        req.id.clone(),
        req.name.clone(),
        req.path.clone(),
    ) {
        Ok(_) => Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "message": "Project updated successfully"
        }))),
        Err(e) => Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        }))),
    }
}

#[derive(serde::Deserialize)]
pub struct DeleteProjectRequest {
    env_id: String,
    project_id: String,
}

pub async fn delete_project(
    req: web::Json<DeleteProjectRequest>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    match data.project_manager.delete_project(req.env_id.clone(), req.project_id.clone()) {
        Ok(_) => {
            // Unregister project from file watcher
            if let Ok(mut watcher) = data.file_watcher.lock() {
                watcher.unwatch_project(&req.env_id, &req.project_id);
            }
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": "Project deleted successfully"
            })))
        }
        Err(e) => Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        }))),
    }
}

// Favorite API endpoints

#[derive(serde::Deserialize)]
pub struct FavoriteRequest {
    env_id: String,
    project_id: String,
    path: String,
}

pub async fn get_favorites(data: web::Data<Arc<AppState>>) -> Result<HttpResponse> {
    let favorites = data.project_manager.get_favorites();
    Ok(HttpResponse::Ok().json(favorites))
}

pub async fn add_favorite(
    req: web::Json<FavoriteRequest>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    match data.project_manager.add_favorite(
        req.env_id.clone(),
        req.project_id.clone(),
        req.path.clone(),
    ) {
        Ok(_) => Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "message": "Favorite added successfully"
        }))),
        Err(e) => Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        }))),
    }
}

pub async fn remove_favorite(
    req: web::Json<FavoriteRequest>,
    data: web::Data<Arc<AppState>>,
) -> Result<HttpResponse> {
    match data.project_manager.remove_favorite(&req.env_id, &req.project_id, &req.path) {
        Ok(_) => Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "message": "Favorite removed successfully"
        }))),
        Err(e) => Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        }))),
    }
}

