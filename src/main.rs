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
            .service(
                web::resource("/api/favorites")
                    .route(web::get().to(routes::get_favorites))
                    .route(web::post().to(routes::add_favorite))
                    .route(web::delete().to(routes::remove_favorite))
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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
    <link rel="stylesheet" href="/static/css/main.css?v=3">
    <link rel="stylesheet" href="/static/vendor/katex.min.css">
</head>
<body>
    <div class="app">
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-brand">
                    <div class="sidebar-brand-icon">M</div>
                    <span class="sidebar-brand-text">Markdown Viewer <span class="sidebar-brand-version">v1.0</span></span>
                </div>
            </div>
            <div class="sidebar-body" id="file-tree">
            </div>
            <div class="sidebar-footer">
                <button class="sidebar-footer-btn" id="add-env-btn" title="환경 추가">
                    <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    환경 추가
                </button>
                <div class="theme-picker theme-picker-sidebar">
                    <button class="sidebar-footer-icon" id="settings-btn" title="설정">
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </button>
                    <div class="theme-dropdown" id="theme-dropdown">
                        <div class="theme-dropdown-title">Accent Color</div>
                        <div class="theme-swatches" id="theme-swatches"></div>
                    </div>
                </div>
            </div>
        </aside>
        <button class="sidebar-toggle" id="sidebar-toggle" title="사이드바 토글">
            <svg id="sidebar-toggle-icon" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <main class="main">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="breadcrumb" id="breadcrumb">
                        <span class="breadcrumb-item">파일을 선택하세요</span>
                    </div>
                </div>
                <div class="toolbar-actions">
                    <button class="toolbar-btn" id="home-btn" title="초기 화면">
                        <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </button>
                    <button class="toolbar-btn" id="split-toggle-btn" title="화면 분할">
                        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
                    </button>
                </div>
            </div>
            <div class="pane-container" id="pane-container">
                <div class="pane active-pane" id="pane-1" data-pane-id="1">
                    <div class="pane-tabs" id="pane-tab-bar-1"></div>
                    <div class="pane-content" id="pane-content-1">
                        <div class="markdown-viewer" id="markdown-viewer-1"></div>
                    </div>
                </div>
                <div class="pane" id="pane-2" data-pane-id="2" style="display: none;">
                    <div class="pane-tabs" id="pane-tab-bar-2"></div>
                    <div class="pane-content" id="pane-content-2">
                        <div class="markdown-viewer" id="markdown-viewer-2"></div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- Modal Dialog -->
    <div id="modal-overlay" class="modal-overlay">
        <div class="modal-dialog">
            <div class="modal-header">
                <span class="modal-title" id="modal-title"></span>
                <button class="modal-close-btn" id="modal-close">
                    <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="modal-body">
                <p class="modal-message" id="modal-message"></p>
                <input type="text" id="modal-input" class="modal-input" style="display: none;">
                <input type="text" id="modal-input2" class="modal-input" style="display: none;">
            </div>
            <div class="modal-footer">
                <button id="modal-cancel" class="btn btn-ghost">취소</button>
                <button id="modal-confirm" class="btn btn-primary">확인</button>
            </div>
        </div>
    </div>

    <script src="/static/vendor/highlight.min.js"></script>
    <script src="/static/vendor/katex.min.js"></script>
    <script src="/static/vendor/auto-render.min.js"></script>
    <script src="/static/vendor/mermaid.min.js"></script>
    <script src="/static/js/websocket-client.js?v=3"></script>
    <script src="/static/js/file-browser.js?v=3"></script>
    <script src="/static/js/markdown-viewer.js?v=3"></script>
    <script src="/static/js/context-menu.js?v=3"></script>
    <script src="/static/js/tab-manager.js?v=3"></script>
    <script src="/static/js/management.js?v=3"></script>
    <script src="/static/js/app.js?v=3"></script>
</body>
</html>"#;

    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(html)
}
