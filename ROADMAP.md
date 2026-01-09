# Project Roadmap

## Phase 1: Foundation ✅
- [x] Initial Project Setup
- [x] Define Core Types (`packages/shared/src/types.ts`)
- [x] Implement Council Manager (`packages/server/src/services/council.ts`)
- [x] Implement Base Supervisor Interface

## Phase 2: Supervisor Integration ✅
- [x] Mock Supervisor (for testing)
- [x] OpenAI Supervisor Implementation
- [x] Anthropic Supervisor Implementation
- [x] Google/Gemini Supervisor Implementation
- [x] DeepSeek Supervisor Implementation
- [x] Grok/xAI Supervisor Implementation
- [x] Qwen Supervisor Implementation
- [x] Kimi/Moonshot Supervisor Implementation
- [x] Generic OpenAI-compatible Supervisor (for custom providers)

## Phase 3: Monorepo Architecture ✅
- [x] Workspace setup with packages/
- [x] Shared types package (`@opencode-autopilot/shared`)
- [x] Server package with Hono/Bun (`@opencode-autopilot/server`)
- [x] CLI package with Ink/React (`@opencode-autopilot/cli`)
- [x] Config service for env-based supervisor loading
- [x] Session manager for spawning opencode processes
- [x] WebSocket real-time updates

## Phase 4: Workflow & Orchestration ✅
- [x] Basic Discussion Logic (Round-robin debate)
- [x] Configurable debate rounds
- [x] Configurable consensus threshold
- [x] Advanced Consensus Mechanism (Weighted voting with confidence scores)
- [x] Smart Pilot mode (auto-continue)
- [x] Auto-continue Hooks

## Phase 5: Interface & Visualization ✅
- [x] CLI Interface with commands (debate, status, add-mock, toggle)
- [x] REST API endpoints (/api/council, /api/sessions, /api/smart-pilot, /api/hooks)
- [x] WebSocket for real-time updates
- [x] TUI Dashboard for Supervisor Status & Debate History
- [x] Documentation & Submodule Tracking

## Phase 6: Testing & Refinement ✅
- [x] E2E Test Script (`scripts/test-e2e.ts`)
- [x] Unit Tests for Council logic (18 tests)
- [x] Integration Tests (13 API tests)
- [x] Performance Optimization (parallel supervisor calls)

## Phase 7: Production Readiness ✅
- [x] Example configuration files (`.autopilot/config.example.json`)
- [x] Environment variable template (`.env.example`)
- [x] Request validation with Zod schemas (`packages/server/src/schemas.ts`)
- [x] Rate limiting middleware (`packages/server/src/middleware/rate-limit.ts`)
- [x] Graceful shutdown handling (SIGINT/SIGTERM)

## Phase 8: Resilience & Observability ✅
- [x] Detailed health check endpoint (`/health` with uptime, memory, supervisor status)
- [x] Readiness probe endpoint (`/ready` for k8s-style checks)
- [x] Error handling middleware with proper HTTP status codes
- [x] CORS configuration with exposed rate limit headers
- [x] Supervisor retry logic with exponential backoff (`packages/server/src/supervisors/retry.ts`)
- [x] Cleanup legacy src/ directory (monorepo consolidation)

## Phase 9: Metrics & Telemetry ✅
- [x] Metrics service (`packages/server/src/services/metrics.ts`)
- [x] HTTP request metrics (count, latency, error rate per endpoint)
- [x] Supervisor metrics (calls, latency, errors, retries per provider)
- [x] Debate metrics (count, avg latency, consensus rate)
- [x] Metrics middleware for automatic HTTP tracking
- [x] `/metrics` endpoint with JSON and Prometheus formats
- [x] Health endpoint enhanced with metrics summary

## Phase 10: API Authentication ✅
- [x] API key authentication middleware (`packages/server/src/middleware/auth.ts`)
- [x] Supports `Authorization: Bearer <key>` and `X-API-Key` headers
- [x] Protected mutation endpoints (council, smart-pilot, hooks)
- [x] Public endpoints remain open (health, ready, metrics, status)
- [x] Optional - disabled when `API_KEY` env var not set

## Environment Variables

```bash
# Supervisor API Keys (auto-creates supervisors on startup)
OPENAI_API_KEY, OPENAI_MODEL
ANTHROPIC_API_KEY, ANTHROPIC_MODEL
DEEPSEEK_API_KEY, DEEPSEEK_MODEL
GEMINI_API_KEY, GEMINI_MODEL
GROK_API_KEY, GROK_MODEL
QWEN_API_KEY, QWEN_MODEL
KIMI_API_KEY, KIMI_MODEL

# Server Config
AUTOPILOT_PORT=3847
AUTOPILOT_HOST=0.0.0.0
AUTOPILOT_BASE_PORT=4096
AUTOPILOT_CONFIG_DIR=.autopilot
AUTOPILOT_DEBATE_ROUNDS=2
AUTOPILOT_CONSENSUS=0.7
AUTOPILOT_SMART_PILOT=false
```
