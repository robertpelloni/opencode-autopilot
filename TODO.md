# Borg Orchestrator - Current Tasks

## Phase 3: Final Consolidation & Native Execution

### PTY Compatibility
*   [x] **Full Pseudo-Terminal Support (`creack/pty`)**: The current `os/exec` implementation pipes raw stdin/stdout, but many LLM CLI tools (Aider, Claude Code) expect an interactive TTY. We need to implement proper PTY allocation in Go (e.g. using `github.com/creack/pty`) for the sidecar sessions to capture terminal control sequences properly.

### Database Operations
*   [x] **Retrieve Methods (`pkg/server/services/db/`)**: We've implemented `INSERT` queries for history and quota. We need the corresponding `SELECT` queries (e.g. `GetDebateHistory`, `GetQuota`) so the API can serve this data to the frontend dashboard.

### API Parity Completeness
*   [x] **Plugin Manager Endpoints**: Port the `GET /api/plugins` and `POST /api/plugins/:id/toggle` routes to Go.
*   [x] **Workspace Endpoints**: Port the `GET /api/workspaces` endpoints for project switching to Go.

### Documentation & Build
*   [ ] **Go Build Pipeline**: Update `.gitlab-ci.yml` and `package.json` build scripts to compile the `go-port` binary across architectures.
*   [ ] **Handoff & README**: Document the architecture shift to Go + Tauri in the `README.md` and `ARCHITECTURE.md`.
