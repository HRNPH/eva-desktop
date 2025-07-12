use crate::wake_word::{WakeWordEvent, WakeWordError};
use anyhow::Result;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, StreamConfig};
use porcupine::{BuiltinKeywords, Porcupine, PorcupineBuilder};
use rubato::{Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use hound::{WavWriter, WavSpec};
use std::fs;
use keyring;

const PORCUPINE_SAMPLE_RATE: u32 = 16000;
const PORCUPINE_FRAME_LENGTH: usize = 512;

// Thread-safe service that doesn't hold non-Send types
pub struct PorcupineService {
    is_listening: Arc<AtomicBool>,
    access_key: Option<String>,
    stop_sender: Option<tokio::sync::oneshot::Sender<()>>,
}

impl PorcupineService {
    pub fn new() -> Self {
        Self {
            is_listening: Arc::new(AtomicBool::new(false)),
            access_key: None,
            stop_sender: None,
        }
    }

    /// Create debug directory for audio files
    fn ensure_debug_directory() -> Result<String, WakeWordError> {
        let debug_dir = "debug_audio";
        if !Path::new(debug_dir).exists() {
            fs::create_dir_all(debug_dir)
                .map_err(|e| WakeWordError::AudioDevice(format!("Failed to create debug directory: {}", e)))?;
        }
        Ok(debug_dir.to_string())
    }

    /// Create a WAV writer for debugging audio chunks
    fn create_debug_wav_writer(filename: &str) -> Result<WavWriter<std::io::BufWriter<std::fs::File>>, WakeWordError> {
        let spec = WavSpec {
            channels: 1,
            sample_rate: PORCUPINE_SAMPLE_RATE,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        
        WavWriter::create(filename, spec)
            .map_err(|e| WakeWordError::AudioDevice(format!("Failed to create WAV writer: {}", e)))
    }

    /// Initialize Porcupine with access key - now returns the instance instead of storing it
    async fn create_porcupine(&mut self) -> Result<Porcupine, WakeWordError> {
        let access_key = self.get_access_key().await?;
        
        // Check for custom wake word model first
        let custom_model_path = "models/Hi-Eva.ppn";
        
        let porcupine = if Path::new(custom_model_path).exists() {
            log::info!("Using custom wake word model: {}", custom_model_path);
            PorcupineBuilder::new_with_keyword_paths(&access_key, &[custom_model_path])
                .sensitivities(&[1.0f32]) // MAXIMUM sensitivity for custom model
                .init()
                .map_err(|e| WakeWordError::PorcupineInit(e.to_string()))?
        } else {
            // Try different keywords - you can change this to test different ones
            let keyword = if std::env::var("WAKE_WORD_KEYWORD").is_ok() {
                // Allow environment variable to override
                match std::env::var("WAKE_WORD_KEYWORD").unwrap().as_str() {
                    "alexa" => BuiltinKeywords::Alexa,
                    "computer" => BuiltinKeywords::Computer,
                    "jarvis" => BuiltinKeywords::Jarvis,
                    "hey-google" => BuiltinKeywords::HeyGoogle,
                    "ok-google" => BuiltinKeywords::OkGoogle,
                    "picovoice" => BuiltinKeywords::Picovoice,
                    _ => BuiltinKeywords::Porcupine, // Default fallback
                }
            } else {
                BuiltinKeywords::Computer // Try "Computer" instead of "Porcupine" - might be easier to pronounce
            };
            
            let keyword_name = match keyword {
                BuiltinKeywords::Alexa => "Alexa",
                BuiltinKeywords::Computer => "Computer", 
                BuiltinKeywords::Jarvis => "Jarvis",
                BuiltinKeywords::HeyGoogle => "Hey Google",
                BuiltinKeywords::OkGoogle => "Ok Google", 
                BuiltinKeywords::Picovoice => "Picovoice",
                _ => "Porcupine",
            };
            
            log::info!("Using built-in wake word: {} (instead of Hi Eva)", keyword_name);
            log::info!("⚠️  SAY '{}' TO TRIGGER WAKE WORD", keyword_name.to_uppercase());
            log::info!("🔊 Using MAXIMUM sensitivity (1.0) for better detection");
            
            PorcupineBuilder::new_with_keywords(&access_key, &[keyword])
                .sensitivities(&[1.0f32]) // MAXIMUM sensitivity - should be very responsive but may have false positives
                .init()
                .map_err(|e| WakeWordError::PorcupineInit(e.to_string()))?
        };

        log::info!("Porcupine initialized successfully");
        log::info!("Expected sample rate: {} Hz", porcupine.sample_rate());
        log::info!("Expected frame length: {} samples", porcupine.frame_length());
        
        Ok(porcupine)
    }

    /// Get access key from keychain or environment variable
    async fn get_access_key(&mut self) -> Result<String, WakeWordError> {
        if let Some(ref key) = self.access_key {
            return Ok(key.clone());
        }

        // Try to get from secure keychain first
        if let Ok(key) = self.get_key_from_keychain() {
            log::info!("✅ Access key loaded from secure keychain");
            self.access_key = Some(key.clone());
            return Ok(key);
        }

        // Fall back to environment variable
        if let Ok(key) = std::env::var("PV_ACCESS_KEY") {
            log::info!("✅ Access key loaded from environment variable");
            // Store in keychain for future use
            if let Err(e) = self.store_key_in_keychain(&key) {
                log::warn!("Failed to store key in keychain: {}", e);
            }
            self.access_key = Some(key.clone());
            return Ok(key);
        }

        Err(WakeWordError::AccessKey(
            "No access key found. Please set PV_ACCESS_KEY environment variable or store in keychain".to_string()
        ))
    }

    /// Store access key in system keychain
    fn store_key_in_keychain(&self, key: &str) -> Result<(), WakeWordError> {
        let entry = keyring::Entry::new("eva-desktop", "picovoice-access-key")
            .map_err(|e| WakeWordError::AccessKey(format!("Failed to create keychain entry: {}", e)))?;
        
        entry.set_password(key)
            .map_err(|e| WakeWordError::AccessKey(format!("Failed to store key in keychain: {}", e)))?;
        
        log::info!("🔐 Access key stored securely in system keychain");
        Ok(())
    }

    /// Get access key from system keychain
    fn get_key_from_keychain(&self) -> Result<String, WakeWordError> {
        let entry = keyring::Entry::new("eva-desktop", "picovoice-access-key")
            .map_err(|e| WakeWordError::AccessKey(format!("Failed to create keychain entry: {}", e)))?;
        
        entry.get_password()
            .map_err(|e| WakeWordError::AccessKey(format!("Failed to get key from keychain: {}", e)))
    }

    /// Start listening for wake words
    pub async fn start_listening(&mut self, app_handle: AppHandle) -> Result<(), WakeWordError> {
        if self.is_listening.load(Ordering::Relaxed) {
            return Err(WakeWordError::AlreadyListening);
        }

        // Create Porcupine instance
        let porcupine = self.create_porcupine().await?;
        
        // Set up the audio processing task
        let (stop_tx, stop_rx) = tokio::sync::oneshot::channel();
        self.stop_sender = Some(stop_tx);
        
        let is_listening = self.is_listening.clone();
        is_listening.store(true, Ordering::Relaxed);
        
        // Spawn the audio processing task in a blocking thread
        tokio::task::spawn_blocking(move || {
            // Use a blocking runtime for the audio processing
            Self::run_audio_processing_blocking(porcupine, app_handle, is_listening.clone(), stop_rx)
        });
        
        log::info!("🎤 Wake word detection started - listening for wake words");
        Ok(())
    }

    /// Main audio processing loop that runs in a blocking thread
    fn run_audio_processing_blocking(
        porcupine: Porcupine,
        app_handle: AppHandle,
        is_listening: Arc<AtomicBool>,
        stop_rx: tokio::sync::oneshot::Receiver<()>,
    ) -> Result<(), WakeWordError> {
        // Get audio device with enhanced debugging
        let host = cpal::default_host();
        log::info!("🎙️  Audio host: {:?}", host.id());
        
        // List all input devices for debugging
        if let Ok(devices) = host.input_devices() {
            log::info!("🎤 Available input devices:");
            for (i, device) in devices.enumerate() {
                if let Ok(name) = device.name() {
                    log::info!("  {}. {}", i + 1, name);
                    if let Ok(configs) = device.supported_input_configs() {
                        for config in configs {
                            log::info!("     - Sample rate: {}-{} Hz, Channels: {}, Format: {:?}", 
                                     config.min_sample_rate().0, 
                                     config.max_sample_rate().0,
                                     config.channels(),
                                     config.sample_format());
                        }
                    }
                }
            }
        }
        
        let device = host.default_input_device()
            .ok_or_else(|| {
                log::error!("❌ No input device available!");
                log::error!("💡 Possible solutions:");
                log::error!("   1. Check microphone permissions in macOS System Settings > Privacy & Security > Microphone");
                log::error!("   2. Make sure your microphone is connected and working");
                log::error!("   3. Try running: sudo killall coreaudiod (to restart audio service)");
                WakeWordError::AudioDevice("No input device available".to_string())
            })?;

        let device_name = device.name()
            .map_err(|e| WakeWordError::AudioDevice(format!("Failed to get device name: {}", e)))?;
        
        log::info!("✅ Using audio device: {}", device_name);

        // Get the default input config with better error handling
        let config = device.default_input_config()
            .map_err(|e| {
                log::error!("❌ Failed to get default input config: {}", e);
                log::error!("💡 This might be a permission issue - check macOS microphone permissions");
                WakeWordError::AudioDevice(format!("Failed to get default input config: {}", e))
            })?;

        log::info!("🔧 Device config - Sample rate: {} Hz, Channels: {}, Sample format: {:?}", 
                  config.sample_rate().0, config.channels(), config.sample_format());

        let input_sample_rate = config.sample_rate().0;
        let channels = config.channels() as usize;

        // Create resampler if needed
        let resampler = if input_sample_rate != PORCUPINE_SAMPLE_RATE {
            log::info!("🔄 Setting up resampler: {} Hz -> {} Hz", input_sample_rate, PORCUPINE_SAMPLE_RATE);
            
            let params = SincInterpolationParameters {
                sinc_len: 256,
                f_cutoff: 0.95,
                interpolation: SincInterpolationType::Linear,
                oversampling_factor: 256,
                window: WindowFunction::BlackmanHarris2,
            };

            Some(SincFixedIn::<f32>::new(
                PORCUPINE_SAMPLE_RATE as f64 / input_sample_rate as f64,
                2.0, // max_resample_ratio_relative
                params,
                PORCUPINE_FRAME_LENGTH,
                channels,
            ).map_err(|e| WakeWordError::Resampling(format!("Failed to create resampler: {}", e)))?)
        } else {
            log::info!("✅ No resampling needed - device already at 16kHz");
            None
        };

        // Create audio processing pipeline using std::sync instead of tokio
        let (tx, rx) = std::sync::mpsc::channel::<Vec<i16>>();
        
        // Set up debug audio logging if enabled
        let debug_enabled = std::env::var("EVA_DEBUG_AUDIO").is_ok();
        let mut debug_wav_writer = if debug_enabled {
            let debug_dir = Self::ensure_debug_directory()?;
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            let debug_filename = format!("{}/processed_audio_{}.wav", debug_dir, timestamp);
            log::info!("🎵 Debug mode enabled - saving processed audio to: {}", debug_filename);
            Some(Self::create_debug_wav_writer(&debug_filename)?)
        } else {
            None
        };
        
        // Create the audio stream based on sample format with enhanced error handling
        log::info!("🎵 Creating audio stream...");
        let stream = match config.sample_format() {
            SampleFormat::F32 => {
                log::info!("📊 Using F32 sample format");
                Self::create_audio_stream::<f32>(device, config.into(), resampler, tx, channels, is_listening.clone())?
            },
            SampleFormat::I16 => {
                log::info!("📊 Using I16 sample format");
                Self::create_audio_stream::<i16>(device, config.into(), resampler, tx, channels, is_listening.clone())?
            },
            SampleFormat::U16 => {
                log::info!("📊 Using U16 sample format");
                Self::create_audio_stream::<u16>(device, config.into(), resampler, tx, channels, is_listening.clone())?
            },
            _ => {
                log::error!("❌ Unsupported sample format: {:?}", config.sample_format());
                return Err(WakeWordError::AudioDevice("Unsupported sample format".to_string()));
            }
        };

        // Start the stream with better error handling
        log::info!("▶️  Starting audio stream...");
        stream.play().map_err(|e| {
            log::error!("❌ Failed to start audio stream: {}", e);
            log::error!("💡 This might be a permission issue - check macOS microphone permissions");
            WakeWordError::AudioDevice(format!("Failed to start audio stream: {}", e))
        })?;
        
        log::info!("✅ Audio stream started successfully!");

        // Process audio frames in a blocking manner
        let mut stop_rx = stop_rx;
        let mut frame_count = 0;
        let mut last_frame_time = std::time::Instant::now();
        let mut last_detection_time = std::time::Instant::now() - std::time::Duration::from_secs(10); // Initialize to allow first detection
        let cooldown_duration = std::time::Duration::from_secs(2);
        log::info!("🎧 Starting audio processing loop...");
        
        loop {
            // Check if we should stop (non-blocking)
            if let Ok(_) = stop_rx.try_recv() {
                log::info!("🔇 Stopping wake word detection");
                break;
            }

            // Check for audio frames with a timeout
            match rx.recv_timeout(std::time::Duration::from_millis(100)) {
                Ok(audio_frame) => {
                    frame_count += 1;
                    last_frame_time = std::time::Instant::now();
                    
                    // Calculate audio statistics for debugging
                    let max_amplitude = audio_frame.iter().map(|&x| x.abs()).max().unwrap_or(0);
                    let avg_amplitude = audio_frame.iter().map(|&x| x.abs() as f32).sum::<f32>() / audio_frame.len() as f32;
                    
                    // Save audio frame to debug file if enabled
                    if let Some(ref mut writer) = debug_wav_writer {
                        for &sample in &audio_frame {
                            if let Err(e) = writer.write_sample(sample) {
                                log::error!("Failed to write debug audio sample: {}", e);
                                break;
                            }
                        }
                        
                        // Log progress every 10 frames (about every 320ms at 16kHz) with audio stats
                        if frame_count % 10 == 0 {
                            log::info!("🎵 Frame {}: {} samples, Max: {}, Avg: {:.1}", 
                                     frame_count, audio_frame.len(), max_amplitude, avg_amplitude);
                        }
                    } else if frame_count % 10 == 0 {
                        // Log even without debug mode for audio level monitoring (every 320ms)
                        log::info!("🎵 Frame {}: Max amplitude: {}, Avg: {:.1}", frame_count, max_amplitude, avg_amplitude);
                    }
                    
                    match porcupine.process(&audio_frame) {
                        Ok(keyword_index) => {
                            // Log processing results more frequently for debugging
                            if frame_count % 50 == 0 {
                                log::info!("🔍 Frame {}: Processing result = {}, Max amplitude: {}, Avg: {:.1}", 
                                         frame_count, keyword_index, max_amplitude, avg_amplitude);
                                log::info!("🎧 Audio processing continues normally - listening for wake words...");
                            }
                            
                            if keyword_index >= 0 {
                                // Check cooldown period to prevent rapid re-triggers
                                let time_since_last_detection = last_detection_time.elapsed();
                                if time_since_last_detection < cooldown_duration {
                                    if frame_count % 50 == 0 { // Log occasionally during cooldown
                                        log::info!("🔄 Wake word detected but in cooldown period ({:.1}s remaining)", 
                                                 (cooldown_duration - time_since_last_detection).as_secs_f32());
                                    }
                                    continue; // Skip this detection but keep processing
                                }
                                
                                last_detection_time = std::time::Instant::now();
                                log::info!("🎉 WAKE WORD DETECTED! Keyword index: {} (at frame {})", keyword_index, frame_count);
                                log::info!("🔊 Audio stats when detected - Max: {}, Avg: {:.1}", max_amplitude, avg_amplitude);
                                
                                let wake_word = if Path::new("models/Hi-Eva.ppn").exists() {
                                    "Hi Eva".to_string() // Custom model
                                } else {
                                    // Determine which built-in keyword was used
                                    if std::env::var("WAKE_WORD_KEYWORD").is_ok() {
                                        match std::env::var("WAKE_WORD_KEYWORD").unwrap().as_str() {
                                            "alexa" => "Alexa".to_string(),
                                            "computer" => "Computer".to_string(),
                                            "jarvis" => "Jarvis".to_string(),
                                            "hey-google" => "Hey Google".to_string(),
                                            "ok-google" => "Ok Google".to_string(),
                                            "picovoice" => "Picovoice".to_string(),
                                            _ => "Porcupine".to_string(),
                                        }
                                    } else {
                                        "Computer".to_string() // Default to Computer
                                    }
                                };
                                
                                let event = WakeWordEvent::new(
                                    wake_word,
                                    1.0, // Porcupine doesn't provide confidence scores
                                );
                                
                                if let Err(e) = app_handle.emit("wake-word-detected", &event) {
                                    log::error!("Failed to emit wake word event: {}", e);
                                } else {
                                    log::info!("✅ Wake word event emitted successfully");
                                    log::info!("⏸️  Next detection available in {:.1}s", cooldown_duration.as_secs_f32());
                                }
                            } else if max_amplitude > 500 {
                                // Log when we have audio but no detection
                                log::info!("🎤 Audio detected (Max: {}) but no wake word at frame {}", max_amplitude, frame_count);
                            }
                        }
                        Err(e) => {
                            log::error!("Porcupine processing error at frame {}: {}", frame_count, e);
                        }
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // Check if we haven't received audio for too long
                    if last_frame_time.elapsed() > std::time::Duration::from_secs(5) && frame_count == 0 {
                        log::warn!("⚠️  No audio frames received for 5 seconds!");
                        log::warn!("💡 Possible issues:");
                        log::warn!("   1. Microphone permission not granted");
                        log::warn!("   2. Audio device not working properly");
                        log::warn!("   3. Audio stream creation failed silently");
                        log::warn!("🔧 Try: System Settings > Privacy & Security > Microphone > Enable for this app");
                    }
                    // Timeout - continue loop to check stop signal
                    continue;
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    log::warn!("Audio processing channel disconnected");
                    // Channel closed
                    break;
                }
            }
        }

        // Finalize debug WAV file if it was being written
        if let Some(writer) = debug_wav_writer {
            if let Err(e) = writer.finalize() {
                log::error!("Failed to finalize debug WAV file: {}", e);
            } else {
                log::info!("🎵 Debug audio file saved successfully ({} frames processed)", frame_count);
            }
        }

        drop(stream); // Explicitly drop the stream
        is_listening.store(false, Ordering::Relaxed);
        Ok(())
    }

    /// Create audio stream for specific sample type with resampling
    fn create_audio_stream<T>(
        device: Device,
        config: StreamConfig,
        mut resampler: Option<SincFixedIn<f32>>,
        tx: std::sync::mpsc::Sender<Vec<i16>>,
        channels: usize,
        is_listening: Arc<AtomicBool>,
    ) -> Result<cpal::Stream, WakeWordError>
    where
        T: cpal::Sample + cpal::SizedSample + Send + 'static,
        f32: cpal::FromSample<T>,
    {
        let mut audio_buffer = Vec::<f32>::new();
        let mut callback_count = 0;
        let mut total_samples_received = 0;

        let stream = device.build_input_stream(
            &config,
            move |data: &[T], _: &cpal::InputCallbackInfo| {
                callback_count += 1;
                total_samples_received += data.len();
                
                // Log first few callbacks for debugging
                if callback_count <= 5 {
                    log::info!("🎤 Audio callback #{}: {} samples received", callback_count, data.len());
                }
                
                if !is_listening.load(Ordering::Relaxed) {
                    return;
                }

                // Convert samples to f32
                let samples: Vec<f32> = data.iter().map(|&s| cpal::Sample::to_sample(s)).collect();
                
                // Calculate input level for debugging (reduced logging)
                let max_input = samples.iter().map(|&x| x.abs()).fold(0.0f32, f32::max);
                if callback_count <= 3 || callback_count % 500 == 0 {
                    log::info!("📊 Callback #{}: {} samples, max level: {:.6}, total received: {}", 
                             callback_count, data.len(), max_input, total_samples_received);
                }
                
                // Convert to mono if stereo (take left channel)
                let mono_samples: Vec<f32> = if channels == 2 {
                    samples.chunks(2).map(|chunk| chunk[0]).collect()
                } else {
                    samples
                };

                // Apply resampling if needed
                let resampled_samples = if let Some(ref mut rs) = resampler {
                    // Prepare input for resampler (single channel)
                    let input = vec![mono_samples];
                    
                    match rs.process(&input, None) {
                        Ok(output) => output[0].clone(),
                        Err(e) => {
                            log::error!("Resampling error: {}", e);
                            return;
                        }
                    }
                } else {
                    mono_samples
                };

                // Add to buffer
                audio_buffer.extend(resampled_samples);

                // Process complete frames
                while audio_buffer.len() >= PORCUPINE_FRAME_LENGTH {
                    // Convert to i16 (Porcupine expects 16-bit PCM)
                    let frame: Vec<i16> = audio_buffer
                        .drain(..PORCUPINE_FRAME_LENGTH)
                        .map(|sample| (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
                        .collect();

                    // Calculate frame level for debugging
                    let frame_max = frame.iter().map(|&x| x.abs()).max().unwrap_or(0);
                    if callback_count <= 10 {
                        log::info!("🔊 Sending frame with {} samples, max amplitude: {}", frame.len(), frame_max);
                    }

                    // Send frame for processing
                    if let Err(_) = tx.send(frame) {
                        log::error!("Failed to send audio frame for processing");
                        return;
                    }
                }
            },
            |err| {
                log::error!("❌ Audio stream error: {}", err);
                log::error!("💡 This might indicate a permission or hardware issue");
            },
            None,
        ).map_err(|e| {
            log::error!("❌ Failed to build input stream: {}", e);
            log::error!("💡 Check microphone permissions and device availability");
            WakeWordError::AudioDevice(format!("Failed to build input stream: {}", e))
        })?;

        Ok(stream)
    }

    /// Stop listening for wake words
    pub async fn stop_listening(&mut self) -> Result<(), WakeWordError> {
        if !self.is_listening.load(Ordering::Relaxed) {
            return Err(WakeWordError::NotListening);
        }

        self.is_listening.store(false, Ordering::Relaxed);
        
        // Send stop signal to the audio processing task
        if let Some(stop_sender) = self.stop_sender.take() {
            let _ = stop_sender.send(()); // Ignore send errors (task might have already stopped)
        }

        log::info!("🔇 Wake word detection stopped");
        Ok(())
    }

    /// Check if currently listening
    pub fn is_listening(&self) -> bool {
        self.is_listening.load(Ordering::Relaxed)
    }
}

impl Drop for PorcupineService {
    fn drop(&mut self) {
        self.is_listening.store(false, Ordering::Relaxed);
        if let Some(stop_sender) = self.stop_sender.take() {
            let _ = stop_sender.send(());
        }
    }
}
