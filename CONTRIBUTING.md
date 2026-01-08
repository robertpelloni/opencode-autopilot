# Contributing to OpenCode Autopilot Council

Thank you for considering contributing to OpenCode Autopilot Council! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Adding New Providers](#adding-new-providers)
- [Coding Standards](#coding-standards)

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect differing viewpoints and experiences

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/opencode-autopilot-council.git`
3. Add upstream remote: `git remote add upstream https://github.com/robertpelloni/opencode-autopilot-council.git`

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- TypeScript knowledge
- API keys for testing (optional but recommended)

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Watch mode for development
npm run watch
```

### Running Tests

```bash
# Run tests
npm test

# Run demo
node examples/demo.js
```

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feature/add-gemini-support`
- `fix/consensus-calculation`
- `docs/update-readme`
- `refactor/supervisor-factory`

### Commit Messages

Follow conventional commits:

```
feat: add support for Gemini API
fix: correct consensus threshold calculation
docs: update installation instructions
refactor: simplify supervisor initialization
test: add unit tests for council voting
```

## Testing

### Manual Testing

1. Set up test environment:
   ```bash
   export OPENAI_API_KEY="sk-test..."
   export ANTHROPIC_API_KEY="sk-ant-test..."
   ```

2. Run the demo:
   ```bash
   node examples/demo.js
   ```

3. Test specific features:
   ```bash
   # Test council status
   # Test debate functionality
   # Test different provider combinations
   ```

### Automated Testing

We welcome contributions for automated tests:
- Unit tests for individual components
- Integration tests for council debates
- Mock tests for API interactions

## Submitting Changes

### Pull Request Process

1. Update your fork:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. Make your changes and commit:
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

4. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

5. Open a Pull Request on GitHub

### PR Checklist

- [ ] Code builds successfully (`npm run build`)
- [ ] Changes are documented in README if needed
- [ ] Commit messages follow conventional commits
- [ ] Code follows existing style and conventions
- [ ] New files include appropriate headers/comments
- [ ] Examples updated if adding new features
- [ ] No unnecessary dependencies added

## Adding New Providers

To add support for a new AI provider:

### 1. Check if OpenAI-Compatible

Many providers use OpenAI-compatible APIs. If so, users can already use them:

```json
{
  "name": "NewProvider",
  "provider": "newprovider",
  "model": "model-name",
  "baseURL": "https://api.newprovider.com/v1"
}
```

### 2. Create Custom Supervisor (if needed)

If the provider requires custom integration:

```typescript
// src/models/newprovider.ts
import { BaseSupervisor } from './base';
import { Message } from '../types';
import NewProviderSDK from 'newprovider-sdk';

export class NewProviderSupervisor extends BaseSupervisor {
  private client: NewProviderSDK;

  constructor(config: any) {
    super(config);
    this.client = new NewProviderSDK({
      apiKey: this.apiKey,
    });
  }

  protected getApiKeyEnvVar(): string {
    return 'NEWPROVIDER_API_KEY';
  }

  async chat(messages: Message[]): Promise<string> {
    // Implement provider-specific logic
    const response = await this.client.chat({
      messages,
      model: this.model,
    });
    
    return response.text;
  }
}
```

### 3. Update Factory

Add to `src/models/index.ts`:

```typescript
case 'newprovider':
  return new NewProviderSupervisor(config);
```

### 4. Update Documentation

- Add provider to README.md
- Add example configuration
- Document environment variable
- Add to examples/council-all-providers.json

### 5. Test Integration

- Test with real API keys
- Verify debate flow works
- Check error handling
- Test with multiple rounds

## Coding Standards

### TypeScript

- Use strict TypeScript mode
- Define proper interfaces and types
- Avoid `any` type where possible
- Use async/await for promises

### Naming Conventions

- Classes: `PascalCase` (e.g., `SupervisorCouncil`)
- Functions: `camelCase` (e.g., `createSupervisor`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_ROUNDS`)
- Files: `kebab-case` (e.g., `supervisor-factory.ts`)

### File Organization

```
src/
├── models/          # AI provider implementations
├── council/         # Council orchestration logic
├── types/           # TypeScript type definitions
└── index.ts         # Plugin entry point
```

### Documentation

- Add JSDoc comments to public APIs
- Include usage examples in docstrings
- Keep README.md updated
- Document breaking changes

### Error Handling

- Use try-catch blocks for API calls
- Provide meaningful error messages
- Log errors appropriately
- Don't expose sensitive information

## Feature Requests

Have an idea? Great!

1. Check existing issues first
2. Open a new issue describing:
   - The problem you're solving
   - Your proposed solution
   - Any alternatives considered
   - Examples of usage

## Questions?

- Open an issue with the `question` label
- Check existing documentation
- Review example files

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes for significant contributions
- README.md for major features

Thank you for contributing! 🎉
