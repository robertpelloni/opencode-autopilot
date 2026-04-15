# Borg Orchestrator - Current Tasks

## Go Port Implementation
The backend server (`packages/server`) is currently being ported to Go in `go-port/`.
The core data types (`pkg/shared/`), API integrations (`pkg/server/supervisors/`), and the debate consensus logic (`pkg/server/services/council/`) are complete.

### High Priority Go Port Tasks
*   [x] **Environment Manager (`pkg/server/services/env/`)**: Fully implement `getOverrides`, `updateOverrides`, `redactSecrets`, and global variable loading logic in Go to replace the TypeScript module.
*   [x] **CLI Registry (`pkg/server/services/cli/`)**: Port the registry logic that parses capabilities, manages tool paths, and handles tool selection routing in Go.
*   [x] **WebSocket Manager (`pkg/server/services/ws/`)**: Implement the WebSocket hub for broadcasting logs, metrics, and state changes to the dashboard UI.
*   [x] **HTTP Router (`pkg/server/api/`)**: Begin assembling the Hono-equivalent Go router (using `net/http` or `gin`) and hooking up the newly ported Go services to real endpoints.

## Future / Ongoing Features
*   [x] **Hierarchical Councils**: Begin scoping the architecture for "Supreme" vs "Specialized" councils.
*   [x] **Native IDE Integration**: Begin researching the creation of a VS Code Extension.

## Next Phase: Core Features & Refinements
*   [x] **Go Port Completion**: Ensure all endpoints listed in `packages/server/src/index.ts` have corresponding Go handlers and run integration tests against the Go HTTP server.
*   [ ] **Native Frontends**: Plan out desktop (Electron/Tauri) and mobile architectures referencing the newly built Go backend.
*   [ ] **Persistent Analytics UI**: Wire up SQLite stored history metrics to visual charts in the dashboard.
