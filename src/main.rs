mod config;
mod file_browser;
mod file_watcher;
mod markdown;
mod routes;
mod websocket;

use actix_files as fs;
use actix_web::{middleware, web, App, HttpResponse, HttpServer};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;

use config::Config;
use file_watcher::FileWatcherService;
use routes::AppState;
use websocket::WsMessage;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let config = Config::parse_args();

    // Validate watch directory
    if !config.watch_dir.exists() {
        eprintln!("Error: Directory does not exist: {:?}", config.watch_dir);
        std::process::exit(1);
    }

    if !config.watch_dir.is_dir() {
        eprintln!("Error: Path is not a directory: {:?}", config.watch_dir);
        std::process::exit(1);
    }

    log::info!("Starting markdown viewer");
    log::info!("Watching directory: {:?}", config.watch_dir);
    log::info!("Server URL: {}", config.server_url());

    // Create broadcast channel for file changes
    let (broadcast_tx, _) = broadcast::channel::<WsMessage>(100);

    // Start file watcher
    let _watcher = FileWatcherService::new(
        &config.watch_dir,
        broadcast_tx.clone(),
        Duration::from_millis(config.debounce_ms),
    )
    .expect("Failed to start file watcher");

    // Create app state
    let app_state = Arc::new(AppState {
        watch_dir: config.watch_dir.clone(),
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
                web::resource("/api/file/{path:.*}")
                    .route(web::get().to(routes::get_file_content)),
            )
            .service(
                web::resource("/api/render/{path:.*}")
                    .route(web::get().to(routes::render_markdown)),
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
                <h2>Files</h2>
            </div>
            <div class="file-tree" id="file-tree">
                Loading...
            </div>
        </aside>
        <main class="content">
            <div class="markdown-viewer" id="markdown-viewer">
                <div class="welcome">
                    <h1>Markdown Viewer</h1>
                    <p>Select a markdown file from the sidebar to view it here.</p>
                </div>
            </div>
        </main>
    </div>

    <script src="/static/vendor/highlight.min.js"></script>
    <script src="/static/vendor/katex.min.js"></script>
    <script src="/static/vendor/auto-render.min.js"></script>
    <script src="/static/vendor/mermaid.min.js"></script>
    <script src="/static/js/websocket-client.js"></script>
    <script src="/static/js/file-browser.js"></script>
    <script src="/static/js/markdown-viewer.js"></script>
    <script src="/static/js/app.js"></script>
</body>
</html>"#;

    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(html)
}
