# Borg Orchestrator - Current Tasks

## Go Port Implementation
The backend server (`packages/server`) is currently being ported to Go in `go-port/`.
The core data types (`pkg/shared/`), API integrations (`pkg/server/supervisors/`), and the debate consensus logic (`pkg/server/services/council/`) are complete.

### High Priority Go Port Tasks
*   [ ] **Environment Manager (`pkg/server/services/env/`)**: Fully implement `getOverrides`, `updateOverrides`, `redactSecrets`, and global variable loading logic in Go to replace the TypeScript module.
*   [ ] **CLI Registry (`pkg/server/services/cli/`)**: Port the registry logic that parses capabilities, manages tool paths, and handles tool selection routing in Go.
*   [ ] **WebSocket Manager (`pkg/server/services/ws/`)**: Implement the WebSocket hub for broadcasting logs, metrics, and state changes to the dashboard UI.
*   [ ] **HTTP Router (`pkg/server/api/`)**: Begin assembling the Hono-equivalent Go router (using `net/http` or `gin`) and hooking up the newly ported Go services to real endpoints.

## Future / Ongoing Features
*   [ ] **Hierarchical Councils**: Begin scoping the architecture for "Supreme" vs "Specialized" councils.
*   [ ] **Native IDE Integration**: Begin researching the creation of a VS Code Extension.
