# OpenCode Autopilot

A multi-model AI council for autonomous development guidance. Multiple AI supervisors debate and vote on code changes through a democratic process.

## Architecture

```
packages/
├── server/     # Hono + Bun backend API
├── cli/        # Ink (React) terminal UI  
└── shared/     # TypeScript types
```

## Features

- **Multi-Model Council**: GPT-4, Claude, Gemini, DeepSeek, Grok, Qwen, Kimi
- **Weighted Voting**: Supervisor weights + confidence scores
- **Smart Pilot**: Auto-continue when council approves
- **Hook System**: Intercept debate/guidance flow via webhooks
- **TUI Dashboard**: Real-time supervisor status and debate history
- **WebSocket Updates**: Live streaming of debates and decisions

## Quick Start

```bash
# Install dependencies
bun install

# Set at least one API key
export OPENAI_API_KEY="sk-..."

# Start server
cd packages/server && bun run dev

# In another terminal, start CLI
cd packages/cli && bun run dev
```

## Environment Variables

### Supervisor API Keys (auto-registers supervisors)
```bash
OPENAI_API_KEY          # GPT-4o supervisor
ANTHROPIC_API_KEY       # Claude supervisor  
DEEPSEEK_API_KEY        # DeepSeek supervisor
GEMINI_API_KEY          # Gemini supervisor
GROK_API_KEY            # Grok supervisor (or XAI_API_KEY)
QWEN_API_KEY            # Qwen supervisor
KIMI_API_KEY            # Kimi supervisor (or MOONSHOT_API_KEY)
```

### Server Configuration
```bash
AUTOPILOT_PORT=3847           # API server port
AUTOPILOT_HOST=0.0.0.0        # Bind address
AUTOPILOT_BASE_PORT=4096      # Session base port
AUTOPILOT_DEBATE_ROUNDS=2     # Number of debate rounds
AUTOPILOT_CONSENSUS=0.7       # Consensus threshold (70%)
AUTOPILOT_SMART_PILOT=false   # Enable auto-continue
```

## API Endpoints

### Council
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/council/status` | Get council status and config |
| POST | `/api/council/debate` | Trigger debate on a task |
| POST | `/api/council/toggle` | Enable/disable council |
| POST | `/api/council/add-mock` | Add mock supervisor (testing) |
| POST | `/api/council/supervisors` | Add real supervisors |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/active` | List active sessions |
| POST | `/api/sessions/start` | Start new session |
| POST | `/api/sessions/:id/stop` | Stop session |
| POST | `/api/sessions/:id/guidance` | Send guidance to session |

### Smart Pilot
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/smart-pilot/status` | Get smart pilot status |
| POST | `/api/smart-pilot/toggle` | Toggle auto-continue |
| POST | `/api/smart-pilot/config` | Update settings |

### Hooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hooks` | List registered hooks |
| POST | `/api/hooks/register` | Register webhook |
| DELETE | `/api/hooks/:id` | Unregister hook |

### WebSocket
Connect to `ws://localhost:3847/ws` for real-time updates:
- `session_update` - Session status changes
- `council_decision` - Debate results
- `log` - Log entries
- `error` - Error messages

## CLI Usage

```bash
# Start TUI dashboard
cd packages/cli && bun run dev
```

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `1` | Dashboard view |
| `2` | Logs view |
| `3` | Council view |
| `4` | Smart Pilot view |
| `r` | Refresh |
| `t` | Toggle council |
| `p` | Toggle smart pilot |
| `q` | Quit |

## Weighted Voting

Each supervisor has:
- **Weight** (0-2x): Prioritizes certain supervisors
- **Confidence** (0-1): Self-reported certainty in vote

**Weighted Consensus Formula:**
```
consensus = Σ(approved × weight × confidence) / Σ(weight)
```

Strong dissent (rejection with confidence > 0.7) blocks auto-approval.

## Hook System

Register webhooks to intercept the debate flow:

```bash
# Register a pre-debate hook
curl -X POST http://localhost:3847/api/hooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "phase": "pre-debate",
    "webhookUrl": "http://my-service/hook",
    "priority": 10
  }'
```

**Hook Phases:**
- `pre-debate` - Before debate starts (can block)
- `post-debate` - After debate, before guidance (can modify decision)
- `pre-guidance` - Before sending guidance (can modify)
- `post-guidance` - After guidance sent
- `on-error` - On error during flow

**Webhook Response Format:**
```json
{
  "continue": true,
  "modifiedGuidance": { ... },
  "modifiedDecision": { ... },
  "reason": "Optional explanation"
}
```

## Testing

```bash
# Run unit tests (18 council tests)
cd packages/server && bun test src/services/__tests__/

# Run integration tests (13 API tests, requires running server)
cd packages/server && bun test src/__tests__/

# Run E2E test
bun run scripts/test-e2e.ts
```

## Development

```bash
# Typecheck all packages
bun run typecheck

# Build shared types
cd packages/shared && bun run build

# Dev server with hot reload
cd packages/server && bun run dev

# Dev CLI with hot reload
cd packages/cli && bun run dev
```

## Supervisor Configuration

### Adding via API
```bash
curl -X POST http://localhost:3847/api/council/supervisors \
  -H "Content-Type: application/json" \
  -d '{
    "supervisors": [{
      "name": "GPT-4o",
      "provider": "openai",
      "model": "gpt-4o",
      "weight": 1.5
    }]
  }'
```

### Adding via Config File
Create `.autopilot/config.json`:
```json
{
  "council": {
    "supervisors": [
      {
        "name": "GPT-4o",
        "provider": "openai",
        "model": "gpt-4o",
        "weight": 1.5
      },
      {
        "name": "Claude",
        "provider": "anthropic",
        "model": "claude-3-5-sonnet-20241022",
        "weight": 1.0
      }
    ],
    "debateRounds": 2,
    "consensusThreshold": 0.7,
    "weightedVoting": true,
    "smartPilot": false
  }
}
```

## License

MIT
