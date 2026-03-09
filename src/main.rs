mod config;
mod file_browser;
mod file_watcher;
mod markdown;
mod project_manager;
mod routes;
mod websocket;

use actix_files as fs;
use actix_web::{middleware, web, App, HttpResponse, HttpServer};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::broadcast;

use config::Config;
use file_watcher::FileWatcherService;
use project_manager::ProjectManager;
use routes::AppState;
use websocket::WsMessage;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let config = Config::parse_args();

    // Initialize project manager
    let project_manager = Arc::new(
        ProjectManager::new().expect("Failed to initialize project manager")
    );

    log::info!("Starting markdown viewer");
    log::info!("Server URL: {}", config.server_url());

    // Create broadcast channel for file changes
    let (broadcast_tx, _) = broadcast::channel::<WsMessage>(100);

    // Start file watcher and register all project directories
    let mut watcher = FileWatcherService::new(
        broadcast_tx.clone(),
        Duration::from_millis(config.debounce_ms),
    )
    .expect("Failed to start file watcher");

    // Register CLI watch directory if provided
    if let Some(ref dir) = config.watch_dir {
        if dir.exists() && dir.is_dir() {
            let _ = watcher.watch_project(dir, "_cli", "_cli");
        }
    }

    // Register all project directories from config
    let prj_config = project_manager.get_config();
    for env in &prj_config.environments {
        for project in &env.projects {
            let path = PathBuf::from(&project.path);
            let _ = watcher.watch_project(&path, &env.id, &project.id);
        }
    }

    let file_watcher = Arc::new(Mutex::new(watcher));

    // Create app state
    let app_state = Arc::new(AppState {
        project_manager: project_manager.clone(),
        file_watcher: file_watcher.clone(),
    });

    let bind_address = config.bind_address();
    let server_url = config.server_url();

    // Auto-open browser
    if !config.no_browser {
        let url = server_url.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(500)).await;
            if let Err(e) = open::that(&url) {
                log::warn!("Failed to open browser: {}", e);
            }
        });
    }

    // Start HTTP server
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .app_data(web::Data::new(broadcast_tx.clone()))
            .wrap(middleware::Logger::default())
            .service(web::resource("/ws").route(web::get().to(websocket::websocket_handler)))
            .service(web::resource("/api/files").route(web::get().to(routes::get_files)))
            .service(
                web::resource("/api/file/{env_id}/{project_id}/{path:.*}")
                    .route(web::get().to(routes::get_file_content)),
            )
            .service(
                web::resource("/api/render/{env_id}/{project_id}/{path:.*}")
                    .route(web::get().to(routes::render_markdown)),
            )
            // Project management API
            .service(web::resource("/api/config").route(web::get().to(routes::get_config)))
            .service(web::resource("/api/project-tree").route(web::get().to(routes::get_project_tree)))
            .service(web::resource("/api/project-files/{env_id}/{project_id}").route(web::get().to(routes::get_project_files)))
            .service(
                web::resource("/api/environments")
                    .route(web::post().to(routes::add_environment))
                    .route(web::put().to(routes::update_environment))
                    .route(web::delete().to(routes::delete_environment))
            )
            .service(
                web::resource("/api/projects")
                    .route(web::post().to(routes::add_project))
                    .route(web::put().to(routes::update_project))
                    .route(web::delete().to(routes::delete_project))
            )
            .service(fs::Files::new("/static", "./static"))
            .service(web::resource("/").route(web::get().to(index_handler)))
    })
    .bind(&bind_address)?
    .run()
    .await
}

async fn index_handler() -> HttpResponse {
    let html = r#"<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Markdown Viewer</title>
    <link rel="stylesheet" href="/static/css/main.css">
    <link rel="stylesheet" href="/static/vendor/katex.min.css">
</head>
<body>
    <div class="app-container">
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="tabs">
                    <button class="tab-button active" data-tab="files">파일</button>
                    <button class="tab-button" data-tab="management">관리</button>
                </div>
            </div>
            <div class="tab-content active" id="files-tab">
                <div class="file-tree" id="file-tree">
                    Loading...
                </div>
            </div>
            <div class="tab-content" id="management-tab">
                <div class="management-container">
                    <div class="env-selector">
                        <label>현재 환경:</label>
                        <select id="env-select">
                            <option value="">로딩중...</option>
                        </select>
                    </div>
                    <div class="env-actions">
                        <button id="add-env-btn" class="icon-btn icon-btn-add" title="환경 추가">+</button>
                        <button id="edit-env-btn" class="icon-btn icon-btn-edit" title="환경 수정">✎</button>
                        <button id="delete-env-btn" class="icon-btn icon-btn-delete" title="환경 삭제">×</button>
                    </div>
                    <div class="projects-section">
                        <h3>프로젝트 목록</h3>
                        <div id="projects-list">
                            로딩중...
                        </div>
                        <button id="add-project-btn" class="icon-btn icon-btn-add icon-btn-full" title="프로젝트 추가">+ 프로젝트 추가</button>
                    </div>
                </div>
            </div>
        </aside>
        <button class="sidebar-toggle" id="sidebar-toggle" title="사이드바 토글">
            <span class="sidebar-toggle-icon" id="sidebar-toggle-icon">&lsaquo;</span>
        </button>
        <main class="content">
            <div class="content-toolbar" id="content-toolbar">
                <button class="split-toggle-btn" id="split-toggle-btn" title="화면 분할">&#x25EB;</button>
            </div>
            <div class="pane-container" id="pane-container">
                <div class="pane active-pane" id="pane-1" data-pane-id="1">
                    <div class="pane-tab-bar" id="pane-tab-bar-1"></div>
                    <div class="pane-content" id="pane-content-1">
                        <div class="markdown-viewer" id="markdown-viewer-1">
                            <div class="welcome">
                                <h1>Markdown Viewer</h1>
                                <p>Select a markdown file from the sidebar to view it here.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="pane" id="pane-2" data-pane-id="2" style="display: none;">
                    <div class="pane-tab-bar" id="pane-tab-bar-2"></div>
                    <div class="pane-content" id="pane-content-2">
                        <div class="markdown-viewer" id="markdown-viewer-2">
                            <div class="welcome">
                                <h1>Markdown Viewer</h1>
                                <p>Select a markdown file from the sidebar to view it here.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- Modal Dialog -->
    <div id="modal-overlay" class="modal-overlay">
        <div class="modal-dialog">
            <div class="modal-header">
                <h3 id="modal-title"></h3>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p id="modal-message"></p>
                <input type="text" id="modal-input" class="modal-input" style="display: none;">
                <input type="text" id="modal-input2" class="modal-input" style="display: none;">
            </div>
            <div class="modal-footer">
                <button id="modal-cancel" class="btn btn-secondary">취소</button>
                <button id="modal-confirm" class="btn btn-primary">확인</button>
            </div>
        </div>
    </div>

    <script src="/static/vendor/highlight.min.js"></script>
    <script src="/static/vendor/katex.min.js"></script>
    <script src="/static/vendor/auto-render.min.js"></script>
    <script src="/static/vendor/mermaid.min.js"></script>
    <script src="/static/js/websocket-client.js"></script>
    <script src="/static/js/file-browser.js"></script>
    <script src="/static/js/markdown-viewer.js"></script>
    <script src="/static/js/context-menu.js"></script>
    <script src="/static/js/tab-manager.js"></script>
    <script src="/static/js/management.js"></script>
    <script src="/static/js/app.js"></script>
</body>
</html>"#;

    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(html)
}
