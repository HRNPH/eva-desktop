use crate::openai_realtime::OpenAIRealtimeService;
use cpal::traits::{HostTrait, DeviceTrait, StreamTrait};
use cpal::{Device, StreamConfig, SupportedStreamConfig, SampleFormat, InputCallbackInfo};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use base64::{Engine as _, engine::general_purpose};
use tokio::sync::mpsc;

const OPENAI_SAMPLE_RATE: u32 = 24000; // OpenAI Realtime API expects 24kHz
const BUFFER_SIZE: usize = 1024; // Audio buffer size in samples

#[derive(Debug)]
pub struct AudioCaptureService {
    is_recording: Arc<AtomicBool>,
    audio_sender: Option<mpsc::UnboundedSender<Vec<i16>>>,
}

#[derive(Debug)]
pub enum AudioCaptureError {
    NoInputDevice,
    DeviceConfigError(String),
    StreamBuildError(String),
    StreamPlayError(String),
    OpenAIError(String),
}

impl std::fmt::Display for AudioCaptureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AudioCaptureError::NoInputDevice => write!(f, "No input device available"),
            AudioCaptureError::DeviceConfigError(e) => write!(f, "Device config error: {}", e),
            AudioCaptureError::StreamBuildError(e) => write!(f, "Stream build error: {}", e),
            AudioCaptureError::StreamPlayError(e) => write!(f, "Stream play error: {}", e),
            AudioCaptureError::OpenAIError(e) => write!(f, "OpenAI error: {}", e),
        }
    }
}

impl std::error::Error for AudioCaptureError {}

impl AudioCaptureService {
    pub fn new() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            audio_sender: None,
        }
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::Relaxed)
    }

    pub async fn start_capture(&mut self, openai_service: Arc<tokio::sync::Mutex<OpenAIRealtimeService>>) -> Result<(), AudioCaptureError> {
        if self.is_recording() {
            log::warn!("Audio capture is already running");
            return Ok(());
        }

        log::info!("Starting audio capture for OpenAI");

        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or(AudioCaptureError::NoInputDevice)?;

        let config = device
            .default_input_config()
            .map_err(|e| AudioCaptureError::DeviceConfigError(e.to_string()))?;

        let is_recording = self.is_recording.clone();
        
        log::info!("Audio config: {:?}", config);

        // Create channel for audio data
        let (audio_tx, mut audio_rx) = mpsc::unbounded_channel::<Vec<i16>>();
        self.audio_sender = Some(audio_tx.clone());

        // Set recording flag
        is_recording.store(true, Ordering::Relaxed);

        // Start audio processing task
        let openai_clone = openai_service.clone();
        let audio_buffer = Arc::new(Mutex::new(Vec::new()));
        tokio::spawn(async move {
            while let Some(samples) = audio_rx.recv().await {
                Self::process_audio_chunk(samples, audio_buffer.clone(), openai_clone.clone()).await;
            }
        });

        // Start the actual capture in a background task
        let device_name = device.name().unwrap_or_else(|_| "Unknown Device".to_string());
        log::info!("Using audio device: {}", device_name);

        let is_recording_clone = is_recording.clone();
        
        tokio::spawn(async move {
            if let Err(e) = Self::run_capture_stream(device, config, audio_tx, is_recording_clone).await {
                log::error!("Audio capture stream error: {}", e);
            }
        });

        Ok(())
    }

    async fn run_capture_stream(
        device: Device,
        config: SupportedStreamConfig,
        audio_tx: mpsc::UnboundedSender<Vec<i16>>,
        is_recording: Arc<AtomicBool>,
    ) -> Result<(), AudioCaptureError> {
        let sample_rate = config.sample_rate().0;
        let channels = config.channels();
        
        log::info!("Audio stream config - Sample rate: {}, Channels: {}", sample_rate, channels);

        // Use spawn_blocking to handle the stream in a blocking context
        let is_recording_clone = is_recording.clone();
        tokio::task::spawn_blocking(move || {
            let stream = match config.sample_format() {
                SampleFormat::F32 => Self::build_stream_f32(
                    device,
                    config.into(),
                    audio_tx.clone(),
                    is_recording.clone(),
                ),
                SampleFormat::I16 => Self::build_stream_i16(
                    device,
                    config.into(),
                    audio_tx.clone(),
                    is_recording.clone(),
                ),
                SampleFormat::U16 => Self::build_stream_u16(
                    device,
                    config.into(),
                    audio_tx.clone(),
                    is_recording.clone(),
                ),
                format => {
                    log::error!("Unsupported sample format: {:?}", format);
                    return;
                }
            };

            let stream = match stream {
                Ok(stream) => stream,
                Err(e) => {
                    log::error!("Failed to build stream: {}", e);
                    return;
                }
            };

            if let Err(e) = stream.play() {
                log::error!("Failed to start stream: {}", e);
                return;
            }

            log::info!("Audio capture stream started successfully");

            // Keep the stream alive while recording (blocking)
            while is_recording_clone.load(Ordering::Relaxed) {
                std::thread::sleep(std::time::Duration::from_millis(100));
            }

            log::info!("Audio capture stream stopped");
        }).await.map_err(|e| AudioCaptureError::StreamBuildError(format!("Task failed: {}", e)))?;

        Ok(())
    }

    fn build_stream_f32(
        device: Device,
        config: StreamConfig,
        audio_tx: mpsc::UnboundedSender<Vec<i16>>,
        is_recording: Arc<AtomicBool>,
    ) -> Result<cpal::Stream, AudioCaptureError> {
        let sample_rate = config.sample_rate.0;
        let channels = config.channels as usize;

        device
            .build_input_stream(
                &config,
                move |data: &[f32], _: &InputCallbackInfo| {
                    if !is_recording.load(Ordering::Relaxed) {
                        return;
                    }

                    // Convert f32 to i16 for OpenAI
                    let converted_samples: Vec<i16> = if channels == 1 {
                        // Mono audio
                        data.iter()
                            .map(|&sample| (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
                            .collect()
                    } else {
                        // Multi-channel audio - take only the first channel
                        data.chunks(channels)
                            .map(|chunk| (chunk[0].clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
                            .collect()
                    };

                    // Resample if needed
                    let resampled = Self::resample_audio(&converted_samples, sample_rate, OPENAI_SAMPLE_RATE);

                    // Send to channel for async processing
                    if let Err(e) = audio_tx.send(resampled) {
                        log::error!("Failed to send audio data to channel: {}", e);
                    }
                },
                |err| log::error!("Audio stream error: {}", err),
                None,
            )
            .map_err(|e| AudioCaptureError::StreamBuildError(e.to_string()))
    }

    fn build_stream_i16(
        device: Device,
        config: StreamConfig,
        audio_tx: mpsc::UnboundedSender<Vec<i16>>,
        is_recording: Arc<AtomicBool>,
    ) -> Result<cpal::Stream, AudioCaptureError> {
        let sample_rate = config.sample_rate.0;
        let channels = config.channels as usize;

        device
            .build_input_stream(
                &config,
                move |data: &[i16], _: &InputCallbackInfo| {
                    if !is_recording.load(Ordering::Relaxed) {
                        return;
                    }

                    let converted_samples: Vec<i16> = if channels == 1 {
                        // Mono audio
                        data.to_vec()
                    } else {
                        // Multi-channel audio - take only the first channel
                        data.chunks(channels).map(|chunk| chunk[0]).collect()
                    };

                    // Resample if needed
                    let resampled = Self::resample_audio(&converted_samples, sample_rate, OPENAI_SAMPLE_RATE);

                    // Send to channel for async processing
                    if let Err(e) = audio_tx.send(resampled) {
                        log::error!("Failed to send audio data to channel: {}", e);
                    }
                },
                |err| log::error!("Audio stream error: {}", err),
                None,
            )
            .map_err(|e| AudioCaptureError::StreamBuildError(e.to_string()))
    }

    fn build_stream_u16(
        device: Device,
        config: StreamConfig,
        audio_tx: mpsc::UnboundedSender<Vec<i16>>,
        is_recording: Arc<AtomicBool>,
    ) -> Result<cpal::Stream, AudioCaptureError> {
        let sample_rate = config.sample_rate.0;
        let channels = config.channels as usize;

        device
            .build_input_stream(
                &config,
                move |data: &[u16], _: &InputCallbackInfo| {
                    if !is_recording.load(Ordering::Relaxed) {
                        return;
                    }

                    let converted_samples: Vec<i16> = if channels == 1 {
                        // Mono audio - convert u16 to i16
                        data.iter()
                            .map(|&sample| (sample as i32 - 32768) as i16)
                            .collect()
                    } else {
                        // Multi-channel audio - take only the first channel and convert
                        data.chunks(channels)
                            .map(|chunk| (chunk[0] as i32 - 32768) as i16)
                            .collect()
                    };

                    // Resample if needed
                    let resampled = Self::resample_audio(&converted_samples, sample_rate, OPENAI_SAMPLE_RATE);

                    // Send to channel for async processing
                    if let Err(e) = audio_tx.send(resampled) {
                        log::error!("Failed to send audio data to channel: {}", e);
                    }
                },
                |err| log::error!("Audio stream error: {}", err),
                None,
            )
            .map_err(|e| AudioCaptureError::StreamBuildError(e.to_string()))
    }

    async fn process_audio_chunk(
        samples: Vec<i16>,
        audio_buffer: Arc<Mutex<Vec<i16>>>,
        openai_service: Arc<tokio::sync::Mutex<OpenAIRealtimeService>>,
    ) {
        // Add samples to buffer
        {
            let mut buffer = audio_buffer.lock().await;
            buffer.extend_from_slice(&samples);

            // Limit buffer size to prevent memory growth
            if buffer.len() > OPENAI_SAMPLE_RATE as usize * 10 {
                // Keep last 5 seconds
                let keep_samples = OPENAI_SAMPLE_RATE as usize * 5;
                let drain_count = buffer.len() - keep_samples;
                buffer.drain(0..drain_count);
            }
        }

        // Send audio chunk to OpenAI if we have enough samples
        if samples.len() >= BUFFER_SIZE {
            let audio_data = Self::encode_audio_chunk(&samples);
            let openai_guard = openai_service.lock().await;
            if let Err(e) = openai_guard.send_audio(&audio_data).await {
                log::error!("Failed to send audio to OpenAI: {}", e);
            }
        }
    }

    fn resample_audio(input: &[i16], input_rate: u32, output_rate: u32) -> Vec<i16> {
        if input_rate == output_rate {
            return input.to_vec();
        }

        let ratio = input_rate as f64 / output_rate as f64;
        let output_len = (input.len() as f64 / ratio) as usize;
        let mut output = Vec::with_capacity(output_len);

        for i in 0..output_len {
            let src_index = (i as f64 * ratio) as usize;
            if src_index < input.len() {
                // Simple linear interpolation
                if src_index + 1 < input.len() {
                    let frac = (i as f64 * ratio) - src_index as f64;
                    let sample1 = input[src_index] as f64;
                    let sample2 = input[src_index + 1] as f64;
                    let interpolated = sample1 + (sample2 - sample1) * frac;
                    output.push(interpolated as i16);
                } else {
                    output.push(input[src_index]);
                }
            }
        }

        output
    }

    fn encode_audio_chunk(samples: &[i16]) -> String {
        let bytes: Vec<u8> = samples
            .iter()
            .flat_map(|&sample| sample.to_le_bytes())
            .collect();
        general_purpose::STANDARD.encode(&bytes)
    }

    pub async fn stop_capture(&mut self) -> Result<(), AudioCaptureError> {
        if !self.is_recording() {
            log::warn!("Audio capture is not running");
            return Ok(());
        }

        log::info!("Stopping audio capture");
        self.is_recording.store(false, Ordering::Relaxed);

        // Close the channel sender to stop the processing task
        self.audio_sender = None;

        // Give the stream time to stop gracefully
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        log::info!("Audio capture stopped successfully");
        Ok(())
    }
}