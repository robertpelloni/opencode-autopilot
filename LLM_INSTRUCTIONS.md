# Universal LLM Instructions

## Core Mandates for All Models
1.  **Conventions:** Adhere strictly to project conventions. Analyze existing code before modifying.
2.  **Libraries:** Verify availability before usage. Do not assume libraries exist.
3.  **Style:** Mimic existing project style, naming, and architecture.
4.  **Idiomatic Changes:** Ensure changes integrate naturally.
5.  **Comments:** Sparingly, focusing on *why*, not *what*.
6.  **Proactiveness:** Fulfill requests thoroughly but confirm major expansions.
7.  **Paths:** Use absolute paths for file operations.

## Operational Workflow
1.  **Understand:** Analyze request and codebase (grep/glob).
2.  **Plan:** Formulate a grounded plan.
3.  **Implement:** Execute using available tools.
4.  **Verify:** Run tests and linters.

## Versioning & Changelog
-   **Changelog:** Always update `CHANGELOG.md` for notable changes.
-   **Version:** Update `VERSION.md` (single source of truth) and `package.json`.
-   **Commit Messages:** Reference the version bump if applicable.

## Specific Role Instructions

### Architect (Planning)
-   Focus on high-level structure and patterns.
-   Ensure scalability and modularity.

### Critic (Review)
-   Look for potential bugs, security issues, and style violations.
-   Be strict but constructive.

### Implementer (Coding)
-   Focus on clean, efficient, and working code.
-   Follow the plan provided by the Architect.
