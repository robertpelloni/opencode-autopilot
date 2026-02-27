# Agent Instructions

**Primary Reference:** Please consult `LLM_INSTRUCTIONS.md` for the comprehensive, universal developer guidelines, workflow protocols, and architectural standards for this project.

**Deep Analysis:** See `HANDOVER.md` for a detailed architectural breakdown, technical debt assessment, and strategic next steps.

## Project Specifics

*   **Repo Root:** `/home/jules/packages/server` is the main backend. `/home/jules/public` is the frontend.
*   **Running Tests:** `cd packages/server && bun test`
*   **Running Server:** `cd packages/server && bun run dev` (Port 3000 or 3847)
*   **Frontend Verification:** Always use Playwright scripts for UI changes.

## Model-Specific Instructions

See individual files if you are:
*   **Claude:** `CLAUDE.md`
*   **Gemini:** `GEMINI.md`
*   **GPT:** `GPT.md`
*   **Copilot:** `copilot-instructions.md`

**Goal:** Complete implementation of OpenCode Autopilot with 100% feature coverage, robust testing, and comprehensive UI.
