# Borg Orchestrator 🤖

An autonomous development guidance system powered by a multi-model "Council" of AI supervisors.

![Borg Orchestrator](https://img.shields.io/badge/Status-Beta-brightgreen.svg)
![Version](https://img.shields.io/badge/Version-1.0.28-blue.svg)

## Architecture Shift (v1.0.28)
<<<<<<< HEAD
The Borg Orchestrator backend has been methodically ported from TypeScript/Hono to a highly concurrent native **Go** backend (`go-port/`).
=======
The Borg Orchestrator backend has been methodically ported from TypeScript/Hono to a highly concurrent native **Go** backend (`go-port/`).
>>>>>>> origin/main

### Why Go?
- **True Concurrency:** Eliminates JS event loop blocking during heavy API routing.
- **Native OS Execution:** Replaced the problematic `node-pty` extension with Go's native `os/exec` and `creack/pty` for robust detached terminal sidecar management (e.g., Aider, Claude Code).
- **SQLite:** Replaced `sqlite3` CGO bindings with `modernc.org/sqlite` for a seamless cross-platform binary build process.

The frontends are transitioning from a web-only SPA to native desktop architectures utilizing **Tauri** (Rust).

## Core Concepts

1. **Supervisor Council:** A democratic multi-agent consensus engine. Models (OpenAI, Anthropic, Gemini) debate code changes, providing critiques, modifications, and votes before any execution occurs.
2. **Smart Pilot:** Automatically detects repository changes, determines required tasks, and automatically initiates sidecar CLI swarms.
3. **Terminal Sidecars:** External AI CLI agents operate in detached pseudo-terminals managed natively by Go, ensuring zero-downtime recovery and live streaming to the dashboard via Gorilla WebSockets.
4. **Quota Management:** Strict token tracking and automatic budget throttling per LLM provider.

## Building and Running

### Prerequisites
- [Bun](https://bun.sh/) (for legacy frontend tools & CLI)
- [Go 1.22+](https://golang.org/) (for the new Orchestrator Core)

### Quick Start
```bash
# 1. Compile the Go backend
npm run build:server
# Starts the compiled API on http://localhost:3847
./go-port/bin/borg-server

# 2. (Optional) Run tests
go test ./go-port/...
```

## Dashboard & Analytics
The project includes a realtime HTML5/Chart.js dashboard streaming logs via Gorilla WebSockets and rendering persistent history and quota usage analytics directly from the new SQLite integration.

## License
MIT
