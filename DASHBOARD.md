# Dashboard

## Project Structure
The project follows a standard TypeScript/Node.js structure.

- **`src/`**: Source code root.
  - **`council.ts`**: The core `Council` class that orchestrates discussions.
  - **`types.ts`**: Shared type definitions.
  - **`index.ts`**: Entry point for the CLI application.
  - **`supervisors/`**: Contains implementations for different LLM supervisors.
    - `BaseSupervisor.ts`: Abstract base class.
    - `MockSupervisor.ts`: Mock implementation for testing.
    - `OpenAISupervisor.ts`: Implementation for OpenAI models.
    - `AnthropicSupervisor.ts`: Implementation for Anthropic (Claude) models.
  - **`submodules/`**: Contains git submodules for reference and potential vendoring.

## Submodules
| Name | Path | Description | Version/Commit |
|------|------|-------------|----------------|
| `openai-node` | `src/submodules/openai-node` | Official OpenAI Node.js SDK | (See git status) |

## Supervisor Status
| Provider | Implementation Status | Class Name |
|----------|-----------------------|------------|
| **Mock** | ✅ Active | `MockSupervisor` |
| **OpenAI** | ✅ Active | `OpenAISupervisor` |
| **Anthropic** | ✅ Active | `AnthropicSupervisor` |
| **Google** | ⏳ Pending | - |
| **DeepSeek** | ⏳ Pending | - |

## Latest Build
- **Version**: 1.0.5
- **Date**: 2025-12-31
