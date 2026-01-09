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

## Phase 4: Workflow & Orchestration (In Progress)
- [x] Basic Discussion Logic (Round-robin debate)
- [x] Configurable debate rounds
- [x] Configurable consensus threshold
- [ ] Advanced Consensus Mechanism (Weighted voting)
- [ ] Smart Pilot mode (auto-continue)
- [ ] Auto-continue Hooks

## Phase 5: Interface & Visualization
- [x] CLI Interface with commands (debate, status, add-mock, toggle)
- [x] REST API endpoints (/api/council, /api/sessions)
- [x] WebSocket for real-time updates
- [ ] TUI Dashboard for Supervisor Status & Debate History
- [ ] Documentation & Submodule Tracking

## Phase 6: Testing & Refinement
- [x] E2E Test Script (`scripts/test-e2e.ts`)
- [ ] Unit Tests for Council logic
- [ ] Integration Tests
- [ ] Performance Optimization

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
