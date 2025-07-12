// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::sync::Arc;
use cpal::traits::{HostTrait, DeviceTrait};
use std::path::Path;

mod porcupine_service;
mod wake_word;

use porcupine_service::PorcupineService;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
async fn start_wake_word(
    state: tauri::State<'_, Arc<tokio::sync::Mutex<PorcupineService>>>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    log::info!("Starting wake word detection");
    
    let service = state.inner().clone();
    let mut service_guard = service.lock().await;
    
    match service_guard.start_listening(app).await {
        Ok(_) => {
            log::info!("Wake word detection started successfully");
            Ok("Wake word detection started successfully".to_string())
        }
        Err(e) => {
            log::error!("Failed to start wake word detection: {}", e);
            Err(format!("Failed to start wake word detection: {}", e))
        }
    }
}

#[tauri::command]
async fn stop_wake_word(
    state: tauri::State<'_, Arc<tokio::sync::Mutex<PorcupineService>>>,
) -> Result<String, String> {
    log::info!("Stopping wake word detection");
    
    let service = state.inner().clone();
    let mut service_guard = service.lock().await;
    
    match service_guard.stop_listening().await {
        Ok(_) => {
            log::info!("Wake word detection stopped successfully");
            Ok("Wake word detection stopped successfully".to_string())
        }
        Err(e) => {
            log::error!("Failed to stop wake word detection: {}", e);
            Err(format!("Failed to stop wake word detection: {}", e))
        }
    }
}

#[tauri::command]
async fn wake_word_status(
    state: tauri::State<'_, Arc<tokio::sync::Mutex<PorcupineService>>>,
) -> Result<String, String> {
    let service = state.inner().clone();
    let service_guard = service.lock().await;
    
    let status = if service_guard.is_listening() {
        "Listening for wake words"
    } else {
        "Not listening"
    };
    
    Ok(status.to_string())
}

#[tauri::command]
async fn test_microphone() -> Result<String, String> {
    log::info!("Testing microphone access");
    
    match cpal::default_host().default_input_device() {
        Some(device) => {
            match device.name() {
                Ok(name) => {
                    log::info!("Default input device found: {}", name);
                    Ok(format!("Microphone accessible: {}", name))
                }
                Err(e) => {
                    log::error!("Failed to get device name: {}", e);
                    Err(format!("Failed to get device name: {}", e))
                }
            }
        }
        None => {
            log::error!("No input device available");
            Err("No input device available".to_string())
        }
    }
}

#[tauri::command]
async fn test_audio_levels() -> Result<String, String> {
    log::info!("Testing audio levels for 10 seconds");
    
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::time::{Duration, Instant};
    
    let host = cpal::default_host();
    let device = match host.default_input_device() {
        Some(device) => device,
        None => return Err("No input device available".to_string()),
    };
    
    let config = match device.default_input_config() {
        Ok(config) => config,
        Err(e) => return Err(format!("Failed to get device config: {}", e)),
    };
    
    log::info!("Audio test - Device: {:?}, Sample rate: {} Hz, Channels: {}", 
              device.name().unwrap_or("Unknown".to_string()), 
              config.sample_rate().0, 
              config.channels());
    
    let is_running = Arc::new(AtomicBool::new(true));
    let is_running_clone = is_running.clone();
    
    let start_time = Instant::now();
    let mut max_level = 0.0f32;
    let mut sample_count = 0u64;
    
    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => {
            device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if !is_running_clone.load(Ordering::Relaxed) {
                        return;
                    }
                    
                    let level = data.iter().map(|&s| s.abs()).fold(0.0f32, f32::max);
                    if level > max_level {
                        max_level = level;
                    }
                    sample_count += data.len() as u64;
                    
                    if sample_count % 48000 == 0 { // Log every ~1 second at 48kHz
                        log::info!("🎤 Audio level: {:.3} (max so far: {:.3})", level, max_level);
                    }
                },
                |err| log::error!("Audio stream error: {}", err),
                None,
            )
        }
        _ => return Err("Unsupported sample format for audio level test".to_string()),
    };
    
    let stream = match stream {
        Ok(stream) => stream,
        Err(e) => return Err(format!("Failed to create audio stream: {}", e)),
    };
    
    if let Err(e) = stream.play() {
        return Err(format!("Failed to start audio stream: {}", e));
    }
    
    // Test for 10 seconds
    std::thread::sleep(Duration::from_secs(10));
    is_running.store(false, Ordering::Relaxed);
    drop(stream);
    
    let duration = start_time.elapsed();
    let message = format!(
        "Audio test completed in {:.1}s. Max level: {:.3}, Total samples: {}", 
        duration.as_secs_f32(), max_level, sample_count
    );
    log::info!("{}", message);
    
    Ok(message)
}

#[tauri::command]
async fn get_current_wake_word() -> Result<String, String> {
    // Check for custom wake word model first
    let custom_model_path = "models/Hi-Eva.ppn";
    
    if Path::new(custom_model_path).exists() {
        Ok("Hi Eva".to_string())
    } else {
        // Determine which built-in keyword is being used
        let keyword_name = if std::env::var("WAKE_WORD_KEYWORD").is_ok() {
            match std::env::var("WAKE_WORD_KEYWORD").unwrap().as_str() {
                "alexa" => "Alexa",
                "computer" => "Computer",
                "jarvis" => "Jarvis",
                "hey-google" => "Hey Google",
                "ok-google" => "Ok Google",
                "picovoice" => "Picovoice",
                "porcupine" => "Porcupine",
                _ => "Computer", // Default fallback
            }
        } else {
            "Computer" // Default keyword
        };
        
        Ok(keyword_name.to_string())
    }
}

pub fn run() {
    // Initialize logging
    env_logger::init();
    
    log::info!("🎤 Eva Desktop - Porcupine Wake Word Detection Starting");
    
    tauri::Builder::default()
        .setup(|app| {
            // Initialize Porcupine service
            let porcupine_service = Arc::new(tokio::sync::Mutex::new(PorcupineService::new()));
            app.manage(porcupine_service);
            
            log::info!("Eva Desktop initialized successfully");
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            start_wake_word,
            stop_wake_word,
            wake_word_status,
            test_microphone,
            test_audio_levels,
            get_current_wake_word
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
