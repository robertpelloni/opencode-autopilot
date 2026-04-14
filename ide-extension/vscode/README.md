# Borg Orchestrator - VS Code Extension

This directory contains the initial structure and research for the Borg Orchestrator VS Code extension.

## Goals
- Allow developers to trigger debates on selected code snippets directly from the editor context menu.
- Stream real-time logs and debate progress into a custom VS Code webview panel.
- Connect to the local `go-port` backend instance for robust, background coordination.

## Architecture
- **Activation**: Triggers on `borg.debate` command.
- **Client**: Connects to the local orchestrator API (`http://localhost:3847`) and WebSocket (`ws://localhost:3847/ws`).
- **UI**: A webview built with React to display the standard Borg dashboard tailored for an IDE side-panel.

## Next Steps
- Initialize standard `yo code` extension scaffold.
- Implement the basic Language Server Protocol (LSP) or direct HTTP client.
