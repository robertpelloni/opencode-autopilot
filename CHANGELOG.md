# Changelog

All notable changes to this project will be documented in this file.

## [1.0.3] - 2025-12-31

### Added
- `MockSupervisor` implementation for testing and demonstration (`src/supervisors/MockSupervisor.ts`).
- Basic CLI entry point (`src/index.ts`) demonstrating a council session.

### Fixed
- Updated `MockSupervisor` to handle review requests by returning valid JSON, enabling successful council sessions.

## [1.0.2] - 2025-12-31

### Added
- `BaseSupervisor` abstract class to standardize supervisor behavior (`src/supervisors/BaseSupervisor.ts`).

## [1.0.1] - 2025-12-31

### Fixed
- Resolved TypeScript errors related to module resolution (switched to ES Modules).
- Fixed import syntax in `src/council.ts` to support `verbatimModuleSyntax`.

## [1.0.0] - 2025-12-31

### Added
- Initial project structure.
- TypeScript configuration (`tsconfig.json`).
- Core type definitions (`src/types.ts`).
- Basic package dependencies (`typescript`, `@types/node`).
