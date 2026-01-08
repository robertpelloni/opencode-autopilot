# Project Handoff: OpenCode Council Orchestrator

**Date:** December 31, 2025
**Status:** Ready for Migration to aios

## 📋 Current State

We have successfully transformed the "Council Plugin" into a full "Council Orchestrator" web application.

### Completed Features
1.  **Web Interface**: `public/index.html` provides a dashboard to manage sessions.
2.  **Backend Server**: `src/server.ts` (Express) serves the UI and handles API requests.
3.  **Session Manager**: `src/session-manager.ts` handles:
    - Spawning `opencode` processes.
    - Connecting the OpenCode SDK to these processes.
    - Running the "Council Loop" for each active session.
4.  **Council Logic**: The multi-agent debate system (`src/council.ts`) is fully integrated into the session manager.
5.  **Google Gemini Fix**: The `GoogleSupervisor` has been patched to handle chat history role requirements.

## 🚧 Pending / Next Steps

1.  **Process Spawning**:
    - The `startSession` method in `src/session-manager.ts` assumes `opencode` is in your global PATH.
    - **Action**: Verify `opencode` command works in your terminal, or update the path in `session-manager.ts`.

2.  **Frontend Polish**:
    - The frontend is functional but basic.
    - **Action**: Add more real-time updates (currently polls or requires refresh).

3.  **Migration to aios**:
    - You are moving this to `workspace/aios/opencode-autopilot-council`.
    - **Action**:
        1.  Move this entire directory to the new location.
        2.  Run `npm install` in the new location.
        3.  Run `npm run build`.
        4.  Run `npm run server`.

## 🛠️ How to Run

```bash
# 1. Install dependencies
npm install

# 2. Build the project
npm run build

# 3. Start the Orchestrator
npm run server
```

Access the dashboard at: `http://localhost:3000`

## 📝 Notes for aios Integration

- This project is designed to be self-contained.
- It uses `dotenv` for configuration. Ensure your `.env` file is moved or recreated in the new location.
- The `SessionManager` currently stores session data in memory. If you restart the server, the session list is lost (though the actual OpenCode processes might still be running if not killed properly).
    - **Future Improvement**: Persist session list to a JSON file.

Good luck with the migration!
