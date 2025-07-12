use serde::{Deserialize, Serialize};

/// Event payload for wake word detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WakeWordEvent {
    pub keyword: String,
    pub confidence: f32,
    pub timestamp: u64,
}

impl WakeWordEvent {
    pub fn new(keyword: String, confidence: f32) -> Self {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        
        Self {
            keyword,
            confidence,
            timestamp,
        }
    }
}

/// Wake word detection errors
#[derive(Debug)]
pub enum WakeWordError {
    PorcupineInit(String),
    AudioDevice(String),
    AccessKey(String),
    Resampling(String),
    AlreadyListening,
    NotListening,
}

impl std::fmt::Display for WakeWordError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WakeWordError::PorcupineInit(msg) => write!(f, "Porcupine initialization failed: {}", msg),
            WakeWordError::AudioDevice(msg) => write!(f, "Audio device error: {}", msg),
            WakeWordError::AccessKey(msg) => write!(f, "Access key error: {}", msg),
            WakeWordError::Resampling(msg) => write!(f, "Resampling error: {}", msg),
            WakeWordError::AlreadyListening => write!(f, "Already listening"),
            WakeWordError::NotListening => write!(f, "Not listening"),
        }
    }
}

impl std::error::Error for WakeWordError {}
