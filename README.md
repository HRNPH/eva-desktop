# Eva-Desktop

cooking a very cute AI assistant to beat the shit out of Alexa, and your loneliness.

## 🎤 Porcupine Wake Word Detection - Simplified Setup!

✅ **Voice recognition system ready for testing - now with environment variable setup!**

- Real-time wake word detection using Porcupine
- Built-in test interface with "Hi Eva" keyword
- Simple environment variable configuration
- Ready to extend to custom "Hey EVA" wake word

**Quick Start:**

1. Get your free [Picovoice Access Key](https://console.picovoice.ai/)
2. `export PV_ACCESS_KEY="your_key_here"`
3. `pnpm install`
4. `./start-dev.sh` (or `pnpm tauri dev`)
5. Click "Porcupine Test" and start talking!

**Even Easier:**

```bash
# Set your key once
export PV_ACCESS_KEY="your_key_here"

# Use the convenience script
./start-dev.sh
```

## Plans

- [x] ✅ Implement voice recognition (Hey EVA) - **DONE: Porcupine integration ready!**
- [ ] Integration with Live2D Display? or Maybe VRM for 3D avatars, Maybe Both.
- [ ] Integration with OpenAI Realtime API (another project will ditch this and do local).
- [ ] MCP and tool calling for cooking with Home Assistant.

## Tech Stack

- **Frontend**: React 18.3+ with TypeScript
- **Backend**: Rust (Tauri 2.x)
- **Styling**: TailwindCSS 4.x
- **Audio**: Porcupine Wake Word Detection
- **Build Tool**: Vite 6.x
- **Package Manager**: pnpm

## Development

### Prerequisites

- Node.js 18+
- pnpm
- Rust (latest stable)
- Picovoice access key

### Usage

1. Start the development server with `./start-dev.sh`
2. Click "Porcupine Test" in the navigation
3. Click "Start Listening"
4. Say "Hi Eva" clearly into your microphone
5. Watch for wake word detection events

### Notes

- Currently uses "Hi Eva" as the test wake word
- For custom "Hey EVA" wake word, you'll need to train a custom model using Picovoice Console
- Requires microphone permissions
- Best performance with a good quality microphone and low background noise

## Building for Production

```bash
pnpm tauri build
```

# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
