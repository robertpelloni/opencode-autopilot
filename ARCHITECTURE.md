
## 🏗️ Technical Architecture
### Overview
The Council Orchestrator is a TypeScript-based application designed to manage and supervise multiple `OpenCode` agent sessions. It provides a centralized dashboard for monitoring, configuration, and autonomous guidance.

### Core Components

#### 1. Backend (`src/`)
*   **`server.ts`**: The entry point. An Express.js server that:
    *   Serves the static frontend.
    *   Exposes REST APIs for session management (`/api/sessions`).
    *   Handles real-time configuration updates (`/api/sessions/:id/config`).
*   **`session-manager.ts`**: The heart of the application.
    *   **Process Management**: Spawns `opencode` child processes on unique ports (starting at 4096).
    *   **Monitoring Loop**: Polls active sessions every 10 seconds.
    *   **Logic Engine**: Checks if the AI assistant has finished a turn. If so, it triggers the **Council** to deliberate.
    *   **Git Integration**: Extracts branch, commit, and remote info for display.
*   **`council.ts`**: Implements the "Council of Supervisors" pattern.
    *   Manages a list of `ISupervisor` agents (e.g., GPT-4, Claude, Mock).
    *   Orchestrates the **Debate** phase (round-robin discussion).
    *   Synthesizes a final **Guidance** object (Approved/Rejected + Feedback).
*   **Supervisors (`src/supervisors/`)**: Adapters for different LLM providers (OpenAI, Anthropic, Google, DeepSeek) and a Mock supervisor for testing.

#### 2. Frontend (`public/`)
*   **`index.html`**: A lightweight, single-file Vanilla JS application.
    *   **Design**: Mimics the "Zinc" dark theme of `jules-app` (Shadcn UI style) using pure CSS variables.
    *   **Components**: Custom implementations of Cards, Badges, Modals, and Switches.
    *   **State**: Fetches session data via polling (`fetchSessions()`).
    *   **Settings**: A modal for configuring API keys, debate modes, and fallback messages, persisted to `localStorage`.

### 🔄 Data Flow
1.  **User** starts a session via the Dashboard.
2.  **Manager** spawns an `opencode` process and connects via the SDK.
3.  **Manager** monitors the chat history.
4.  **When AI finishes**:
    *   If **Autopilot** is enabled:
        *   If **Smart Pilot** is ON: The Council (LLMs) reviews the context and generates guidance.
        *   If **Smart Pilot** is OFF (or rejects): The system picks a random **Fallback Message** (e.g., "Proceed").
    *   The guidance is sent back to the `opencode` session as a user prompt.

### 🛠️ Configuration
*   **Environment Variables**: `.env` file for default API keys.
*   **Runtime Config**: User settings from the dashboard override defaults per session.
