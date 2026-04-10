# Project Handoff: Borg Orchestrator

**Date:** January 2026
**Status:** Production Ready

## 📋 Current State

Borg Orchestrator is a fully-featured multi-model AI council system for autonomous development guidance. Multiple AI supervisors debate and vote on code changes through a democratic process.

### Architecture
```
packages/
├── server/     # Hono + Bun backend API (port 3847)
├── cli/        # Ink (React) terminal UI dashboard
└── shared/     # TypeScript types
public/
└── index.html  # Web dashboard
```

### Completed Features

1. **Multi-Model Council**: 7 LLM providers (GPT-4, Claude, Gemini, DeepSeek, Grok, Qwen, Kimi)
2. **8 Consensus Modes**: simple-majority, supermajority, unanimous, weighted, ceo-override, ceo-veto, hybrid-ceo-majority, ranked-choice
3. **CLI Tool Detection**: Auto-detect opencode, claude, aider, cursor, continue, cody, copilot
4. **Session Health Monitoring**: Automatic health checks with auto-recovery
5. **Session Templates**: Pre-configured templates (default, review, debug, feature)
6. **Tag Management**: Organize sessions with tags
7. **Environment Variables**: Per-session and global env var management
8. **Log Rotation**: Automatic log pruning by count and age
9. **Hook System**: Webhook integration for debate/guidance flow
10. **Smart Pilot**: Auto-continue when council approves
11. **Web Dashboard**: Real-time WebSocket updates, dark theme UI
12. **TUI Dashboard**: Ink-based terminal interface
13. **Session Persistence**: Auto-save and restore on restart

## 🛠️ How to Run

```bash
# 1. Install dependencies
bun install

# 2. Set at least one API key
export OPENAI_API_KEY="sk-..."

# 3. Build shared types
cd packages/shared && bun run build

# 4. Start the server
cd packages/server && bun run dev

# 5. (Optional) Start CLI dashboard in another terminal
cd packages/cli && bun run dev
```

Access the web dashboard at: `http://localhost:3847`

## 🔧 Configuration

### Environment Variables
```bash
# Supervisor API Keys (auto-registers supervisors)
OPENAI_API_KEY          # GPT-4o
ANTHROPIC_API_KEY       # Claude
DEEPSEEK_API_KEY        # DeepSeek
GEMINI_API_KEY          # Gemini
GROK_API_KEY            # Grok (or XAI_API_KEY)
QWEN_API_KEY            # Qwen
KIMI_API_KEY            # Kimi (or MOONSHOT_API_KEY)

# Server Config
AUTOPILOT_PORT=3847
AUTOPILOT_HOST=0.0.0.0
AUTOPILOT_BASE_PORT=4096
AUTOPILOT_DEBATE_ROUNDS=2
AUTOPILOT_CONSENSUS=0.7
AUTOPILOT_SMART_PILOT=false
```

### Config File
Create `.autopilot/config.json` for persistent configuration.

## 🧪 Testing

```bash
# Unit tests
cd packages/server && bun test src/services/__tests__/

# Integration tests (requires running server)
cd packages/server && bun test src/__tests__/

# E2E test
bun run scripts/test-e2e.ts
```

## 📝 Key Files

| File | Purpose |
|------|---------|
| `packages/server/src/index.ts` | Server entry point |
| `packages/server/src/services/session-manager.ts` | Session lifecycle management |
| `packages/server/src/services/council.ts` | Debate orchestration |
| `packages/server/src/routes/*.ts` | API route handlers |
| `packages/cli/src/app.tsx` | TUI dashboard entry |
| `public/index.html` | Web dashboard |

## 🚀 Future Improvements

See `VISION.md` for planned features:
- Dynamic Supervisor Selection (task-based team selection)
- Human-in-the-Loop Veto (developer as Council Chair)
- Plugin Ecosystem (standardized supervisor interface)

## 📚 Documentation

- `README.md` - Quick start and API reference
- `ARCHITECTURE.md` - Technical architecture details
- `ROADMAP.md` - Development phases and features
- `CHANGELOG.md` - Version history
- `VISION.md` - Future direction

## Go Port Initiation (2026-03-21)
- Initialized `go-port` directory and Go module.
- Ported the foundational type definitions (`shared/types.ts` and `shared/swarm-types.ts`) to `go-port/pkg/shared/types.go`.
- Ensured Go type definitions compile successfully.
- Version incremented to 1.0.15. Documentation (`ROADMAP.md`, `CHANGELOG.md`, `IDEAS.md`) updated.
- **Future Implementation Steps:** Implement the core `Supervisor` interfaces and provider implementations in `go-port/pkg/server/supervisors`, followed by standing up the Hono-equivalent backend routing framework in Go (likely using `gin`, `fiber`, or `chi`). Submodule integration should be carefully managed as autonomous packages that the central Go binary utilizes.
