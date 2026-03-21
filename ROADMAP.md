# OpenCode Autopilot Roadmap

## Current Status: Version 1.0.14 (Completed)

### Phase 1: Core Foundation ✅
*   [x] Multi-model Supervisor Council (OpenAI, Anthropic, Gemini, etc.)
*   [x] Debate Protocol (Rounds, Consensus, Voting)
*   [x] CLI Tool (Ink-based TUI)
*   [x] Configuration System

### Phase 2: Services & Logic ✅
*   [x] Smart Pilot (Auto-polling, Task Detection)
*   [x] Quota Manager (Rate Limits, Budgeting)
*   [x] Health Monitor (Session Recovery)
*   [x] Log Rotation
*   [x] Environment Manager (Secrets, Overrides)

### Phase 3: Advanced Capabilities ✅
*   [x] Dynamic Supervisor Selection (Task-based teams)
*   [x] Debate Simulator (Replay, What-if Analysis)
*   [x] Collaborative Debates (Human participation)
*   [x] Fine-Tuned Models (Dataset mgmt, Training jobs)
*   [x] Workspaces (Multi-project isolation)
*   [x] Debate Templates (Custom workflows)

### Phase 4: Comprehensive UI (Web Dashboard) ✅
*   [x] **Dashboard Tab**: Real-time session monitoring, log streaming.
*   [x] **Analytics**: Chart.js based performance visualization.
*   [x] **Veto Center**: Notification bell, pending decision review.

### Phase 5: Distributed Borg Architecture 🚀 ✅
*   [x] **Terminal Sidecar**: Detached PTY processes for zero-downtime reliability.
*   [x] **Process Re-attachment**: Orchestrator can restart and re-link to active terminals.
*   [x] **Universal CLI Support**: 25+ tools integrated (Gemini, Copilot, Aider, etc.).
*   [x] **Dynamic Env Injection**: Inject secrets into running sessions via control socket.

### Phase 6: Swarm Intelligence 🐝 ✅
*   [x] **Parallel Swarm Execution**: Dependency-aware subtask scheduling.
*   [x] **Multi-Tool Orchestration**: Auto-routing tasks to the best CLI tool.
*   [x] **Binary State Checkpointing**: Snapshotting terminal buffers for cold-boot recovery.

### Phase 7: Self-Evolution 🧬 ✅
*   [x] **Meta-programming**: Council can modify and build its own source code.
*   [x] **Continuous Learning**: Auto-weighting supervisors based on performance.
*   [x] **Autonomous Git Workflow**: Auto-branching, testing, and merging.

### Phase 8: Visual Architecture 🗺️ ✅
*   [x] **Visual Planning**: Mermaid generation for system topology and swarm plans.
*   [x] **Diagram-to-Code**: Parsing Mermaid graphs into executable task plans.
*   [x] **Multi-Terminal Grid**: Visual log layout in the CLI dashboard.

---

## Future Roadmap

### Phase 9: Deep IDE Integration 🚧
*   [ ] VS Code Extension
*   [ ] JetBrains Plugin
*   [ ] Direct "Fix this file" context menu integration

### Phase 10: Hierarchical Councils 🏛️
*   [ ] Hierarchical Council structure (Regional specialized councils -> Supreme council)
*   [ ] Cross-org knowledge sharing
