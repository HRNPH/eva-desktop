use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use log::info;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RealtimeStatus {
    pub api_key: String,
    pub connected: bool,
    pub session_id: Option<String>,
}

#[derive(Clone)]
pub struct OpenAIRealtimeService {
    api_key: Option<String>,
    session_id: Option<String>,
    is_connected: Arc<Mutex<bool>>,
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

    /// Simplified connection placeholder for frontend integration
    pub async fn connect<R: tauri::Runtime>(&mut self, _app_handle: tauri::AppHandle<R>) -> Result<(), RealtimeError> {
        // Get API key from environment to validate it exists
        let api_key = std::env::var("OPENAI_API_KEY")
            .map_err(|_| RealtimeError::ApiKey("OPENAI_API_KEY not found".to_string()))?;

        if api_key.is_empty() {
            return Err(RealtimeError::ApiKey("API key is empty".to_string()));
        }

        self.api_key = Some(api_key.clone());
        *self.is_connected.lock().await = true;

        info!("✅ OpenAI API key validated - connection will be handled by frontend");
        Ok(())
    }

    /// Simplified placeholder methods - actual implementation moved to frontend
    pub async fn send_text(&self, text: &str) -> Result<(), RealtimeError> {
        info!("📤 Text will be sent via frontend: {}", text);
        Ok(())
    }

    pub async fn send_audio(&self, _audio_base64: &str) -> Result<(), RealtimeError> {
        log::debug!("🎤 Audio will be sent via frontend");
        Ok(())
    }

    pub async fn commit_audio(&self) -> Result<(), RealtimeError> {
        info!("🎤 Audio commit will be handled by frontend");
        Ok(())
    }

    pub async fn interrupt(&self) -> Result<(), RealtimeError> {
        info!("⏹️ Interrupt will be handled by frontend");
        Ok(())
    }

    /// Disconnect placeholder
    pub async fn disconnect(&mut self) -> Result<(), RealtimeError> {
        *self.is_connected.lock().await = false;
        self.session_id = None;
        
        log::info!("🔌 Disconnected - frontend will handle actual disconnect");
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
}
