# OpenCode Autopilot Council Plugin

A sophisticated multi-agent system that orchestrates a "council" of AI supervisors to provide comprehensive code review and development guidance.

## What is it?

This is an **OpenCode Plugin**. It adds a new tool called `consult_council` to your OpenCode environment.
When you ask OpenCode to "consult the council" or "review this project", it triggers this tool.

The tool leverages multiple Large Language Models (LLMs) acting as distinct supervisors (e.g., Architect, Reviewer, Critic). These supervisors discuss and debate the current state of your project, providing a synthesized and well-rounded guidance.

## Plugin vs SDK?

You asked about the difference:
- **Plugin** (This project): Extends OpenCode by adding tools and hooks. It runs *inside* OpenCode. Use this when you want the AI to have new capabilities.
- **SDK**: A client library to control OpenCode from an external script or app.

## Installation

### 1. Build the Plugin
```bash
npm install
npm run build
```

### 2. Install into OpenCode
To use this plugin locally, you need to reference it in your OpenCode configuration.

1.  Locate your OpenCode config directory (usually `~/.config/opencode` or `.opencode` in your project).
2.  Add this plugin to your `opencode.json` (or create a `package.json` in your `.opencode` folder and install it there, but for local development, linking is easier).

**Method A: Local Link (Recommended for dev)**
You can symlink this directory into your OpenCode plugins folder:
```bash
# Linux/macOS
ln -s /path/to/opencode-autopilot-council ~/.config/opencode/plugin/council

# Windows (PowerShell)
New-Item -ItemType Junction -Path "$HOME\.config\opencode\plugin\council" -Target "C:\path\to\opencode-autopilot-council"
```

**Method B: NPM Install**
If you publish this to npm, you can just add it to `opencode.json`:
```json
{
  "plugins": ["opencode-autopilot-council"]
}
```

## Configuration

The council needs API keys to function. Set these in your OpenCode environment or `.env` file.

```env
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GOOGLE_API_KEY=your_key
DEEPSEEK_API_KEY=your_key
```

## Usage

### Option 1: As a Plugin (Inside OpenCode)

Once installed, simply ask OpenCode:

> "Consult the council about the current state of the auth module."

The plugin will gather context and return a synthesized guidance report directly in the chat.

### Option 2: As an External Controller (SDK)

You can also run the council as a standalone process that "watches" your OpenCode session and injects advice.

1.  Ensure OpenCode is running.
2.  Run the controller:
    ```bash
    npm run controller
    ```
3.  The script will:
    - Connect to your running OpenCode instance.
    - Find the active session.
    - Analyze the recent chat history to understand your goal.
    - Run the Council deliberation.
    - **Post the advice back into your OpenCode chat automatically.**

## Project Structure

- `src/index.ts`: The Plugin entry point. Defines the `consult_council` tool.
- `src/controller.ts`: The SDK Controller script for external automation.
- `src/council.ts`: Core logic for the council and debate rounds.
- `src/supervisors/`: Implementations of different AI supervisors.
- `src/demo.ts`: A standalone script to test the council logic without OpenCode (run via `npm start`).

