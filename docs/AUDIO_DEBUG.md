# Audio Debug Logging

This document explains how to use the audio debug logging feature to capture and analyze processed audio chunks from the wake word detection system.

## Overview

The wake word detection system now includes optional audio logging functionality that saves processed audio chunks to WAV files for debugging purposes. This is particularly useful for:

- Verifying that audio resampling is working correctly (16kHz output)
- Analyzing audio quality and levels
- Debugging why wake words might not be detected
- Understanding the audio processing pipeline

## How to Enable Audio Logging

Set the environment variable `EVA_DEBUG_AUDIO` to any value before starting the application:

```bash
# macOS/Linux
export EVA_DEBUG_AUDIO=1
```

```bash
# Windows (Command Prompt)
set EVA_DEBUG_AUDIO=1
```

```bash
# Windows (PowerShell)
$env:EVA_DEBUG_AUDIO=1
```

## Running with Audio Debug

Once the environment variable is set, start the application normally:

```bash
# From the project root
npm run tauri dev
```

Or if running the Rust backend directly:

```bash
# From src-tauri directory
cargo run
```

## What Gets Logged

When audio debug mode is enabled:

1. **Debug Directory**: A `debug_audio` folder is created in the project root
2. **WAV Files**: Processed audio chunks are saved as `processed_audio_<timestamp>.wav`
3. **Audio Specs**:
   - Sample Rate: 16kHz (resampled from device rate)
   - Channels: 1 (mono)
   - Bit Depth: 16-bit
   - Format: PCM WAV

## Log Output

You'll see additional log messages when debug mode is active:

```
🎵 Debug mode enabled - saving processed audio to: debug_audio/processed_audio_1704981234.wav
🎵 Processed 100 audio frames, each with 512 samples
🎵 Processed 200 audio frames, each with 512 samples
...
🎵 Debug audio file saved successfully (1234 frames processed)
```

## Analyzing the Audio Files

The generated WAV files can be opened in any audio editing software:

### Recommended Tools

- **Audacity** (Free, cross-platform)
- **Logic Pro** (macOS)
- **Pro Tools**
- **Reaper**

### What to Look For

1. **Sample Rate**: Verify it's exactly 16kHz
2. **Audio Levels**: Should be normalized (not clipping, not too quiet)
3. **Quality**: Check for artifacts from resampling
4. **Content**: Verify your voice/audio is being captured clearly

### Expected Characteristics

- **Frame Size**: Each processing chunk is 512 samples (32ms at 16kHz)
- **Continuous**: Audio should be continuous without gaps
- **Mono**: Single channel audio
- **Quality**: Should sound clear and intelligible

## Performance Impact

Audio debug logging has minimal performance impact:

- Small memory overhead for buffering
- Disk I/O only when frames are processed
- No impact on real-time audio processing

## File Management

Debug files are created with timestamps and will accumulate over time. Consider:

- Periodically cleaning the `debug_audio` folder
- Each session creates a new file
- File size depends on recording duration (about 2MB per minute)

## Troubleshooting

### No Debug Files Created

- Verify `EVA_DEBUG_AUDIO` environment variable is set
- Check application logs for debug initialization messages
- Ensure write permissions to project directory

### Audio Quality Issues

- Check input device sample rate in logs
- Verify resampling messages appear
- Compare original device rate vs 16kHz output

### Large File Sizes

- Files grow continuously during recording
- Stop wake word detection to finalize files
- Consider recording duration when debugging

## Example Workflow

1. Set environment variable: `export EVA_DEBUG_AUDIO=1`
2. Start application: `npm run tauri dev`
3. Start wake word detection through UI
4. Speak test words/phrases
5. Stop wake word detection
6. Check `debug_audio/` folder for WAV files
7. Open in audio editor to analyze
8. Adjust sensitivity or troubleshoot based on findings

## Integration with Wake Word Detection

The audio logging captures the exact same audio frames that are sent to the Porcupine wake word engine:

- Post-resampling (16kHz)
- Post-normalization
- Mono channel (left channel if stereo input)
- 512-sample frames (32ms chunks)

This ensures you're debugging the exact audio that the wake word detector processes.
