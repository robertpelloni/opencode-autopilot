# Project Memory & Observations

## Project Overview
*   **Name:** Borg Orchestrator
*   **Goal:** A multi-model AI council for autonomous development guidance where multiple AI supervisors (e.g., OpenAI, Anthropic, Gemini) debate and vote on code changes through a democratic process.
*   **Architecture:** Monorepo using Bun workspaces.
    *   `packages/server`: Backend API built with Hono.
    *   `packages/cli`: Ink (React) Terminal UI dashboard.
    *   `packages/shared`: Shared TypeScript types across packages.
    *   `public`: Vanilla JS Single Page Application (SPA) dashboard communicating via WebSockets and REST.
    *   `go-port`: In-progress native Go port to rewrite the backend server for improved concurrency, modularity, and speed.

## Technical Patterns & Decisions
*   **Consensus Engine (`SupervisorCouncil`):**
    *   Implements multiple voting modes: Simple Majority, Supermajority, Unanimous, Weighted, CEO Override, CEO Veto, Hybrid CEO-Majority, and Ranked Choice.
    *   Uses a "fallback chain" to attempt alternative supervisors if the primary (or Lead) fails.
*   **Integrations & Tooling:**
    *   Supports roughly 40+ different AI CLI tools (e.g., Adrenaline, Aider, Amazon Q, Claude Code).
    *   Maintained via a robust `CLIRegistry` parsing tool capabilities and versions.
*   **Metrics & Quotas:**
    *   Strict tracking of latency, success rates, and retry counts (`MetricsService`).
    *   Comprehensive quota tracking (`QuotaManagerService`) managing Tokens Per Minute/Day, Requests Per Minute/Hour, and budget thresholds.
    *   Automatic throttling mechanism prevents rate-limit blowouts (429 errors).
*   **Resilience & Networking:**
    *   Exponential backoff implementations with jitter for AI API requests.
    *   Background tickers/intervals prune older analytics and request histories to manage memory footprints.
*   **Environment:**
    *   Relies heavily on Bun as a runtime.
    *   Submodules handle integration of proxy networks and actual AI terminal agents.
    *   CI issues observed with Node 20/24 compatibility specifically concerning native addons like `node-pty`.

## Porting Strategy (Go)
*   **Modularity:** Refactoring monolithic TypeScript services (like `council.ts` and `quota-manager.ts`) into multiple smaller, strictly typed Go files (e.g., separating struct definitions, helpers, and handlers).
*   **Concurrency:** Transitioning from JavaScript event-loop intervals to standard Go goroutines + `time.Ticker` with explicit `sync.RWMutex` locks protecting shared state maps (like provider usage).
