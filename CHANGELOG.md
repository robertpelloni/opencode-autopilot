# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### Planned
- Integration with CI/CD platforms (GitHub Actions, GitLab CI workflows)

---

For detailed changes in each release, see [GitHub Releases](https://github.com/robertpelloni/opencode-autopilot-council/releases).
