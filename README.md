# OpenCode Council Orchestrator

A web-based orchestration platform for managing local OpenCode sessions, integrated with the "Council of Supervisors" for automated AI guidance.

> **Note:** This project is designed to be a submodule within the **aios** (AI Operating System) monorepo. It serves as the local interface for OpenCode sessions, complementing `jules-app` (which handles remote Google Jules sessions).

## 🎯 Purpose

The **Council Orchestrator** provides a centralized dashboard to:
1.  **Manage Sessions**: View, start, stop, and monitor multiple local OpenCode repositories.
2.  **Automate Guidance**: Run a background "Council" loop that continuously monitors active sessions and injects high-level architectural advice from multiple AI models (GPT-4, Claude, Gemini, DeepSeek).
3.  **Visualize State**: See logs and status of your AI coding agents in real-time.

## 🏗️ Architecture

This project consists of three main components:

1.  **Web Dashboard (`public/index.html`)**: A frontend interface to list sessions and control the orchestrator.
2.  **Backend Server (`src/server.ts`)**: An Express.js server that:
    - Serves the dashboard.
    - Manages `opencode` child processes.
    - Exposes an API for session management.
    - Runs the "Council Loop" for active sessions.
3.  **Council Logic (`src/council.ts`)**: The core multi-agent debate engine that synthesizes advice.

## 🚀 Getting Started

### Prerequisites
- Node.js & npm
- OpenCode CLI installed and accessible in your PATH (or configured in `session-manager.ts`).
- API Keys for the supervisors (OpenAI, Anthropic, Google, etc.) in a `.env` file.

### Installation

```bash
npm install
npm run build
```

### Running the Orchestrator

Start the web server and the orchestration loop:

```bash
npm run server
```

Then open your browser to `http://localhost:3000`.

### Legacy Headless Mode

If you only want to run the council loop for a single active session without the web UI:

```bash
npm run controller
```

## 📂 Project Structure

- **`src/server.ts`**: Entry point for the Web Orchestrator.
- **`src/session-manager.ts`**: Handles spawning OpenCode processes and managing SDK connections.
- **`src/controller.ts`**: Standalone script for headless operation.
- **`src/council.ts`**: The multi-agent consensus engine.
- **`src/supervisors/`**: AI Model implementations (OpenAI, Anthropic, Google, DeepSeek).
- **`public/`**: Static frontend assets.

## 🔄 Migration to aios

This repository is being migrated to `workspace/aios/opencode-autopilot-council`.
If you are moving this folder, ensure you:
1.  Copy all files including `.env` (if present).
2.  Run `npm install` in the new location.
3.  Update any relative paths if this project relies on other `aios` modules (currently it is standalone).

## 🤝 Contributing

This project is part of the aios ecosystem.
