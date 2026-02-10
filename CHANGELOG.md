# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.11] - 2026-02-08

### Added
- **Collaborative Debate Detail View**: Full UI for participating in debates.
  - Real-time chat with message history.
  - Interactive voting interface with confidence slider and reasoning.
  - Live participant status and role display.
- **Debate Simulator Runner UI**:
  - Modal interface to configure and run simulations.
  - Support for selecting consensus mode, supervisors, and mock mode.
  - Instant result visualization (outcome, duration, reasoning).
- **System Submodules Management**:
  - Dynamic listing of git submodules with status indicators (clean/dirty).
  - Version tracking display.

## [1.0.10] - 2026-02-08

### Added
- **Debate Templates UI**: Full management interface in Web Dashboard.
  - Create new templates with JSON configuration editor.
  - Clone existing templates.
  - Delete custom templates.
  - View built-in vs custom templates.
- **Analytics Integration**:
  - Connected Council debates to Supervisor Analytics service.
  - Real-time vote recording and outcome tracking.
  - Fixed route mounting for `/api/analytics` endpoints.
  - Added "Analytics" button to main dashboard header.

### Fixed
- **Analytics Dashboard**: Updated API calls to match server routes.
- **Supervisor Analytics**: Fixed typo in `participationBySupervisor` field.
- **Vote Recording**: Added response time tracking to vote records.

## [1.0.9] - 2026-02-08

### Added
- **Collaborative Debates UI**:
  - New dashboard tab for managing multi-participant debates.
  - Creation modal for new collaborative sessions.
  - Status tracking and list view.
- **Debate Simulator UI**:
  - New dashboard tab for viewing and running simulations.
  - Integration with simulator service APIs.

## [1.0.8] - 2026-02-08

### Added
- **Enhanced Web Dashboard**:
  - New "System" tab showing project version and structure.
  - New "Dynamic Selection" tab for managing supervisor profiles.
  - New "Plugins" tab for enabling/disabling plugins.
  - Debate History view with detailed voting records.
  - Supervisor Configuration view for weight/status management.
  - Settings Modal for consensus configuration.
  - Help Modal with documentation.
- **Documentation Overhaul**:
  - Created `LLM_INSTRUCTIONS.md` as universal agent guidelines.
  - Updated `AGENTS.md`, `CLAUDE.md`, `GPT.md`, `GEMINI.md`.
  - Updated `VISION.md` and `ROADMAP.md`.
- **CI/CD Improvements**:
  - Fixed lint workflow to build shared packages before typechecking.
  - Updated test scripts to correctly handle monorepo structure.
  - Fixed TypeScript errors in `FineTunedSupervisor`.
- **CLI Updates**:
  - Added support for 40+ new CLI tools (Adrenaline, Amazon Q, etc.).
  - Updated `environment-manager` to handle new CLI configurations.

## [1.0.0] - 2025-12-31

### Added
- Initial release of OpenCode Autopilot Council plugin
- Multi-model supervisor support (OpenAI, Anthropic, Gemini, Grok, DeepSeek, Qwen, Kimi)
- Council-based debate system with configurable rounds
- Consensus voting mechanism with adjustable thresholds
- Automatic monitoring of file edits and tool executions
- OpenCode plugin hooks integration:
  - `tool.execute.after` for monitoring code changes
  - `event` handler for file edit events
  - `tool.register` for custom commands
- Custom commands:
  - `council_debate` - Manually trigger debates
  - `council_status` - Check council status
  - `council_toggle` - Enable/disable monitoring
- Configuration system via `.opencode/council.json`
- Support for custom system prompts per supervisor
- OpenAI-compatible API support for multiple providers
- Comprehensive documentation:
  - README.md with full feature list
  - USAGE.md with practical examples
  - CONTRIBUTING.md with development guidelines
- Example configurations for various use cases
- Demo script for testing and demonstration
- TypeScript support with full type definitions

### Architecture
- Modular supervisor implementation with factory pattern
- Abstract base class for easy provider extension
- Separate council orchestration logic
- Type-safe interfaces for all components

### Supported Providers
- OpenAI (ChatGPT) - Native SDK integration
- Anthropic (Claude) - Native SDK integration
- Google Gemini - OpenAI-compatible mode
- xAI Grok - OpenAI-compatible mode
- DeepSeek - OpenAI-compatible mode
- Alibaba Qwen - OpenAI-compatible mode
- Moonshot Kimi - OpenAI-compatible mode

### Features
- Multi-round debate system
- Independent supervisor opinions
- Iterative deliberation process
- Final voting with consensus calculation
- Detailed reasoning and vote tracking
- Environment variable based API key management
- Configurable debate parameters
- Rich console output with emojis and formatting

## [Unreleased]

### Added
- **Multi-CLI Support**: Auto-detection and management of CLI tools
  - Supports opencode, claude, aider, cursor, continue, cody, copilot
  - Version detection and capability scanning
  - Custom CLI tool registration via API
  - CLI registry service (`packages/server/src/services/cli-registry.ts`)
- **Session Health Monitoring**: Automatic health tracking with recovery
  - Periodic health checks with configurable intervals
  - Status transitions: healthy → degraded → unresponsive → crashed
  - Auto-recovery with exponential backoff
  - WebSocket notifications for health changes
  - Health monitor service (`packages/server/src/services/health-monitor.ts`)
- **Log Rotation**: Automatic log management
  - Max logs per session (configurable, default 1000)
  - Age-based pruning (configurable, default 24h)
  - Automatic cleanup on intervals
  - Log rotation service (`packages/server/src/services/log-rotation.ts`)
- **Environment Variable Management**: Per-session and global env vars
  - Per-session environment variables
  - Global environment variables
  - CLI-specific passthrough (API keys, configs)
  - Environment manager service (`packages/server/src/services/environment-manager.ts`)
- **Session Tags**: Organize and filter sessions
  - Add/remove/set tags via API
  - Tag-based filtering in dashboard
- **8 Consensus Modes**: Extended voting mechanisms
  - simple-majority, supermajority, unanimous, weighted
  - ceo-override, ceo-veto, hybrid-ceo-majority, ranked-choice
- **Session Templates**: Pre-configured session types
  - default, review, debug, feature templates
  - Custom template support
- **Session Persistence**: Auto-save and restore
  - Sessions saved to `.autopilot/sessions.json`
  - Automatic restoration on server start
- **Supervisor Fallback Chain**: Retry logic with fallback supervisors
- **New API Routes**:
  - `/api/cli/*` - CLI tool discovery and management
  - `/api/health/*` - Session health monitoring and stats
  - `/api/env/*` - Environment variable management
  - `/api/dynamic-selection/*` - Dynamic supervisor selection
  - `/api/veto/*` - Human-in-the-loop veto
  - `/api/plugins/*` - Plugin ecosystem management
  - `/api/debate-history/*` - Debate history persistence and export
  - `/api/sessions/:id/tags` - Session tag management
  - `/api/sessions/by-cli/:cliType` - Filter sessions by CLI type
  - `/api/sessions/templates` - List session templates
- **Dynamic Supervisor Selection**: Automatically select optimal team based on task type
  - 11 task types: security-audit, ui-design, api-design, performance, refactoring, bug-fix, testing, documentation, architecture, code-review, general
  - Keyword-based task detection with confidence scoring
  - 7 default supervisor profiles with strengths/weaknesses
  - 9 pre-configured team templates for common task types
  - Dynamic team composition based on available supervisors
  - Service: `packages/server/src/services/dynamic-supervisor-selection.ts`
- **Human-in-the-Loop Veto**: Developer acts as Council Chair with veto power
  - Enable/disable veto mode globally
  - Review pending council decisions before finalization
  - Approve, reject, or request re-debate
  - Configurable timeout with auto-approve option
  - Consensus threshold for auto-approval (high consensus bypasses veto)
  - Event-driven architecture with WebSocket notifications
  - Service: `packages/server/src/services/human-veto.ts`
- **Plugin Ecosystem**: Standardized interface for adding new models/supervisors
  - Plugin manifest schema (name, version, description, author, supervisors)
  - Load plugins from directory or inline manifest
  - Hot-reload support for development
  - Enable/disable individual plugins
  - Supervisor registry across all plugins
  - Validation and sample manifest generation
  - Service: `packages/server/src/services/plugin-manager.ts`
- **Debate History Persistence**: Save full debate transcripts to file
  - Auto-save debates after council decisions
  - Query debates with filters (session, task type, approval, supervisor, consensus range)
  - Supervisor voting history and patterns
  - Export to JSON or CSV
  - Configurable retention period and max records
  - Statistics and analytics
  - Service: `packages/server/src/services/debate-history.ts`
- **Enhanced Web Dashboard** (`public/index.html`):
  - CLI type selector in new session modal
  - Session template dropdown
  - Tag management with visual pills
  - Health status indicators (colored dots)
  - CLI tools panel in sidebar
  - Export dropdown (JSON/CSV/Text)
  - Bulk operations with CLI type selection

### Changed
- Session manager rewritten with full service integration
- Config service extended with health, logging, and environment sections
- WebSocket now broadcasts `session_health` events

### Added (CI/CD)
- **CI/CD Integration**: Automated testing and building pipelines
  - GitHub Actions workflow (`.github/workflows/ci.yml`)
    - Build all packages (shared, server, CLI)
    - Type checking across all packages
    - Run test suite
    - Triggered on push/PR to main/master
  - GitLab CI pipeline (`.gitlab-ci.yml`)
    - Multi-stage pipeline (build, test)
    - Artifact caching for faster builds
    - Coverage reporting support
    - Parallel job execution

### Added (Rate Limiting & Quota Management)
- **Quota Manager Service**: Complete API provider rate limiting and budget management
  - Per-provider rate limits (requests/minute, requests/hour, tokens/minute, tokens/day)
  - Default limits for 7 providers (OpenAI, Anthropic, Gemini, DeepSeek, Grok, Qwen, Kimi)
  - Daily budget tracking with configurable limits
  - Cost calculation per API call
  - Auto-throttling on rate limit errors with exponential backoff
  - Concurrent request limiting per provider
  - Event emission for alerts (budget warnings, throttling events)
  - REST API: `/api/quota/*`
  - Service: `packages/server/src/services/quota-manager.ts`

### Added (Supervisor Performance Analytics)
- **Supervisor Analytics Service**: Comprehensive performance tracking and insights
  - Vote recording with consensus agreement tracking
  - Per-supervisor metrics (approval rate, avg confidence, response time, tokens)
  - Supervisor comparison and ranking
  - Automated insight generation (warnings for low consensus, slow response)
  - Trend analysis over configurable time periods
  - Voting pattern analysis (distribution, hourly activity)
  - Agreement/disagreement streak tracking
  - REST API: `/api/analytics/*`
  - Service: `packages/server/src/services/supervisor-analytics.ts`

### Added (Debate Replay & Simulation)
- **Debate Simulator Service**: Replay past debates and run simulations
  - Store past debates for replay
  - Replay debates with different configurations (consensus mode, team composition)
  - Simulate debates with mock responses or randomized votes
  - What-if analysis (run multiple scenarios in parallel)
  - Compare all consensus modes on a single debate
  - Find optimal team composition for target outcome
  - 5 consensus calculators: majority, unanimous, supermajority, weighted, veto
  - REST API: `/api/simulator/*`
  - Service: `packages/server/src/services/debate-simulator.ts`

### Added (Multi-Workspace Support)
- **Workspace Manager Service**: Manage debates across multiple projects simultaneously
  - Create/update/delete workspaces with isolated configurations
  - Per-workspace config (consensus mode, debate rounds, supervisor team, budget limits)
  - Active workspace tracking (set/get/clear)
  - Debate tracking per workspace with concurrent limit enforcement
  - Workspace statistics and analytics
  - Cross-workspace comparison and ranking
  - Bulk operations (pause/resume all workspaces)
  - Config cloning between workspaces
  - Export/import workspaces with debate history
  - REST API: `/api/workspaces/*`
  - Service: `packages/server/src/services/workspace-manager.ts`

### Added (Debate Templates System)
- **Debate Template Manager Service**: Pre-configured debate structures for common scenarios
  - 6 built-in templates: Code Review, Security Audit, Architecture Review, Performance Review, API Design, Quick Review
  - Custom template creation/update/delete (built-in templates protected)
  - Template categories: code-review, security-audit, architecture-review, performance-review, api-design, testing-strategy, documentation, refactoring, custom
  - Template application with variable substitution (`{task}` placeholder)
  - Template matching/suggestion based on task description keywords
  - Scoring config with weights (correctness, security, performance, maintainability, testability, documentation)
  - Critical criteria enforcement
  - Template cloning, export/import
  - Usage tracking and statistics
  - REST API: `/api/templates/*`
  - Service: `packages/server/src/services/debate-template-manager.ts`

### Added (Model Fine-Tuning Integration)
- **Fine-Tuned Model Manager Service**: Support for custom fine-tuned models as supervisors
  - Training dataset management (create, update, delete, validate)
  - Training data formatting for OpenAI, Anthropic, custom providers
  - Fine-tune job lifecycle (create, start, cancel, monitor progress)
  - Job status tracking: pending, preparing, training, completed, failed, cancelled
  - Model registration from completed jobs or external sources
  - Model deployment states: inactive, deploying, active, deprecated, retired
  - Supervisor integration: create supervisors from deployed models
  - Performance tracking (approval rate, confidence, consensus alignment, response time)
  - Task-type specific performance metrics
  - Model comparison and best model selection per task type
  - Performance history with snapshots
  - Provider configuration (API keys, base URLs)
  - Export/import models with performance data
  - REST API: `/api/fine-tuned-models/*`
  - Service: `packages/server/src/services/fine-tuned-model-manager.ts`

### Added (Collaborative Debates)
- **Collaborative Debate Manager Service**: Multi-human participant debates with AI supervisor integration
  - Multi-participant debates with roles: owner, admin, voter, observer
  - Invite system with secure tokens (create invite, join with token, direct add)
  - Debate lifecycle: draft → inviting → waiting_for_participants → in_progress → voting → completed
  - Real-time messaging with replies and emoji reactions
  - Human voting with confidence scores, reasoning, concerns, and suggestions
  - AI supervisor vote integration (combine human + AI votes for final consensus)
  - Anonymous voting mode for unbiased decisions
  - Revoting support with vote history
  - Consensus calculation: strong (≥80%), moderate (≥60%), weak (≥50%), none (<50%)
  - Voting deadlines with automatic expiration
  - Participant statistics and debate analytics
  - Export/import collaborative debates
  - REST API: `/api/collaborative-debates/*`
  - Service: `packages/server/src/services/collaborative-debate-manager.ts`

### Added (Advanced Analytics Dashboard)
- **Analytics Dashboard**: Visual HTML dashboard for debate patterns and supervisor performance
  - Real-time performance statistics (supervisors, debates, votes, consensus rate, response time)
  - Debate outcome visualization (approved/rejected/deadlock breakdown)
  - Debate patterns: average rounds, duration, top consensus mode
  - Interactive charts using Chart.js:
    - Debate activity trends (bar chart)
    - Consensus rate over time (line chart)
    - Vote distribution (doughnut chart)
    - Response time by supervisor (horizontal bar chart)
    - Supervisor performance leaderboard with rankings (gold/silver/bronze badges)
    - Metrics: consensus agreement, confidence, response time, vote count, streaks
    - AI-generated insights section (warnings, recommendations, info)
    - Top performers highlight
    - Configurable time range filter (24h, 7d, 30d, 90d)
    - Auto-refresh every 30 seconds
  - Dark theme UI consistent with main dashboard
  - Dashboard URL: `/analytics`
  - Dashboard file: `public/analytics.html`

---

For detailed changes in each release, see [GitHub Releases](https://github.com/robertpelloni/opencode-autopilot-council/releases).
