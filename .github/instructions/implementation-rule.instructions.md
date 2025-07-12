# Eva-Desktop Implementation Rules & Instructions

## Project Overview
Eva-Desktop is an AI assistant desktop application built with Tauri + React + TypeScript, designed to be "a very cute AI assistant to beat the shit out of Alexa, and your loneliness."

## Core Technology Stack
- **Frontend**: React 18.3+ with TypeScript
- **Backend**: Rust (Tauri 2.x)
- **Styling**: TailwindCSS 4.x
- **Build Tool**: Vite 6.x
- **Package Manager**: pnpm (preferred based on lock file)

## Implementation Priorities

### Phase 1: Foundation
- [ ] Voice recognition system ("Hey EVA" wake word)
- [ ] Basic UI/UX for AI assistant interaction
- [ ] Core Tauri-React communication layer

### Phase 2: Visual Avatar
- [ ] Live2D Display integration for 2D avatars
- [ ] VRM support for 3D avatars
- [ ] Avatar animation system tied to voice/responses

### Phase 3: AI Integration
- [ ] OpenAI Realtime API integration
- [ ] Local AI model support (future-proofing)
- [ ] Natural language processing pipeline

### Phase 4: Smart Home Integration
- [ ] MCP (Model Context Protocol) implementation
- [ ] Tool calling system for Home Assistant
- [ ] Device control and automation features

## Development Guidelines

### Code Organization
```
src/
├── components/          # React components
│   ├── avatar/         # Avatar-related components (Live2D/VRM)
│   ├── voice/          # Voice recognition components
│   └── ui/             # General UI components
├── hooks/              # Custom React hooks
├── services/           # API and external service integrations
├── utils/              # Utility functions
└── types/              # TypeScript type definitions

src-tauri/src/
├── commands/           # Tauri commands
├── services/           # Rust services (audio, AI, etc.)
└── utils/              # Rust utilities
```

### Coding Standards

#### TypeScript/React
- Use functional components with hooks
- Implement proper TypeScript typing (no `any` types)
- Use TailwindCSS for styling (utility-first approach)
- Follow React best practices for state management
- Implement proper error boundaries

#### Rust/Tauri
- Follow Rust idioms and best practices
- Use proper error handling with `Result<T, E>`
- Implement async operations where appropriate
- Use Tauri's command system for frontend-backend communication
- Add comprehensive documentation for public APIs

### Performance Requirements
- **Voice Recognition**: < 100ms wake word detection
- **Avatar Response**: < 200ms animation start after voice input
- **AI Response**: Target < 2s for typical queries
- **Memory Usage**: Keep under 500MB for base functionality

### Security Considerations
- Sanitize all external API inputs
- Implement proper permission handling for system access
- Secure storage for API keys and sensitive data
- Audio data privacy (local processing preferred)

### UI/UX Guidelines
- **Personality**: Cute, friendly, and approachable
- **Theme**: Modern, clean interface with subtle animations
- **Accessibility**: Support keyboard navigation and screen readers
- **Responsiveness**: Adaptive to different window sizes
- **Dark/Light Mode**: Support both themes

### Testing Strategy
- Unit tests for utility functions and services
- Integration tests for Tauri commands
- E2E tests for critical user flows
- Performance benchmarks for voice and AI features

### Dependencies Management
- Prefer stable, well-maintained libraries
- Keep dependencies minimal and justified
- Regular security audits of npm/cargo dependencies
- Document rationale for major dependency choices

### Git Workflow
- Feature branches for all new functionality
- Descriptive commit messages following conventional commits
- PR reviews required for main branch
- Semantic versioning for releases

### Documentation Requirements
- API documentation for all Tauri commands
- Component documentation with usage examples
- Setup and development instructions
- User guide for end-users

## Architecture Decisions

### Voice Processing
- Use local wake word detection for privacy
- Stream audio to AI service only after wake word
- Implement voice activity detection

### Avatar System
- Support both 2D (Live2D) and 3D (VRM) avatars
- Modular avatar system for easy switching
- Emotion/expression mapping to AI responses

### AI Integration
- Abstract AI provider interface for flexibility
- Support multiple AI backends (OpenAI, local models)
- Implement conversation context management

### Home Automation
- Use MCP for standardized tool calling
- Plugin architecture for different smart home platforms
- Secure device authentication and control

## Quality Gates
- All code must pass TypeScript compilation
- Rust code must pass `cargo clippy` with no warnings
- All PRs must include relevant tests
- Performance benchmarks must not regress
- Security scan must pass before release

## Future Considerations
- Cross-platform deployment (Windows, macOS, Linux)
- Plugin system for community extensions
- Multi-language support
- Cloud sync for settings and preferences
- Mobile companion app integration

## Portability Considerations
- Ensure this will work on MacOS, and Linux
- Use platform-agnostic libraries where possible
- Test on all target platforms during development
- Document any platform-specific quirks or requirements