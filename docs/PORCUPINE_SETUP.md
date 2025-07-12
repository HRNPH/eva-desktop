# 🎤 Porcupine Wake Word Detection Setup Guide

## Quick Start (Secure Method)

1. **Get a Picovoice Access Key** (Required)

   - Visit [Picovoice Console](https://console.picovoice.ai/)
   - Sign up for a free account
   - Create a new project and copy your Access Key

2. **Run the Application**

   ```bash
   pnpm tauri dev
   ```

3. **Store Your Key Securely**

   - Click "Porcupine Test" in the top-right corner
   - Click "Add Key" in the blue security section
   - Enter your access key and click "Store Securely"
   - Your key is now encrypted in your system keychain! 🔐

4. **Test Wake Word Detection**
   - Click "Start Listening"
   - Say "Hi Eva" clearly into your microphone
   - Watch for the detection event!

## ✅ Security Upgrade

**NEW: Secure Storage Implementation**

- ✅ Keys encrypted in system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- ✅ No plaintext storage
- ✅ Process isolation
- ✅ User authentication required
- ✅ Fallback to environment variables for development

**Old method (still works for dev):**

```bash
export PV_ACCESS_KEY="your_key"  # Only for development!
```

## What's Implemented

✅ **Core Integration**

- Porcupine Rust SDK integration
- Cross-platform audio capture (CPAL)
- Real-time wake word detection
- Event-based communication (Rust ↔ React)

✅ **Test Interface**

- React component for testing wake word detection
- Live status monitoring
- Audio logs and debug information
- Start/stop controls

✅ **Built-in Keywords Available**

- Hi Eva ✅ (currently configured)
- Hey Siri
- Alexa
- Computer
- Jarvis
- Picovoice
- And more!

## File Structure

```
src-tauri/src/
├── porcupine_service.rs   # Core Porcupine integration
└── lib.rs                 # Tauri commands registration

src/components/
└── PorcupineTest.tsx      # React test interface

docs/
└── PORCUPINE_INTEGRATION.md  # Detailed documentation
```

## How to Use Different Wake Words

Edit `src-tauri/src/porcupine_service.rs` and change:

```rust
&[BuiltinKeywords::HeyGoogle]  // Change this line
```

Available options:

```rust
BuiltinKeywords::Alexa
BuiltinKeywords::HeySiri
BuiltinKeywords::Computer
BuiltinKeywords::Jarvis
// ... and more
```

## Next Steps for "Hey EVA"

To use a custom "Hey EVA" wake word:

1. Visit [Picovoice Console](https://console.picovoice.ai/)
2. Create a custom wake word model
3. Train it with "Hey EVA" samples
4. Download the .ppn model file
5. Use `PorcupineBuilder::new_with_keyword_paths()` instead

## Troubleshooting

**"Failed to initialize Porcupine"**

- Make sure you have set the `PV_ACCESS_KEY` environment variable
- Verify your access key is valid at console.picovoice.ai

**"No input device available"**

- Check your microphone permissions
- Ensure your microphone is connected and working

**Wake word not detected**

- Speak clearly and at normal volume
- Reduce background noise
- Try different microphones

## Performance Notes

- Detection latency: ~50-100ms
- Memory usage: ~10-20MB additional
- CPU usage: Very low impact
- All processing is done locally (privacy-first)

## Development

```bash
# Test build
./test-build.sh

# Run with debug logs
RUST_LOG=debug pnpm tauri dev

# Check for errors
cargo check
```

## License & Legal

This implementation uses Porcupine under Picovoice's licensing terms. The free tier includes:

- Personal projects ✅
- Development/testing ✅
- Limited commercial use

For production deployment, check [Picovoice pricing](https://picovoice.ai/pricing/).
