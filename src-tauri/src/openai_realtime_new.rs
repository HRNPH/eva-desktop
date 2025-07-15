use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use openai_api_rs::realtime::api::RealtimeClient;
use openai_api_rs::realtime::server_event::ServerEvent;
use openai_api_rs::realtime::client_event::ClientEvent;
use tauri::Emitter;
use log::{info, error};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RealtimeStatus {
    pub api_key: String,
    pub connected: bool,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct OpenAIRealtimeService {
    api_key: Option<String>,
    session_id: Option<String>,
    is_connected: Arc<Mutex<bool>>,
    client: Option<Arc<Mutex<RealtimeClient>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum OpenAIEvent {
    #[serde(rename = "session.created")]
    SessionCreated {
        session: SessionInfo,
    },
    #[serde(rename = "response.text.delta")]
    ResponseTextDelta {
        delta: String,
    },
    #[serde(rename = "response.text.done")]
    ResponseTextDone {
        text: String,
    },
    #[serde(rename = "response.audio.delta")]
    ResponseAudioDelta {
        delta: String,
    },
    #[serde(rename = "response.audio.done")]
    ResponseAudioDone {
        item_id: String,
    },
    #[serde(rename = "error")]
    Error {
        error: ErrorInfo,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub model: String,
    pub modalities: Vec<String>,
    pub voice: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorInfo {
    pub message: String,
    pub r#type: String,
    pub code: Option<String>,
}

#[derive(Debug)]
pub enum RealtimeError {
    ApiKey(String),
    Connection(String),
    Protocol(String),
    Timeout(String),
}

impl std::fmt::Display for RealtimeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RealtimeError::ApiKey(msg) => write!(f, "API Key error: {}", msg),
            RealtimeError::Connection(msg) => write!(f, "Connection error: {}", msg),
            RealtimeError::Protocol(msg) => write!(f, "Protocol error: {}", msg),
            RealtimeError::Timeout(msg) => write!(f, "Timeout error: {}", msg),
        }
    }
}

impl std::error::Error for RealtimeError {}

impl OpenAIRealtimeService {
    pub fn new() -> Self {
        Self {
            api_key: None,
            session_id: None,
            is_connected: Arc::new(Mutex::new(false)),
            client: None,
        }
    }

    /// Get OpenAI API key from environment variable
    fn get_api_key(&mut self) -> Result<String, RealtimeError> {
        if let Some(ref key) = self.api_key {
            return Ok(key.clone());
        }

        match std::env::var("OPENAI_API_KEY") {
            Ok(key) => {
                if key.trim().is_empty() {
                    return Err(RealtimeError::ApiKey(
                        "OPENAI_API_KEY environment variable is empty".to_string()
                    ));
                }
                self.api_key = Some(key.clone());
                Ok(key)
            }
            Err(_) => Err(RealtimeError::ApiKey(
                "OPENAI_API_KEY environment variable not found".to_string()
            )),
        }
    }

    /// Initialize connection to OpenAI Realtime API
    pub async fn connect<R: tauri::Runtime>(&mut self, app_handle: tauri::AppHandle<R>) -> Result<(), RealtimeError> {
        // Get API key from environment
        let api_key = std::env::var("OPENAI_API_KEY")
            .map_err(|_| RealtimeError::ApiKey("OPENAI_API_KEY not found".to_string()))?;

        if api_key.is_empty() {
            return Err(RealtimeError::ApiKey("API key is empty".to_string()));
        }

        self.api_key = Some(api_key.clone());

        let model = "gpt-4o-realtime-preview-2024-10-01".to_string();
        let mut realtime_client = RealtimeClient::new(api_key, model);

        info!("Connecting to OpenAI Realtime API...");
        
        // Connect using the library
        realtime_client.connect().await
            .map_err(|e| RealtimeError::Connection(format!("Failed to connect: {}", e)))?;

        info!("Connected to OpenAI Realtime API successfully");
        *self.is_connected.lock().await = true;

        // Store the client for later use
        self.client = Some(Arc::new(Mutex::new(realtime_client)));

        // Configure session with Eva's personality
        self.configure_session().await?;

        Ok(())
    }

    /// Configure the session with Eva's personality and voice settings
    async fn configure_session(&self) -> Result<(), RealtimeError> {
        if let Some(ref client_arc) = self.client {
            let mut client = client_arc.lock().await;
            
            // Update session configuration
            let session_update = ClientEvent::SessionUpdate {
                session: openai_api_rs::realtime::session::SessionConfig {
                    modalities: Some(vec!["text".to_string(), "audio".to_string()]),
                    instructions: Some("You are Eva, a very cute AI assistant. Respond in a friendly, helpful, and slightly playful manner. Keep your responses concise but warm.".to_string()),
                    voice: Some("alloy".to_string()),
                    input_audio_format: Some("pcm16".to_string()),
                    output_audio_format: Some("pcm16".to_string()),
                    input_audio_transcription: None,
                    turn_detection: None,
                    tools: None,
                    tool_choice: None,
                    temperature: Some(0.8),
                    max_response_output_tokens: Some(4096),
                }
            };

            client.send_event(session_update).await
                .map_err(|e| RealtimeError::Protocol(format!("Failed to configure session: {}", e)))?;

            info!("✅ Session configured with Eva's personality");
        }

        Ok(())
    }

    /// Send text input to OpenAI
    pub async fn send_text(&self, text: &str) -> Result<(), RealtimeError> {
        if !*self.is_connected.lock().await {
            return Err(RealtimeError::Connection("Not connected to OpenAI".to_string()));
        }

        if let Some(ref client_arc) = self.client {
            let mut client = client_arc.lock().await;
            
            // Create conversation item
            let item_create = ClientEvent::ConversationItemCreate {
                previous_item_id: None,
                item: openai_api_rs::realtime::conversation_item::ConversationItem {
                    id: None,
                    r#type: "message".to_string(),
                    status: None,
                    role: Some("user".to_string()),
                    content: Some(vec![
                        openai_api_rs::realtime::content::Content {
                            r#type: "input_text".to_string(),
                            text: Some(text.to_string()),
                            audio: None,
                            transcript: None,
                        }
                    ]),
                    call_id: None,
                    name: None,
                    arguments: None,
                    output: None,
                }
            };

            client.send_event(item_create).await
                .map_err(|e| RealtimeError::Protocol(format!("Failed to send text: {}", e)))?;

            // Request response
            let response_create = ClientEvent::ResponseCreate {
                response: openai_api_rs::realtime::response::ResponseConfig {
                    modalities: Some(vec!["text".to_string(), "audio".to_string()]),
                    instructions: Some("Please respond as Eva, the cute AI assistant.".to_string()),
                    voice: Some("alloy".to_string()),
                    output_audio_format: Some("pcm16".to_string()),
                    tools: None,
                    tool_choice: None,
                    temperature: Some(0.8),
                    max_output_tokens: Some(4096),
                }
            };

            client.send_event(response_create).await
                .map_err(|e| RealtimeError::Protocol(format!("Failed to request response: {}", e)))?;

            info!("📤 Sent text to OpenAI: {}", text);
        }

        Ok(())
    }

    /// Send audio input to OpenAI (base64 encoded PCM16)
    pub async fn send_audio(&self, audio_base64: &str) -> Result<(), RealtimeError> {
        if !*self.is_connected.lock().await {
            return Err(RealtimeError::Connection("Not connected to OpenAI".to_string()));
        }

        if let Some(ref client_arc) = self.client {
            let mut client = client_arc.lock().await;
            
            let audio_append = ClientEvent::InputAudioBufferAppend {
                audio: audio_base64.to_string(),
            };

            client.send_event(audio_append).await
                .map_err(|e| RealtimeError::Protocol(format!("Failed to send audio: {}", e)))?;

            log::debug!("🎤 Sent audio chunk to OpenAI");
        }

        Ok(())
    }

    /// Commit the audio buffer and request response
    pub async fn commit_audio(&self) -> Result<(), RealtimeError> {
        if !*self.is_connected.lock().await {
            return Err(RealtimeError::Connection("Not connected to OpenAI".to_string()));
        }

        if let Some(ref client_arc) = self.client {
            let mut client = client_arc.lock().await;
            
            // Commit audio buffer
            let commit = ClientEvent::InputAudioBufferCommit;
            client.send_event(commit).await
                .map_err(|e| RealtimeError::Protocol(format!("Failed to commit audio: {}", e)))?;

            // Request response
            let response_create = ClientEvent::ResponseCreate {
                response: openai_api_rs::realtime::response::ResponseConfig {
                    modalities: Some(vec!["text".to_string(), "audio".to_string()]),
                    instructions: None,
                    voice: Some("alloy".to_string()),
                    output_audio_format: Some("pcm16".to_string()),
                    tools: None,
                    tool_choice: None,
                    temperature: Some(0.8),
                    max_output_tokens: Some(4096),
                }
            };

            client.send_event(response_create).await
                .map_err(|e| RealtimeError::Protocol(format!("Failed to request response: {}", e)))?;

            info!("🎤 Committed audio buffer and requested response");
        }

        Ok(())
    }

    /// Interrupt the current response
    pub async fn interrupt(&self) -> Result<(), RealtimeError> {
        if !*self.is_connected.lock().await {
            return Err(RealtimeError::Connection("Not connected to OpenAI".to_string()));
        }

        if let Some(ref client_arc) = self.client {
            let mut client = client_arc.lock().await;
            
            let cancel = ClientEvent::ResponseCancel;
            client.send_event(cancel).await
                .map_err(|e| RealtimeError::Protocol(format!("Failed to interrupt: {}", e)))?;

            info!("⏹️ Interrupted OpenAI response");
        }

        Ok(())
    }

    /// Disconnect from OpenAI
    pub async fn disconnect(&mut self) -> Result<(), RealtimeError> {
        *self.is_connected.lock().await = false;
        self.session_id = None;
        self.client = None;
        
        log::info!("🔌 Disconnected from OpenAI Realtime API");
        Ok(())
    }

    /// Check if connected
    pub async fn is_connected(&self) -> bool {
        *self.is_connected.lock().await
    }

    /// Check if API key exists and service status
    pub async fn get_status(&self) -> Result<RealtimeStatus, RealtimeError> {
        // Check environment variable directly instead of cached api_key
        let api_key = std::env::var("OPENAI_API_KEY")
            .map_err(|_| RealtimeError::ApiKey("OPENAI_API_KEY not found in environment".to_string()))?;
        
        let connected = *self.is_connected.lock().await;
        
        Ok(RealtimeStatus {
            api_key: if api_key.is_empty() { 
                "❌ Missing".to_string() 
            } else { 
                "✅ Configured".to_string() 
            },
            connected,
            session_id: self.session_id.clone(),
        })
    }

    /// Convert ServerEvent to our OpenAIEvent
    fn convert_server_event(server_event: ServerEvent) -> Option<OpenAIEvent> {
        match server_event {
            ServerEvent::SessionCreated(_session_created) => {
                Some(OpenAIEvent::SessionCreated {
                    session: SessionInfo {
                        id: "session_created".to_string(),
                        model: "gpt-4o-realtime-preview-2024-10-01".to_string(),
                        modalities: vec!["text".to_string(), "audio".to_string()],
                        voice: "alloy".to_string(),
                    }
                })
            }
            ServerEvent::ResponseTextDelta(delta) => {
                Some(OpenAIEvent::ResponseTextDelta {
                    delta: delta.delta,
                })
            }
            ServerEvent::ResponseTextDone(done) => {
                Some(OpenAIEvent::ResponseTextDone {
                    text: done.text,
                })
            }
            ServerEvent::ResponseAudioDelta(delta) => {
                Some(OpenAIEvent::ResponseAudioDelta {
                    delta: delta.delta,
                })
            }
            ServerEvent::ResponseAudioDone(done) => {
                Some(OpenAIEvent::ResponseAudioDone {
                    item_id: done.item_id,
                })
            }
            ServerEvent::Error(error) => {
                Some(OpenAIEvent::Error {
                    error: ErrorInfo {
                        message: error.error.message,
                        r#type: error.error.r#type,
                        code: error.error.code,
                    }
                })
            }
            _ => None,
        }
    }
}
