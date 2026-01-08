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

### Planned
- Automated test suite
- Webhook notifications
- Debate history persistence
- Web UI for council management
- Support for more AI providers
- Advanced voting algorithms
- Performance optimizations
- Rate limiting and retry logic
- Metrics and analytics
- Integration with CI/CD platforms

---

For detailed changes in each release, see [GitHub Releases](https://github.com/robertpelloni/opencode-autopilot-council/releases).
