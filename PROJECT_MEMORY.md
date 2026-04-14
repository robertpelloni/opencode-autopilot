[PROJECT_MEMORY]

### Project Overview
The Borg Orchestrator is an autonomous development guidance system that utilizes a "Council" of AI supervisors (e.g., GPT-4, Claude, Gemini). Instead of relying on a single model, these supervisors debate, refine, and vote on code changes before execution.

### Monorepo Architecture (TypeScript)
The project originally operates as a Bun/npm monorepo:
1.  **Backend (`packages/server`)**: A lightweight API built on the Hono framework. It orchestrates the debate loops (`SupervisorCouncil`), polls for tasks (`SmartPilotService`), manages costs and rate limits (`QuotaManagerService`), and handles multi-model LLM integrations via standard APIs.
2.  **CLI (`packages/cli`)**: An Ink (React-based) terminal user interface that serves as the primary developer entry point.
3.  **Shared (`packages/shared`)**: Shared TypeScript interfaces defining the robust voting protocols, consensus modes, and communication types.
4.  **Frontend (`public/index.html`)**: A vanilla JS Single Page Application (SPA) dashboard that connects to the backend via WebSockets for real-time log streaming and analytics visualizations.

### The Go Port Initiative (`go-port`)
To improve concurrency, performance, and stability, the backend is currently being methodically ported to Go.
*   **Data Models**: The shared interfaces (`types.ts`, `swarm-types.ts`) have been translated into robust Go structs (`types.go`).
*   **LLM Integration (`supervisors`)**: The generic OpenAI interface, Anthropic Messages API, and mock supervisors have been ported. This includes robust, exponential backoff HTTP retry logic (`retry.go`).
*   **Debate Engine (`SupervisorCouncil`)**: The monolithic 700+ line `council.ts` file was decomposed into a highly modular Go package. It implements 8 distinct consensus modes (e.g., Simple Majority, Supermajority, CEO Veto, Ranked Choice) and supports dynamic supervisor selection and fallback chains.
*   **Observability & Constraints**: The `MetricsService` and `QuotaManagerService` were ported. These implementations leverage Go's `sync.RWMutex` to ensure thread-safe concurrent map access, and utilize background `time.Ticker` goroutines to prune stale metric history automatically.

### Key Architectural Patterns
1.  **Multi-Model Consensus**: The system never trusts a single LLM. It enforces a democratic debate process where models critique each other's work before a final decision is calculated based on supervisor weights and confidence scores.
2.  **Detached Execution**: The system can manage 25+ different external CLI tools (Aider, Claude Code, Copilot) via a `TerminalSidecar` pattern, allowing detached PTY processes for zero-downtime reliability.
3.  **Strict Quota Management**: Given the high volume of automated API calls, the system enforces strict token, request, and cost budgets per provider, automatically throttling providers that hit 429 rate limits.
4.  **Self-Evolution**: The system can modify and build its own source code, automatically adjusting supervisor trust weights based on historical consensus performance.

### CI/CD and Environment Learnings
*   **Testing**: The project relies on `bun test` and `go test ./...`. Integration tests require the backend server to be running (a previous CI failure was fixed by ensuring the background daemon starts before the test suite).
*   **Native Addons**: The original TypeScript backend relies on `node-pty` for terminal management, which can face compilation issues (`node-gyp` / Python metadata) in certain CI environments, underscoring the value of moving to a compiled language like Go.
