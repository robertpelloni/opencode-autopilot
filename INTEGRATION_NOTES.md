# OpenCode-Autopilot → Borg Core Integration Notes

> **Prepared for**: Borg integration session  
> **Date**: January 11, 2026  
> **Status**: Ready for integration

---

## Executive Summary

This document provides comprehensive notes for integrating opencode-autopilot's multi-model AI council functionality directly into Borg core, eliminating the need for a separate executable/service.

### Current Architecture
```
Borg Core (port 3002)          opencode-autopilot (port 3847)
├── Hono server                 ├── Hono server (SEPARATE)
├── CouncilManager ──spawns──►  ├── SupervisorCouncil
├── AgentManager                ├── 20+ services
├── ModelGateway                ├── Own supervisors
└── Socket.io                   └── Own WebSocket
```

### Target Architecture
```
Borg Core (port 3002) - UNIFIED
├── Hono server
├── SupervisorCouncilManager (native)
├── All council services (native)
├── Shared ModelGateway
├── Shared SecretManager
└── Unified Socket.io events
```

---

## Source Files to Migrate

### Location
```
FROM: C:\Users\hyper\workspace\borg\submodules\opencode-autopilot\packages\server\src\
TO:   C:\Users\hyper\workspace\borg\packages\core\src\
```

### Priority 1: Core Council (CRITICAL)

| File | Lines | Target Location | Purpose |
|------|-------|-----------------|---------|
| `services/council.ts` | 640 | `managers/SupervisorCouncilManager.ts` | Multi-model debate engine, 8 consensus modes, weighted voting |
| `supervisors/openai.ts` | ~100 | `supervisors/OpenAISupervisor.ts` | GPT-4 adapter |
| `supervisors/anthropic.ts` | ~100 | `supervisors/AnthropicSupervisor.ts` | Claude adapter |
| `supervisors/generic-openai.ts` | ~150 | `supervisors/GenericOpenAISupervisor.ts` | DeepSeek, Grok, Qwen, Kimi |
| `supervisors/index.ts` | ~50 | `supervisors/index.ts` | Factory/registry |

### Priority 2: Decision Support

| File | Lines | Target Location | Purpose |
|------|-------|-----------------|---------|
| `services/dynamic-supervisor-selection.ts` | ~300 | `managers/DynamicSelectionManager.ts` | Auto-select team for task type |
| `services/debate-history.ts` | ~200 | `services/DebateHistoryService.ts` | Persist debate records |
| `services/human-veto.ts` | ~250 | `managers/HumanVetoManager.ts` | Human-in-the-loop approval |

### Priority 3: Analytics & Templates

| File | Lines | Target Location | Purpose |
|------|-------|-----------------|---------|
| `services/supervisor-analytics.ts` | ~400 | `services/SupervisorAnalyticsService.ts` | Performance tracking |
| `services/debate-template-manager.ts` | ~200 | `managers/DebateTemplateManager.ts` | Pre-configured scenarios |
| `services/smart-pilot.ts` | ~150 | `managers/SmartPilotManager.ts` | Auto-continue on approval |

### Priority 4: Advanced Features

| File | Lines | Target Location | Purpose |
|------|-------|-----------------|---------|
| `services/collaborative-debate-manager.ts` | ~300 | `managers/CollaborativeDebateManager.ts` | Multi-human participants |
| `services/fine-tuned-model-manager.ts` | ~250 | `managers/FineTunedModelManager.ts` | Custom model support |
| `services/workspace-manager.ts` | ~200 | `managers/WorkspaceManager.ts` | Multi-project |
| `services/plugin-manager.ts` | ~350 | `managers/CouncilPluginManager.ts` | External supervisor plugins |

### Priority 5: Supporting Infrastructure

| File | Lines | Target Location | Purpose |
|------|-------|-----------------|---------|
| `services/quota-manager.ts` | ~150 | `services/QuotaService.ts` | Rate limiting per supervisor |
| `services/metrics.ts` | ~100 | Integrate into `MetricsService.ts` | Council metrics |
| `services/hooks.ts` | ~150 | Integrate into `HookManager.ts` | Council hooks |
| `services/ws-manager.ts` | ~100 | Integrate into Socket.io setup | Real-time events |

### Routes to Migrate

| Route File | Target | Endpoints |
|------------|--------|-----------|
| `routes/council.ts` | `routes/councilRoutes.ts` | `/api/council/*` |
| `routes/veto.ts` | `routes/vetoRoutes.ts` | `/api/veto/*` |
| `routes/dynamic-selection.ts` | `routes/dynamicSelectionRoutes.ts` | `/api/dynamic-selection/*` |
| `routes/debate-history.ts` | `routes/debateHistoryRoutes.ts` | `/api/debate-history/*` |
| `routes/supervisor-analytics.ts` | `routes/analyticsRoutes.ts` | `/api/supervisor-analytics/*` |
| `routes/templates.ts` | `routes/templateRoutes.ts` | `/api/templates/*` |
| `routes/collaborative-debates.ts` | `routes/collaborativeRoutes.ts` | `/api/collaborative/*` |
| `routes/fine-tuned-models.ts` | `routes/fineTunedRoutes.ts` | `/api/fine-tuned/*` |
| `routes/plugins.ts` | `routes/councilPluginRoutes.ts` | `/api/council-plugins/*` |

---

## Key Integration Points

### 1. ModelGateway Integration

**Current** (opencode-autopilot): Each supervisor makes direct API calls
```typescript
// supervisors/openai.ts
const response = await openai.chat.completions.create({...});
```

**Target** (Borg): Use shared ModelGateway
```typescript
// Use Borg ModelGateway
const response = await this.modelGateway.chat(model, messages);
```

**Action**: Refactor supervisors to accept `ModelGateway` in constructor

### 2. SecretManager Integration

**Current**: Reads from `process.env` directly
```typescript
const apiKey = process.env.OPENAI_API_KEY;
```

**Target**: Use Borg SecretManager
```typescript
const apiKey = this.secretManager.getSecret('OPENAI_API_KEY');
```

**Action**: Pass `SecretManager` to supervisor constructors

### 3. Socket.io Events

**Current**: Own WebSocket manager
```typescript
wsManager.broadcast('council_decision', decision);
```

**Target**: Use Borg io instance
```typescript
this.io.emit('council:decision', decision);
```

**Event Mapping**:
| opencode-autopilot | Borg |
|-------------------|------|
| `council_decision` | `council:decision` |
| `session_update` | `council:session_update` |
| `session_health` | `council:health` |
| `veto_pending` | `council:veto_pending` |
| `debate_progress` | `council:debate_progress` |

### 4. Database Integration

**Current**: JSON file storage
```typescript
fs.writeFileSync('debate_history.json', JSON.stringify(data));
```

**Target**: Use Borg DatabaseManager (SQLite)
```typescript
// New table: council_debates
this.db.prepare(`
  INSERT INTO council_debates (id, task, decision, votes, created_at)
  VALUES (?, ?, ?, ?, ?)
`).run(id, task, decision, votes, Date.now());
```

**Schema to Add**:
```sql
CREATE TABLE council_debates (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  task_description TEXT,
  decision_approved INTEGER,
  consensus REAL,
  weighted_consensus REAL,
  votes TEXT, -- JSON
  reasoning TEXT,
  consensus_mode TEXT,
  duration_ms INTEGER,
  created_at INTEGER
);

CREATE TABLE council_veto_history (
  id TEXT PRIMARY KEY,
  debate_id TEXT,
  action TEXT, -- approve/reject/redebate
  user_id TEXT,
  reason TEXT,
  created_at INTEGER
);

CREATE TABLE supervisor_profiles (
  name TEXT PRIMARY KEY,
  provider TEXT,
  model TEXT,
  weight REAL DEFAULT 1.0,
  specialties TEXT, -- JSON array
  enabled INTEGER DEFAULT 1
);
```

### 5. Memory Integration

**Opportunity**: Feed council decisions into Borg MemoryManager for context
```typescript
// After debate completes
await this.memoryManager.remember({
  content: `Council ${decision.approved ? 'approved' : 'rejected'} task: ${task.description}`,
  tags: ['council', 'decision', task.type]
});
```

---

## Shared Types

### Location
```
FROM: C:\Users\hyper\workspace\borg\submodules\opencode-autopilot\packages\shared\src\types.ts
TO:   C:\Users\hyper\workspace\borg\packages\core\src\types\council.ts
```

### Key Types to Port
```typescript
// Supervisor interface
export interface Supervisor {
  name: string;
  provider: 'openai' | 'anthropic' | 'deepseek' | 'gemini' | 'grok' | 'qwen' | 'kimi' | 'custom';
  model: string;
  isAvailable(): Promise<boolean>;
  chat(messages: Message[]): Promise<string>;
}

// Vote with confidence
export interface Vote {
  supervisor: string;
  approved: boolean;
  confidence: number; // 0-1
  weight: number; // 0-2
  comment: string;
}

// Consensus modes
export type ConsensusMode = 
  | 'simple-majority'
  | 'supermajority'
  | 'unanimous'
  | 'weighted'
  | 'ceo-override'
  | 'ceo-veto'
  | 'hybrid-ceo-majority'
  | 'ranked-choice';

// Council config
export interface CouncilConfig {
  supervisors: Supervisor[];
  debateRounds: number;
  consensusThreshold: number;
  consensusMode: ConsensusMode;
  weightedVoting: boolean;
  leadSupervisor?: string;
  fallbackSupervisors?: string[];
  enabled: boolean;
}

// Council decision
export interface CouncilDecision {
  approved: boolean;
  consensus: number;
  weightedConsensus: number;
  votes: Vote[];
  reasoning: string;
  dissent: string[];
}

// Development task for debate
export interface DevelopmentTask {
  id: string;
  description: string;
  context: string;
  files: string[];
  type?: TaskType;
}

// Task types for dynamic selection
export type TaskType = 
  | 'code-review'
  | 'security-audit'
  | 'architecture-design'
  | 'bug-fix'
  | 'feature-development'
  | 'performance-optimization'
  | 'documentation'
  | 'testing'
  | 'refactoring'
  | 'general';
```

---

## Implementation Order

### Phase 1: Core Council (Estimate: 4-6 hours)

1. **Create types file**: `packages/core/src/types/council.ts`
2. **Create supervisor base**: `packages/core/src/supervisors/BaseSupervisor.ts`
3. **Port supervisors**: OpenAI, Anthropic, Generic (refactor to use ModelGateway)
4. **Port SupervisorCouncil**: `packages/core/src/managers/SupervisorCouncilManager.ts`
5. **Update CouncilManager**: Remove process spawning, use native SupervisorCouncilManager
6. **Add council routes**: Wire to server.ts
7. **Test**: Verify debate works end-to-end

### Phase 2: Decision Support (Estimate: 3-4 hours)

1. **Port dynamic selection**: Task type detection, team selection
2. **Port debate history**: Migrate to SQLite schema
3. **Port human veto**: Pending decisions queue
4. **Add routes and Socket.io events**
5. **Test**: Verify veto flow, history persistence

### Phase 3: Analytics & Templates (Estimate: 2-3 hours)

1. **Port analytics**: Supervisor performance metrics
2. **Port templates**: Pre-configured debate scenarios
3. **Port smart pilot**: Auto-continue logic
4. **Test**: Verify analytics dashboard data

### Phase 4: Advanced Features (Estimate: 3-4 hours)

1. **Port collaborative debates**: Multi-human support
2. **Port fine-tuned models**: Custom model registration
3. **Port workspace manager**: Multi-project
4. **Port plugin manager**: External supervisors
5. **Test**: Full feature parity

### Phase 5: Cleanup (Estimate: 2 hours)

1. **Migrate tests**: Convert to Borg test patterns
2. **Update UI**: Point dashboard to new endpoints
3. **Remove submodule dependency** (optional - can keep for reference)
4. **Documentation**: Update README, API docs

---

## Files to Modify in Borg Core

### Definite Changes

| File | Changes |
|------|---------|
| `packages/core/src/server.ts` | Add SupervisorCouncilManager, routes, Socket.io events |
| `packages/core/src/managers/CouncilManager.ts` | Rewrite to use native council instead of spawning |
| `packages/core/src/db/schema.ts` | Add council tables |
| `packages/core/src/types.ts` | Add council types or import from new file |
| `packages/core/package.json` | May need new deps (unlikely - most are there) |

### New Files to Create

```
packages/core/src/
├── types/
│   └── council.ts                    # Council-specific types
├── supervisors/
│   ├── index.ts                      # Supervisor registry
│   ├── BaseSupervisor.ts             # Abstract base class
│   ├── OpenAISupervisor.ts           # GPT-4 adapter
│   ├── AnthropicSupervisor.ts        # Claude adapter
│   └── GenericOpenAISupervisor.ts    # Other OpenAI-compatible
├── managers/
│   ├── SupervisorCouncilManager.ts   # Core debate engine
│   ├── DynamicSelectionManager.ts    # Team selection
│   ├── HumanVetoManager.ts           # Veto queue
│   ├── DebateTemplateManager.ts      # Templates
│   ├── SmartPilotManager.ts          # Auto-continue
│   ├── CollaborativeDebateManager.ts # Multi-human
│   ├── FineTunedModelManager.ts      # Custom models
│   └── CouncilPluginManager.ts       # External plugins
├── services/
│   ├── DebateHistoryService.ts       # Debate persistence
│   ├── SupervisorAnalyticsService.ts # Analytics
│   └── QuotaService.ts               # Rate limiting
└── routes/
    ├── councilRoutes.ts              # /api/council/*
    ├── vetoRoutes.ts                 # /api/veto/*
    ├── dynamicSelectionRoutes.ts     # /api/dynamic-selection/*
    ├── debateHistoryRoutes.ts        # /api/debate-history/*
    ├── analyticsRoutes.ts            # /api/supervisor-analytics/*
    └── templateRoutes.ts             # /api/templates/*
```

---

## API Endpoint Mapping

### Keep Same Paths (Backward Compatible)
All opencode-autopilot API paths should remain the same for UI compatibility:

```
/api/council/status          → SupervisorCouncilManager.getStatus()
/api/council/debate          → SupervisorCouncilManager.debate()
/api/council/toggle          → SupervisorCouncilManager.toggle()
/api/council/supervisors     → SupervisorCouncilManager.addSupervisors()
/api/council/consensus-mode  → SupervisorCouncilManager.setConsensusMode()
/api/veto/pending            → HumanVetoManager.getPending()
/api/veto/pending/:id/approve → HumanVetoManager.approve()
/api/dynamic-selection/select → DynamicSelectionManager.select()
/api/debate-history/list     → DebateHistoryService.list()
/api/supervisor-analytics/*  → SupervisorAnalyticsService.*
```

---

## Testing Strategy

### Unit Tests to Migrate
```
FROM: submodules/opencode-autopilot/packages/server/src/services/__tests__/
TO:   packages/core/src/__tests__/council/

- council.test.ts (18 tests)
- dynamic-supervisor-selection.test.ts (15 tests)
- human-veto.test.ts (12 tests)
- debate-history.test.ts (10 tests)
- supervisor-analytics.test.ts (25 tests)
- collaborative-debate-manager.test.ts (30 tests)
- fine-tuned-model-manager.test.ts (33 tests)
```

### Integration Tests
- Full debate flow with mock supervisors
- Veto approval/rejection flow
- Analytics data aggregation
- Template-based debates

---

## Configuration

### Environment Variables (Already in Borg)
```bash
OPENAI_API_KEY          # Used by OpenAISupervisor
ANTHROPIC_API_KEY       # Used by AnthropicSupervisor
DEEPSEEK_API_KEY        # Used by GenericOpenAISupervisor
GEMINI_API_KEY          # Used by GenericOpenAISupervisor
GROK_API_KEY            # Used by GenericOpenAISupervisor
QWEN_API_KEY            # Used by GenericOpenAISupervisor
KIMI_API_KEY            # Used by GenericOpenAISupervisor
```

### New Config Options
```typescript
// In Borg config
council: {
  enabled: true,
  debateRounds: 2,
  consensusThreshold: 0.7,
  consensusMode: 'weighted',
  weightedVoting: true,
  smartPilot: false,
  vetoTimeout: 300000, // 5 minutes
  defaultSupervisors: ['GPT-4o', 'Claude']
}
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing Borg functionality | High | Test each phase independently |
| API incompatibility with UI | Medium | Keep same endpoint paths |
| Performance regression | Medium | Use Borg's existing caching/pooling |
| Missing edge cases | Low | Port existing tests |

---

## Quick Reference Commands

```bash
# Borg project root
cd C:\Users\hyper\workspace\borg

# Start Borg core dev
cd packages/core && bun run dev

# Run Borg core tests
cd packages/core && bun test

# View opencode-autopilot source
cd submodules/opencode-autopilot/packages/server/src

# Typecheck
bun run typecheck
```

---

## Summary

**Total Estimated Effort**: 2-3 days for full integration

**Key Success Metrics**:
1. All 407 tests pass (migrated from opencode-autopilot)
2. Debate flow works end-to-end
3. Dashboard shows council data from new endpoints
4. No separate process spawning required
5. Unified port (3002) for all functionality

**Next Step**: Switch to Borg session and begin Phase 1 (Core Council integration)
