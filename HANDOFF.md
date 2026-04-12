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

## Go Port - Supervisor Modules (2026-03-21)
- Completed the port of `packages/server/src/supervisors/` logic to `go-port/pkg/server/supervisors/`.
- Created implementations for OpenAI-compatible supervisors (`OpenAISupervisor` in `openai.go`), Anthropic (`AnthropicSupervisor` in `anthropic.go`), and Mock logic (`MockSupervisor` in `mock.go`).
- Ported the exponential backoff retry mechanism into `retry.go`.
- Created a stub metrics package at `go-port/pkg/server/services/metrics` to support the logging capabilities embedded in the retry requests.
- Version incremented to 1.0.16.
- **Future Implementation Steps:** Begin porting the core debate logic via the `Council` implementation, and the HTTP server router itself.

## Go Port - Supervisor Council Module (2026-03-21)
- Completed the port of `packages/server/src/services/council.ts` to `go-port/pkg/server/services/council/`.
- Created robust modular Go implementations of the core `SupervisorCouncil` logic:
  - `council.go`: Struct definitions, initialization, basic getters/setters.
  - `helpers.go`: Formatting, regex vote parsing, reasoning generation.
  - `consensus_handlers.go`: Extracted all 8 robust voting protocols (Simple, Supermajority, CeoVeto, etc.).
  - `debate.go`: The core `Debate` loop, supporting multiple rounds, `ChatWithFallback`, and dynamic supervisor selection.
- Setup core stub implementations for cross-service dependencies in Go (`metrics`, `analytics`, `dynamic_selection`, `history`).
- Version incremented to 1.0.17.

## Go Port - Metrics Service (2026-03-21)
- Upgraded the stubbed `metrics.go` package into a fully-fledged metrics tracking module.
- Reimplemented `MetricsService` functionality tracking latency, HTTP requests, errors, and Supervisor calls directly from `packages/server/src/services/metrics.ts`.
- Added standard Go `sync.RWMutex` to ensure thread-safety across concurrent goroutines in the orchestrator pipeline.
- Implemented Prometheus metrics exposition format equivalent to the previous TypeScript version.
- Incremented version to 1.0.18.
- **Future Implementation Steps:** Implement the remaining services like `SmartPilot`, `QuotaManager`, and `EnvironmentManager`, then tie it all together with a Go-based HTTP server framework (e.g., Echo, Gin, or HttpServeMux) matching the existing `Hono` API.

## Go Port - Quota Manager Service (2026-03-21)
- Upgraded the stubbed `quota_manager.go` package into a fully-fledged quota tracking module.
- Reimplemented `QuotaManagerService` tracking concurrency limits, daily budgets, and RPM/RPH/TPM/TPD parameters ported from `packages/server/src/services/quota-manager.ts`.
- Included robust concurrent map access controls (`sync.RWMutex`) and a background ticker for garbage-collecting old request history metrics.
- Incremented version to 1.0.19.
- **Future Implementation Steps:** Following this logic, it is essential to implement `SessionManager` and `SmartPilot` logic in Go, mapping `sessions.ts` and `smart-pilot.ts` files, ensuring that CLI integrations map correctly to Go sub-processes.

## Go Port - Smart Pilot Service (2026-03-21)
- Extracted and ported `packages/server/src/services/smart-pilot.ts` to `go-port/pkg/server/services/smartpilot`.
- Separated logic into `smart_pilot.go` (state & config), `poll.go` (time Tickers, API fetching routines), and `execution.go` (task triggers, debate execution, and guidance evaluation).
- Set up crucial stub definitions in Go for `session.Service`, `hooks.AutoContinueHooks`, `ws.Service`, and `hierarchy.Service`.
- Replaced JS `setInterval` constructs with thread-safe `time.Ticker` inside dedicated goroutines.
- Unit tested logic converting CouncilDecisions into Guided directives safely determining when to `AUTO-APPROVE`.
- Bumped version to 1.0.20.
- **Future Implementation Steps:** Implement the `SessionManager` module to allow spawning terminal sidecars and communicating with `node-pty` implementations native to Go (e.g. `creack/pty`). Then we can start binding these standalone services into the final HTTP server router.

## Go Port - Session Manager (2026-03-21)
- Reimplemented the `SessionManagerService` core logic (`StartSession`, `GetActiveSessions`, etc.) in `go-port/pkg/server/services/session/session_manager.go`.
- Configured Go's native `os/exec` to spawn subprocesses in the background and capture `cmd.Process.Pid` in place of standard `node-pty` implementations, eliminating our issues with node-gyp and native bindings.
- Created basic stubs connecting to `ws_manager`, `cli_registry`, `health_monitor`, and `log_rotation` components to allow compilation.
- Bumped version to 1.0.21.
- **Future Implementation Steps:** Implement the detailed logging handlers, log rotation, and fully build the WebSocket server and `CLI Registry` natively in Go.

## Go Port - Log Rotation Service (2026-03-21)
- Reimplemented `LogRotationService` core logic (`AddLog`, `GetLogsWithPagination`, `PruneSessionLogs`) in `go-port/pkg/server/services/log/log_rotation.go`.
- Configured thread-safe map structures to hold per-session log instances ensuring data consistency when accessed simultaneously by different incoming requests or websockets.
- Added a background Goroutine via `time.Ticker` matching the TypeScript `setInterval` that loops through all instances pruning by chronological age and arbitrary threshold size.
- Bumped version to 1.0.22.
- **Future Implementation Steps:** Implement the remaining foundational services: `DebateHistory` and `EnvironmentManager`, followed by the `CLIRegistry` parsing logic.

## Go Port - Database & Debate History (2026-03-21)
- Reimplemented `DatabaseService` (`packages/server/src/services/db.ts`) into `go-port/pkg/server/services/db`.
- Chosen `modernc.org/sqlite` (pure Go port) to bypass CGO requirements across platforms, configuring SQLite correctly inside standard `database/sql`.
- Ported the full `DebateHistoryService` schema, implementing complex metadata querying, row storage, deletion, counting, pruning old histories by timestamp, and fetching Supervisor specific histories using `Query` and `QueryRow`.
- Version incremented to 1.0.23.
- **Future Implementation Steps:** Finalize the orchestrator's backend ports: `CLIRegistry` and `EnvironmentManager`.
