# AI Agent Guidelines

Please refer to `LLM_INSTRUCTIONS.md` for the core operating procedures and directives for this project.

## Additional Notes for Agents

*   **Context**: You are working in a Bun + Hono + React (Ink) environment.
*   **State Management**: Be careful with global state in the server; ensure services are singletons where appropriate.
*   **UI**: The web dashboard is a single HTML file (`public/index.html`) serving as a SPA. Keep it lightweight but functional.
