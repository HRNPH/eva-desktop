/// Audio configuration constants and types
use std::time::Duration;

// Audio processing constants
pub const PORCUPINE_SAMPLE_RATE: u32 = 16000;
pub const PORCUPINE_FRAME_LENGTH: usize = 512;

// Timing constants
pub const COOLDOWN_DURATION_SECS: u64 = 2;
pub const AUDIO_TIMEOUT_MS: u64 = 100;
pub const NO_AUDIO_WARNING_SECS: u64 = 5;

// Logging intervals
pub const FRAME_LOG_INTERVAL: usize = 50;
pub const AUDIO_LEVEL_LOG_INTERVAL: usize = 10;
pub const CALLBACK_LOG_INTERVAL: usize = 500;

// Audio thresholds
pub const AUDIO_DETECTION_THRESHOLD: i16 = 500;

// Debug paths
pub const DEBUG_AUDIO_DIR: &str = "debug_audio";
pub const MODEL_PATH: &str = "models/Hi-Eva.ppn";
pub const KEYCHAIN_SERVICE: &str = "eva-desktop";
pub const KEYCHAIN_ACCOUNT: &str = "picovoice-access-key";

// Environment variables
pub const ENV_ACCESS_KEY: &str = "PV_ACCESS_KEY";
pub const ENV_DEBUG_AUDIO: &str = "EVA_DEBUG_AUDIO";
pub const ENV_WAKE_WORD_KEYWORD: &str = "WAKE_WORD_KEYWORD";

/// Audio configuration structure
#[derive(Debug, Clone)]
pub struct AudioConfig {
    pub sample_rate: u32,
    pub frame_length: usize,
    pub cooldown_duration: Duration,
    pub audio_timeout: Duration,
    pub debug_enabled: bool,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            sample_rate: PORCUPINE_SAMPLE_RATE,
            frame_length: PORCUPINE_FRAME_LENGTH,
            cooldown_duration: Duration::from_secs(COOLDOWN_DURATION_SECS),
            audio_timeout: Duration::from_millis(AUDIO_TIMEOUT_MS),
            debug_enabled: std::env::var(ENV_DEBUG_AUDIO).is_ok(),
        }
    }
}

/// Supported wake word keywords
#[derive(Debug, Clone)]
pub enum WakeWordKeyword {
    HiEva,
    Alexa,
    Computer,
    Jarvis,
    HeyGoogle,
    OkGoogle,
    Picovoice,
    Porcupine,
}

impl WakeWordKeyword {
    pub fn from_env() -> Self {
        if std::path::Path::new(MODEL_PATH).exists() {
            return Self::HiEva;
        }

        match std::env::var(ENV_WAKE_WORD_KEYWORD).as_deref() {
            Ok("alexa") => Self::Alexa,
            Ok("computer") => Self::Computer,
            Ok("jarvis") => Self::Jarvis,
            Ok("hey-google") => Self::HeyGoogle,
            Ok("ok-google") => Self::OkGoogle,
            Ok("picovoice") => Self::Picovoice,
            Ok("porcupine") => Self::Porcupine,
            _ => Self::Computer, // Default
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::HiEva => "Hi Eva",
            Self::Alexa => "Alexa",
            Self::Computer => "Computer",
            Self::Jarvis => "Jarvis",
            Self::HeyGoogle => "Hey Google",
            Self::OkGoogle => "Ok Google",
            Self::Picovoice => "Picovoice",
            Self::Porcupine => "Porcupine",
        }
    }

    pub fn to_builtin(&self) -> Option<porcupine::BuiltinKeywords> {
        match self {
            Self::HiEva => None, // Custom model
            Self::Alexa => Some(porcupine::BuiltinKeywords::Alexa),
            Self::Computer => Some(porcupine::BuiltinKeywords::Computer),
            Self::Jarvis => Some(porcupine::BuiltinKeywords::Jarvis),
            Self::HeyGoogle => Some(porcupine::BuiltinKeywords::HeyGoogle),
            Self::OkGoogle => Some(porcupine::BuiltinKeywords::OkGoogle),
            Self::Picovoice => Some(porcupine::BuiltinKeywords::Picovoice),
            Self::Porcupine => Some(porcupine::BuiltinKeywords::Porcupine),
        }
    }
}
