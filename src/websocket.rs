use actix_web::{web, HttpRequest, HttpResponse, Result};
use actix_ws::Message;
use futures::StreamExt;
use serde::Serialize;
use std::time::Duration;
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsMessage {
    FileChanged { path: String },
    FileCreated { path: String },
    FileDeleted { path: String },
    TreeUpdated,
}

pub async fn websocket_handler(
    req: HttpRequest,
    stream: web::Payload,
    broadcast_tx: web::Data<broadcast::Sender<WsMessage>>,
) -> Result<HttpResponse> {
    let (response, mut session, mut msg_stream) = actix_ws::handle(&req, stream)?;

    let mut rx = broadcast_tx.subscribe();

    actix_web::rt::spawn(async move {
        let mut last_pong = tokio::time::Instant::now();
        let mut interval = tokio::time::interval(Duration::from_secs(5));

        loop {
            tokio::select! {
                Some(Ok(msg)) = msg_stream.next() => {
                    match msg {
                        Message::Ping(bytes) => {
                            if session.pong(&bytes).await.is_err() {
                                break;
                            }
                        }
                        Message::Pong(_) => {
                            last_pong = tokio::time::Instant::now();
                        }
                        Message::Close(_) => {
                            break;
                        }
                        _ => {}
                    }
                }
                Ok(event) = rx.recv() => {
                    let json = match serde_json::to_string(&event) {
                        Ok(j) => j,
                        Err(e) => {
                            log::error!("Failed to serialize message: {}", e);
                            continue;
                        }
                    };

                    if session.text(json).await.is_err() {
                        break;
                    }
                }
                _ = interval.tick() => {
                    // Send ping every 5 seconds
                    if session.ping(b"").await.is_err() {
                        break;
                    }

                    // Check if we haven't received pong in 30 seconds
                    if last_pong.elapsed() > Duration::from_secs(30) {
                        log::debug!("WebSocket connection timed out");
                        break;
                    }
                }
            }
        }

        let _ = session.close(None).await;
    });

    Ok(response)
}
