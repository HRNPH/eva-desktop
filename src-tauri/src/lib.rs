// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::sync::Arc;
use cpal::traits::{HostTrait, DeviceTrait, StreamTrait};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use cpal::SampleFormat;

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
    log::info!("Starting audio level test");

    let host = cpal::default_host();
    let device = host.default_input_device()
        .ok_or("No input device available")?;

    let config = device.default_input_config()
        .map_err(|e| format!("Failed to get input config: {}", e))?;

    log::info!("Using audio config: {:?}", config);

    let max_level = Arc::new(AtomicU32::new(0));
    let max_level_clone = max_level.clone();
    let sample_count = Arc::new(AtomicU64::new(0));
    let sample_count_clone = sample_count.clone();
    let is_running = Arc::new(AtomicBool::new(true));
    let is_running_clone = is_running.clone();
    let start_time = std::time::Instant::now();

    // Spawn the audio recording in a blocking task to avoid Send issues
    let config_clone = config.clone();
    let device_clone = device.clone();
    let task_handle = tokio::task::spawn_blocking(move || {
        let stream = match config_clone.sample_format() {
            SampleFormat::F32 => {
                device_clone.build_input_stream(
                    &config_clone.into(),
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        let level = data.iter().map(|&s| s.abs()).fold(0.0f32, f32::max);
                        let level_u32 = (level * 1000.0) as u32;
                        
                        loop {
                            let current = max_level_clone.load(Ordering::Relaxed);
                            if level_u32 <= current || max_level_clone.compare_exchange_weak(current, level_u32, Ordering::Relaxed, Ordering::Relaxed).is_ok() {
                                break;
                            }
                        }
                        
                        sample_count_clone.fetch_add(data.len() as u64, Ordering::Relaxed);
                        
                        if start_time.elapsed().as_secs() >= 10 {
                            is_running_clone.store(false, Ordering::Relaxed);
                        }
                    },
                    |err| log::error!("Audio stream error: {}", err),
                    None,
                )
            }
            SampleFormat::I16 => {
                device_clone.build_input_stream(
                    &config_clone.into(),
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        let level = data.iter().map(|&s| (s as f32 / 32768.0).abs()).fold(0.0f32, f32::max);
                        let level_u32 = (level * 1000.0) as u32;
                        
                        loop {
                            let current = max_level_clone.load(Ordering::Relaxed);
                            if level_u32 <= current || max_level_clone.compare_exchange_weak(current, level_u32, Ordering::Relaxed, Ordering::Relaxed).is_ok() {
                                break;
                            }
                        }
                        
                        sample_count_clone.fetch_add(data.len() as u64, Ordering::Relaxed);
                        
                        if start_time.elapsed().as_secs() >= 10 {
                            is_running_clone.store(false, Ordering::Relaxed);
                        }
                    },
                    |err| log::error!("Audio stream error: {}", err),
                    None,
                )
            }
            SampleFormat::U16 => {
                device_clone.build_input_stream(
                    &config_clone.into(),
                    move |data: &[u16], _: &cpal::InputCallbackInfo| {
                        let level = data.iter().map(|&s| ((s as f32 - 32768.0) / 32768.0).abs()).fold(0.0f32, f32::max);
                        let level_u32 = (level * 1000.0) as u32;
                        
                        loop {
                            let current = max_level_clone.load(Ordering::Relaxed);
                            if level_u32 <= current || max_level_clone.compare_exchange_weak(current, level_u32, Ordering::Relaxed, Ordering::Relaxed).is_ok() {
                                break;
                            }
                        }
                        
                        sample_count_clone.fetch_add(data.len() as u64, Ordering::Relaxed);
                        
                        if start_time.elapsed().as_secs() >= 10 {
                            is_running_clone.store(false, Ordering::Relaxed);
                        }
                    },
                    |err| log::error!("Audio stream error: {}", err),
                    None,
                )
            }
            format => return Err(format!("Unsupported sample format: {:?}", format)),
        };

        let stream = match stream {
            Ok(stream) => stream,
            Err(e) => return Err(format!("Failed to create audio stream: {}", e)),
        };

        if let Err(e) = stream.play() {
            return Err(format!("Failed to start audio stream: {}", e));
        }

        // Wait for 10 seconds (blocking)
        std::thread::sleep(std::time::Duration::from_secs(10));
        
        Ok(())
    });

    // Wait for the task to complete
    task_handle.await.map_err(|e| format!("Task failed: {}", e))??;

    let duration = start_time.elapsed().as_secs_f32();
    let final_sample_count = sample_count.load(Ordering::Relaxed);
    let avg_samples_per_sec = final_sample_count as f32 / duration;

    log::info!("Audio test completed - Max level: {:.3}, Samples: {}, Duration: {:.1}s", 
               max_level.load(Ordering::Relaxed) as f32 / 1000.0, final_sample_count, duration);

    Ok(format!(
        "Audio test completed:\n• Duration: {:.1} seconds\n• Max level: {:.3}\n• Total samples: {}\n• Avg samples/sec: {:.0}",
        duration,
        max_level.load(Ordering::Relaxed) as f32 / 1000.0,
        final_sample_count,
        avg_samples_per_sec
    ))
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

// OpenAI Realtime API Commands - REMOVED
// Note: OpenAI integration has been moved to the React frontend
// These commands are no longer needed as the frontend handles OpenAI directly

// Integration Commands - Wake Word Only

#[tauri::command]
async fn start_eva_listening(
    porcupine_state: tauri::State<'_, Arc<tokio::sync::Mutex<PorcupineService>>>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    log::info!("Starting Eva wake word listening mode");
    
    // Start wake word detection
    let porcupine_service = porcupine_state.inner().clone();
    let mut porcupine_guard = porcupine_service.lock().await;
    
    match porcupine_guard.start_listening(app).await {
        Ok(_) => {
            log::info!("Eva wake word listening started successfully");
            Ok("Eva is now listening for wake words! Say 'Hi Eva' to trigger.".to_string())
        }
        Err(e) => {
            log::error!("Failed to start Eva listening mode: {}", e);
            Err(format!("Failed to start Eva listening mode: {}", e))
        }
    }
}

#[tauri::command]
async fn stop_eva_listening(
    porcupine_state: tauri::State<'_, Arc<tokio::sync::Mutex<PorcupineService>>>,
) -> Result<String, String> {
    log::info!("Stopping Eva wake word listening mode");
    
    // Stop wake word detection
    let porcupine_service = porcupine_state.inner().clone();
    let mut porcupine_guard = porcupine_service.lock().await;
    if let Err(e) = porcupine_guard.stop_listening().await {
        log::warn!("Failed to stop wake word detection: {}", e);
    }
    
    log::info!("Eva wake word listening mode stopped");
    Ok("Eva stopped listening for wake words.".to_string())
}

pub fn run() {
    // Initialize logging
    env_logger::init();
    
    log::info!("🎤 Eva Desktop - Wake word detection ready");
    
    tauri::Builder::default()
        .setup(|app| {
            // Initialize Porcupine service for wake word detection
            let porcupine_service = Arc::new(tokio::sync::Mutex::new(PorcupineService::new()));
            app.manage(porcupine_service);
            
            log::info!("Eva Desktop initialized successfully - wake word detection ready");
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
            get_current_wake_word,
            start_eva_listening,
            stop_eva_listening
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
