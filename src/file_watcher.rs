use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::time::Duration;
use tokio::sync::broadcast;

use crate::websocket::WsMessage;

pub struct FileWatcherService {
    _watcher: RecommendedWatcher,
}

impl FileWatcherService {
    pub fn new(
        watch_path: &Path,
        broadcast_tx: broadcast::Sender<WsMessage>,
        debounce_duration: Duration,
    ) -> anyhow::Result<Self> {
        let tx = broadcast_tx.clone();

        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                match res {
                    Ok(event) => {
                        handle_file_event(event, &tx);
                    }
                    Err(e) => {
                        log::error!("File watcher error: {}", e);
                    }
                }
            },
            Config::default().with_poll_interval(debounce_duration),
        )?;

        watcher.watch(watch_path, RecursiveMode::Recursive)?;

        log::info!("File watcher started for: {:?}", watch_path);

        Ok(FileWatcherService { _watcher: watcher })
    }
}

fn handle_file_event(event: Event, broadcast_tx: &broadcast::Sender<WsMessage>) {
    // Only process events for markdown files
    let is_markdown = event.paths.iter().any(|p| {
        p.extension()
            .and_then(|e| e.to_str())
            .map(|e| e == "md" || e == "markdown")
            .unwrap_or(false)
    });

    if !is_markdown {
        return;
    }

    let msg = match event.kind {
        EventKind::Create(_) => {
            let path = event.paths.first().and_then(|p| p.to_str()).unwrap_or("");
            log::info!("File created: {}", path);
            WsMessage::FileCreated {
                path: path.to_string(),
            }
        }
        EventKind::Modify(_) => {
            let path = event.paths.first().and_then(|p| p.to_str()).unwrap_or("");
            log::info!("File modified: {}", path);
            WsMessage::FileChanged {
                path: path.to_string(),
            }
        }
        EventKind::Remove(_) => {
            let path = event.paths.first().and_then(|p| p.to_str()).unwrap_or("");
            log::info!("File deleted: {}", path);
            WsMessage::FileDeleted {
                path: path.to_string(),
            }
        }
        _ => return,
    };

    // Broadcast the message
    if let Err(e) = broadcast_tx.send(msg) {
        log::debug!("No active subscribers for file change: {}", e);
    }
}
