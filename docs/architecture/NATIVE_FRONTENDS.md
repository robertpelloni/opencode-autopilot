# Borg Orchestrator - Native Frontends Architecture

With the backend transitioning to a highly concurrent, static binary in Go, the Borg Orchestrator is positioned to support multiple native frontends.

## 1. Desktop App (Tauri)
**Why Tauri?**
Tauri allows us to bundle the compiled Go backend binary directly with a lightweight web frontend. It avoids the heavy memory footprint of Electron.

**Architecture:**
- **Backend:** The `go-port` binary is spawned as a sidecar process by the Tauri Rust core on startup.
- **Frontend:** We reuse the existing SPA dashboard (`public/index.html` or a React port) running in the Tauri WebView.
- **Communication:** Standard HTTP requests to the sidecar's API and WebSockets for real-time log streaming.

## 2. Mobile App (React Native / Expo)
**Why Mobile?**
Allows lead developers or CTOs to review "CEO Veto" pending decisions and monitor swarm health on the go.

**Architecture:**
- **Backend:** Runs on a dedicated server or cloud instance.
- **Frontend:** React Native app connects via secure WebSockets.
- **Features:** Push notifications for "Debate Consensus Reached", swipe-to-approve UI for pending code changes.

## 3. Terminal UI (Ink)
**Current State:**
The existing `packages/cli` provides a rich React-based terminal UI.
**Future State:**
The CLI will be updated to make API calls to the new Go backend instead of the legacy TypeScript backend.
