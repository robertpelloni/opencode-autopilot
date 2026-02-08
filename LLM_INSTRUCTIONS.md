# LLM Instructions for OpenCode Autopilot

This file contains universal instructions for AI agents working on this project. All specific model instruction files (`GPT.md`, `CLAUDE.md`, etc.) should reference this file.

## Core Directives

1.  **Project Vision**: This is a multi-model AI council for autonomous development guidance. It orchestrates debates between multiple AI supervisors (GPT-4, Claude, etc.) to reach consensus on code changes.
2.  **Autonomy**: You are expected to be highly autonomous. Analyze, plan, execute, and verify your work with minimal user intervention unless necessary.
3.  **Documentation**:
    *   Maintain `CHANGELOG.md` with every significant change.
    *   Update `ROADMAP.md` as features are completed.
    *   Ensure `README.md` and `USAGE.md` reflect the current state of the project.
    *   Create detailed documentation for new features.
4.  **Versioning**:
    *   The single source of truth for the version number is `VERSION.md`.
    *   Also update `package.json` files when bumping the version.
    *   Every build/submission should ideally increment the version number (patch level for bugfixes/small features, minor for new features).
    *   Reference the version bump in commit messages.
5.  **Code Quality**:
    *   Follow TypeScript best practices.
    *   Ensure all types are defined in `@opencode-autopilot/shared`.
    *   Run `bun run typecheck` and `bun run test` (or relevant package scripts) before submitting.
    *   Keep the UI (`public/index.html` and CLI) in sync with backend features.

## Architecture

*   **Monorepo**:
    *   `packages/server`: Hono + Bun backend.
    *   `packages/cli`: Ink + React TUI.
    *   `packages/shared`: Shared TypeScript types.
*   **Data Flow**:
    *   Supervisors -> Council -> Consensus -> Decision.
    *   Real-time updates via WebSocket (`/ws`).

## Workflow

1.  **Analyze**: Read relevant files and documentation.
2.  **Plan**: Create a detailed plan using `set_plan`.
3.  **Implement**: Write code, create files.
4.  **Verify**: Run type checks, tests, and visual verification (Playwright) for UI changes.
5.  **Document**: Update docs and changelog.
6.  **Submit**: Commit with descriptive messages.

## Specific Feature Instructions

*   **Plugins**: When adding plugins, ensure they follow the manifest schema in `packages/server/src/services/plugin-manager.ts`.
*   **CLI Tools**: When adding support for new CLI tools, update `packages/shared/src/types.ts`, `packages/server/src/services/cli-registry.ts`, and `packages/server/src/services/environment-manager.ts`.
