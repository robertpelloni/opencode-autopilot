# Project Handover & Deep Analysis

**Date:** 2026-02-08
**Version:** 1.0.12
**Status:** Feature Complete (Phase 4)

## 1. Project Overview

OpenCode Autopilot is a sophisticated AI-driven software development assistant. It differs from standard coding assistants by implementing a **Council of Supervisors**—a multi-model consensus engine that debates architectural and implementation decisions before execution.

The system is built as a **Monorepo** managed by Bun/npm workspaces, consisting of a backend server (`@opencode-autopilot/server`), a CLI TUI (`@opencode-autopilot/cli`), and a shared library (`@opencode-autopilot/shared`).

## 2. Architecture & Data Flow

### 2.1 Backend (`packages/server`)
*   **Framework:** Hono (chosen for speed and lightweight nature).
*   **Runtime:** Bun (primary target).
*   **Core Services:**
    *   `CouncilService`: Orchestrates the debate loop. Calls multiple LLM providers (OpenAI, Anthropic, etc.), parses their votes (weighted consensus), and produces a final decision.
    *   `SmartPilotService`: Background poller. Checks active sessions for "tasks" (via CLI or API), initiates debates automatically, and sends guidance back to the user.
    *   `QuotaManagerService`: Critical for cost control. Tracks token usage, costs, and request rates per provider. Implements throttling.
    *   `FineTunedModelManager`: Manages the lifecycle of custom models (datasets -> jobs -> models -> supervisors).
    *   `SystemManager`: Handles git submodules and versioning.
*   **Data Persistence:**
    *   Currently file-based JSON storage (`.autopilot/` directory).
    *   `DebateHistoryService` stores full transcripts.
    *   `WorkspaceManager` stores workspace configurations.

### 2.2 Frontend (`public`)
*   **Architecture:** Zero-build Vanilla JS Single Page Application (SPA).
*   **Communication:**
    *   **WebSocket (`/ws`)**: Real-time log streaming, session updates, and "pending decision" alerts.
    *   **REST API**: Data fetching and action execution.
*   **Key Components:**
    *   `index.html`: The main dashboard. Uses a tabbed interface.
    *   `analytics.html`: Chart.js visualizations for supervisor performance.

### 2.3 CLI (`packages/cli`)
*   **Framework:** Ink (React for CLI).
*   **Role:** The primary interface for developers to start sessions (`opencode start`), view logs, and receive guidance.

## 3. Current Feature Status

| Feature Area | Status | Implementation Details |
| :--- | :--- | :--- |
| **Council Debate** | 100% | Weighted voting, rounds, confidence scores, dissenting opinions. |
| **Smart Pilot** | 100% | Auto-polling, configurable thresholds, "human-in-loop" veto integration. |
| **Web Dashboard** | 100% | 12 Tabs covering every aspect of the backend. Real-time updates. |
| **Quota/Cost** | 100% | Granular provider limits (RPM/TPM), daily budgets, cost tracking. |
| **Fine-Tuning** | 100% | End-to-end flow: Upload JSONL -> Train (OpenAI) -> Deploy -> Chat Test. |
| **Collaborative** | 100% | Multi-user debates, chat UI, voting UI, consensus visualization. |
| **Simulator** | 100% | Replay logic, "What-if" analysis, mock supervisors for speed. |
| **System** | 100% | Submodule tracking, git info, project structure visualization. |

## 4. Technical Debt & Limitations

While feature-complete, the following areas require attention in the next phase:

1.  **Persistence Scalability**:
    *   *Issue:* We rely on `fs` and JSON files (e.g., `debate-history.json`). As history grows, `JSON.parse/stringify` on every write will become a bottleneck.
    *   *Recommendation:* Migrate to SQLite or LevelDB for local persistence.

2.  **Frontend Maintainability**:
    *   *Issue:* `index.html` is 3000+ lines of raw HTML/JS.
    *   *Recommendation:* Migrate to a build-step free component library (like Preact via ESM or Lit) or simply split the JS into modules (`js/dashboard.js`, `js/api.js`).

3.  **WebSocket Reconnection Logic**:
    *   *Issue:* Basic retry logic exists, but complex state resynchronization (fetching missed events) is not fully implemented.
    *   *Recommendation:* Implement a sequence-number based event log for robust reconnection.

4.  **Security**:
    *   *Issue:* API keys are stored in plaintext in memory/config.
    *   *Recommendation:* Integrate a system keychain or encrypted storage for sensitive provider configs.

## 5. Next Steps for Future Agents

**Immediate Actions:**
1.  **Refactor Frontend**: Break down `index.html` into smaller modules.
2.  **SQLite Migration**: Replace `DebateHistoryService`'s array-based storage with SQLite.
3.  **IDE Extension**: The backend is ready. Create a VS Code extension that connects to `ws://localhost:3847` to show council decisions inline.

**Strategic Goals:**
1.  **Swarm Intelligence**: Implement the "Micro-agent" architecture. Instead of one big debate, spawn sub-councils for specific files.
2.  **Self-Evolution**: Allow the Council to propose PRs to the `opencode-autopilot` repo itself (Meta-programming).

## 6. Key Files Guide

*   `packages/server/src/index.ts`: API Route definitions and server startup.
*   `packages/server/src/services/council.ts`: The brain. Debate logic resides here.
*   `packages/server/src/services/smart-pilot.ts`: The automation loop.
*   `public/index.html`: The monolithic frontend (needs splitting).
*   `LLM_INSTRUCTIONS.md`: Universal guide for agents.

**Good luck.**
