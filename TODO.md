# Borg Orchestrator - Current Tasks

## Go Port Implementation Phase 2

### Process Management
*   [ ] **Terminal Sidecar Spawning (`pkg/server/services/session/`)**: Implement Go's `os/exec` to spawn terminal subprocesses (Aider, Claude Code, etc.) with pseudo-terminals (PTYs), fully replacing Node's `node-pty`.
*   [ ] **Process Lifecycle**: Implement graceful shutdown, SIGTERM signaling, and automatic restart handling for sidecars.

### Deep Integration
*   [ ] **Live Endpoint Wiring**: Replace the mock JSON responses in `api/router.go` and `api/router_extended.go` with live function calls to the `SessionManager`, `WSManager`, and `CouncilHierarchy`.
*   [ ] **Database Layer (`pkg/server/services/db/`)**: Fully configure `database/sql` using `modernc.org/sqlite`. Implement table creation schemas and insert/select operations for `DebateHistory` and `QuotaTracking`.

### WebSocket Streaming
*   [ ] **Gorilla WebSocket**: Implement a robust WebSocket Hub in `ws_manager.go` using the `github.com/gorilla/websocket` library.
*   [ ] **Log Multiplexing**: Pipe stdout/stderr buffers from the PTY `SessionManager` into the `WSManager` to broadcast real-time terminal output to connected UI clients.

## Future Frontends
*   [ ] **Tauri IPC**: Scaffold the Tauri Rust backend and implement Inter-Process Communication (IPC) binding the Tauri WebView to the local Go binary's API port.
