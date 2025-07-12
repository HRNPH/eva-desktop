# Wake Word Detection Troubleshooting Guide

## Current Issues and Solutions

### Issue: Wake word only triggered once out of 100 attempts

This is a common issue with Porcupine wake word detection. Here are the steps to diagnose and fix:

## Step 1: Enable Audio Debug Logging

Set the environment variable before starting:

```bash
export EVA_DEBUG_AUDIO=1
npm run tauri dev
```

This will:

- Save processed audio to `debug_audio/processed_audio_<timestamp>.wav`
- Show audio level statistics in logs
- Help identify if audio is being captured properly

## Step 2: Check Audio Levels

Use the new audio level test command to verify microphone input:

```bash
# In the app console or through UI
test_audio_levels()
```

This will run a 10-second audio test showing:

- Current audio levels
- Maximum level detected
- Total samples processed

**Expected results:**

- Audio levels should be > 0.01 when speaking
- Max levels should reach 0.1-0.8 during normal speech
- If levels are too low (< 0.001), increase microphone volume

## Step 3: Verify Wake Word

**Important: You're currently using the built-in "Porcupine" wake word, NOT "Hi Eva"**

Try saying:

- **"Porcupine"** (this is the current wake word)
- Speak clearly and at normal volume
- Try different pronunciations: "POR-cu-pine", "Por-CU-pine"

## Step 4: Check Sensitivity Settings

The code now uses higher sensitivity (0.8) which should be more responsive. If still not working:

1. **Increase sensitivity further** (edit `porcupine_service.rs`):

   ```rust
   .sensitivities(&[0.9f32]) // Even higher sensitivity
   ```

2. **Check for custom model**: If you have `models/Hi-Eva.ppn`, it will use that instead

## Step 5: Audio Quality Checks

1. **Open debug WAV files** in Audacity or similar
2. **Verify audio characteristics**:
   - Sample rate should be exactly 16kHz
   - Should be mono (single channel)
   - Audio should be clear and audible
   - No clipping or distortion

## Step 6: Environment Checks

1. **Microphone permissions**: Ensure app has microphone access
2. **Background noise**: Test in quiet environment
3. **Microphone distance**: Speak within 1-2 feet of microphone
4. **System audio settings**: Check macOS sound input levels

## Step 7: Log Analysis

Look for these log messages:

### Good signs:

```
✅ Access key loaded from [source]
Using built-in wake word: Porcupine
🎤 Wake word detection started
🎵 Frame 50: Max amplitude: 1234, Avg: 234.5
```

### Warning signs:

```
🎵 Frame 50: Max amplitude: 12, Avg: 2.3  // Audio too quiet
Failed to get device name  // Microphone issues
Porcupine processing error  // Configuration issues
```

## Step 8: Testing Different Keywords

If "Porcupine" doesn't work well, try other built-in keywords:

```rust
// In porcupine_service.rs, try different keywords:
PorcupineBuilder::new_with_keywords(&access_key, &[BuiltinKeywords::Alexa])
PorcupineBuilder::new_with_keywords(&access_key, &[BuiltinKeywords::Computer])
PorcupineBuilder::new_with_keywords(&access_key, &[BuiltinKeywords::Jarvis])
```

Available built-in keywords:

- Alexa
- Americano
- Blueberry
- Bumblebee
- Computer
- Grapefruit
- Grasshopper
- Hey Google
- Hey Siri
- Jarvis
- Ok Google
- Picovoice
- Porcupine
- Terminator

## Step 9: Custom Model Testing

If you have a custom "Hi Eva" model (`models/Hi-Eva.ppn`):

1. **Verify file exists and is valid**
2. **Test with original training phrases**
3. **Check model was trained for your voice/accent**

## Step 10: Hardware-Specific Issues

### macOS Issues:

- Check System Preferences > Security & Privacy > Microphone
- Try different microphone (built-in vs external)
- Test with different sample rates

### Common Solutions:

1. **Restart the application** after making changes
2. **Clear any cached audio settings**
3. **Test with headset microphone** vs built-in
4. **Reduce background noise**

## Advanced Debugging

### Enable Verbose Logging:

```bash
export RUST_LOG=debug
export EVA_DEBUG_AUDIO=1
npm run tauri dev
```

### Test Audio Pipeline:

1. Record yourself saying "Porcupine" with system audio recorder
2. Compare with the debug WAV files
3. Verify they sound similar

### Monitor System Resources:

- High CPU usage can affect real-time processing
- Check for other apps using microphone

## Expected Behavior After Fixes:

- Wake word should trigger within 2-3 attempts
- Audio levels should be visible in logs every ~1.6 seconds
- Debug WAV files should contain clear audio
- Detection should be consistent (not just once)

## Quick Test Commands:

```bash
# Test microphone access
test_microphone()

# Test audio levels for 10 seconds
test_audio_levels()

# Start wake word detection with debug
export EVA_DEBUG_AUDIO=1
start_wake_word()

# Check logs for audio statistics
# Say "Porcupine" clearly 5-10 times
```

If none of these steps work, the issue might be:

1. **Invalid Porcupine access key**
2. **Microphone hardware problem**
3. **System-level audio routing issues**
4. **Sample rate conversion problems**
