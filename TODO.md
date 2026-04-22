# Borg Orchestrator - Current Tasks

## Phase 5: Deep IDE Integration (VS Code)

### Webview Architecture
*   [x] **VS Code Panel**: Implement the VS Code Extension `WebviewPanel` to host the existing `public/index.html` React/Vanilla dashboard as an integrated editor pane.
*   [x] **Local Server Lifecycle**: Ensure the VS Code extension automatically spawns the compiled Go backend binary on a dynamic port and sets `API_BASE` for the Webview automatically.

### Editor Context
*   [x] **"Debate This" Command**: Register a VS Code command (`borg.debateSelection`) that captures the currently highlighted code in the editor, packages it into a `DevelopmentTask`, and posts it to the Go backend's `/api/council/debate` endpoint.
*   [ ] **Diff Rendering**: When the Council reaches a consensus and outputs proposed code changes, use the VS Code `vscode.diff` command to present a native inline diff to the user before applying.

## Phase 6: Production Readiness
*   [ ] **Code Cleanup**: Remove all deprecated TypeScript backend source files (`packages/server/src/services/*.ts`) now that the Go port has officially reached 100% parity and taken over as the primary execution engine.
