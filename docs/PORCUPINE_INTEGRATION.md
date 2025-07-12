# Porcupine Wake Word Detection Integration

This document describes the Porcupine integration for Eva-Desktop's wake word detection functionality.

## Overview

Porcupine is Picovoice's wake word detection engine that enables real-time, on-device wake word detection. This implementation provides the foundation for Eva's "Hey EVA" wake word functionality.

## Features

- ✅ Real-time wake word detection using Porcupine Rust SDK
- ✅ Local audio processing (privacy-focused)
- ✅ Cross-platform audio input via CPAL
- ✅ React frontend for testing and monitoring
- ✅ Event-based communication between Rust backend and React frontend
- ✅ Configurable wake words (currently using "Hi Eva" for testing)

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Microphone    │───▶│  CPAL Audio     │───▶│   Porcupine     │
│     Input       │    │   Capture       │    │    Engine       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  React Frontend │◀───│ Tauri Commands  │◀───│  Wake Word      │
│   (UI + Events) │    │   & Events      │    │   Detection     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Installation

The Porcupine integration is already included in the project dependencies:

```toml
# src-tauri/Cargo.toml
[dependencies]
pv_porcupine = "3.0.3"  # Porcupine Rust SDK
cpal = "0.15"           # Cross-platform audio
tokio = { version = "1.0", features = ["full"] }
anyhow = "1.0"          # Error handling
```

## Usage

### Running the Test Interface

1. Start the development server:

   ```bash
   pnpm tauri dev
   ```

2. Click "Porcupine Test" in the top-right navigation

3. Click "Start Listening" to begin wake word detection

4. Say "Hi Eva" clearly into your microphone

5. Watch for the wake word detection event in the interface

### Programmatic Usage

```rust
use crate::porcupine_service::PorcupineService;

// Initialize the service
let mut service = PorcupineService::new();
service.initialize()?;

// Start listening with a callback
service.start_listening(|event| {
    println!("Wake word detected: {}", event.keyword);
})?;

// Stop listening
service.stop_listening()?;
```

### Frontend Integration

```typescript
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// Start wake word detection
await invoke("start_wake_word_detection");

// Listen for wake word events
const unlisten = await listen("wake-word-detected", (event) => {
  console.log("Wake word detected:", event.payload);
});
```

## Configuration

### Changing Wake Words

Currently configured for "Hi Eva" (built-in keyword). To use custom wake words like "Hey EVA":

1. Visit [Picovoice Console](https://console.picovoice.ai/)
2. Create a custom wake word model for "Hey EVA"
3. Download the model file (.ppn)
4. Update the Porcupine initialization:

```rust
let porcupine = PorcupineBuilder::new_with_keyword_paths(&["path/to/hi-eva.ppn"])
    .init()?;
```

### Audio Configuration

The service automatically configures audio settings to match Porcupine requirements:

- Sample rate: 16 kHz (Porcupine default)
- Channels: Mono (1 channel)
- Sample format: 16-bit PCM (converted from f32)
- Frame length: 512 samples (Porcupine default)

## API Reference

### Tauri Commands

#### `start_wake_word_detection()`

Starts the wake word detection service.

**Returns:** `Result<String, String>`

#### `stop_wake_word_detection()`

Stops the wake word detection service.

**Returns:** `Result<String, String>`

#### `get_wake_word_status()`

Gets the current status of wake word detection.

**Returns:** `Result<bool, String>`

### Events

#### `wake-word-detected`

Emitted when a wake word is detected.

**Payload:**

```typescript
interface WakeWordEvent {
  keyword: string; // The detected keyword
  confidence: number; // Confidence score (always 1.0 for Porcupine)
  timestamp: number; // Unix timestamp in milliseconds
}
```

## Testing

### Manual Testing

1. Run the test script:

   ```bash
   ./test-build.sh
   ```

2. Use the built-in test interface:
   - Navigate to the Porcupine Test page
   - Start listening
   - Speak the wake word
   - Verify detection in logs

### Performance Metrics

Target performance (as per project requirements):

- Wake word detection: < 100ms
- Memory usage: Minimal overhead
- CPU usage: Low impact on system

## Troubleshooting

### Common Issues

1. **No microphone access:**

   - Ensure microphone permissions are granted
   - Check system audio settings

2. **Audio device not found:**

   - Verify default input device is available
   - Try different audio devices

3. **Wake word not detected:**

   - Speak clearly and at normal volume
   - Reduce background noise
   - Ensure correct pronunciation of "Hi Eva"

4. **Build errors:**
   - Ensure all dependencies are installed
   - Check Rust toolchain version
   - Verify audio system dependencies on Linux

### Debug Mode

Enable debug logging by setting environment variable:

```bash
RUST_LOG=debug pnpm tauri dev
```

## Future Enhancements

- [ ] Custom "Hey EVA" wake word model
- [ ] Multiple wake word support
- [ ] Sensitivity adjustment
- [ ] Voice activity detection integration
- [ ] Background noise suppression
- [ ] Performance monitoring and metrics

## Dependencies

### Rust Crates

- `pv_porcupine`: Core wake word detection engine
- `cpal`: Cross-platform audio library
- `tokio`: Async runtime
- `anyhow`: Error handling

### System Requirements

- Microphone access
- Audio input device
- Sufficient CPU for real-time processing

## License

This integration uses Porcupine under Picovoice's license terms. See [Picovoice License](https://github.com/Picovoice/porcupine#license) for details.
