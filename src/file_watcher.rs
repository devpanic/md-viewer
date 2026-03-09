use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tokio::sync::broadcast;

use crate::websocket::WsMessage;

pub struct FileWatcherService {
    watcher: RecommendedWatcher,
    watched_projects: Arc<RwLock<HashMap<PathBuf, (String, String)>>>,
}

impl FileWatcherService {
    pub fn new(
        broadcast_tx: broadcast::Sender<WsMessage>,
        debounce_duration: Duration,
    ) -> anyhow::Result<Self> {
        let watched_projects: Arc<RwLock<HashMap<PathBuf, (String, String)>>> =
            Arc::new(RwLock::new(HashMap::new()));

        let projects_ref = watched_projects.clone();

        let watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| match res {
                Ok(event) => {
                    handle_file_event(event, &broadcast_tx, &projects_ref);
                }
                Err(e) => {
                    log::error!("File watcher error: {}", e);
                }
            },
            Config::default().with_poll_interval(debounce_duration),
        )?;

        log::info!("File watcher service initialized");

        Ok(FileWatcherService {
            watcher,
            watched_projects,
        })
    }

    pub fn watch_project(
        &mut self,
        path: &Path,
        env_id: &str,
        project_id: &str,
    ) -> anyhow::Result<()> {
        if !path.exists() || !path.is_dir() {
            log::warn!("Skipping watch for non-existent directory: {:?}", path);
            return Ok(());
        }

        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());

        self.watcher.watch(&canonical, RecursiveMode::Recursive)?;

        self.watched_projects.write().unwrap().insert(
            canonical.clone(),
            (env_id.to_string(), project_id.to_string()),
        );

        log::info!(
            "Watching project: {}:{} at {:?}",
            env_id,
            project_id,
            canonical
        );

        Ok(())
    }

    pub fn unwatch_project(&mut self, env_id: &str, project_id: &str) {
        let path = {
            let projects = self.watched_projects.read().unwrap();
            projects
                .iter()
                .find(|(_, (eid, pid))| eid == env_id && pid == project_id)
                .map(|(path, _)| path.clone())
        };

        if let Some(path) = path {
            let _ = self.watcher.unwatch(&path);
            self.watched_projects.write().unwrap().remove(&path);
            log::info!(
                "Unwatched project: {}:{} at {:?}",
                env_id,
                project_id,
                path
            );
        }
    }
}

fn handle_file_event(
    event: Event,
    broadcast_tx: &broadcast::Sender<WsMessage>,
    watched_projects: &Arc<RwLock<HashMap<PathBuf, (String, String)>>>,
) {
    let is_markdown = event.paths.iter().any(|p| {
        p.extension()
            .and_then(|e| e.to_str())
            .map(|e| e == "md" || e == "markdown")
            .unwrap_or(false)
    });

    if !is_markdown {
        return;
    }

    let event_path = match event.paths.first() {
        Some(p) => p,
        None => return,
    };

    let (env_id, project_id) = {
        let projects = watched_projects.read().unwrap();
        let mut found = None;
        for (watch_path, (eid, pid)) in projects.iter() {
            if event_path.starts_with(watch_path) {
                found = Some((eid.clone(), pid.clone()));
                break;
            }
        }
        match found {
            Some(ids) => ids,
            None => return,
        }
    };

    let path_str = event_path.to_str().unwrap_or("").to_string();

    let msg = match event.kind {
        EventKind::Create(_) => {
            log::info!("File created: {} ({}:{})", path_str, env_id, project_id);
            WsMessage::FileCreated {
                path: path_str,
                env_id,
                project_id,
            }
        }
        EventKind::Modify(_) => {
            log::info!("File modified: {} ({}:{})", path_str, env_id, project_id);
            WsMessage::FileChanged {
                path: path_str,
                env_id,
                project_id,
            }
        }
        EventKind::Remove(_) => {
            log::info!("File deleted: {} ({}:{})", path_str, env_id, project_id);
            WsMessage::FileDeleted {
                path: path_str,
                env_id,
                project_id,
            }
        }
        _ => return,
    };

    if let Err(e) = broadcast_tx.send(msg) {
        log::debug!("No active subscribers for file change: {}", e);
    }
}
