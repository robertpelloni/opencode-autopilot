# OpenCode Autopilot Council

An OpenCode plugin that uses multiple AI models (GPT, Claude, Gemini, Grok, DeepSeek, Qwen, Kimi, etc.) as "supervisors" to discuss and guide the development process through a council-based approach.

## Features

- 🏛️ **Multi-Model Council**: Add multiple AI models as supervisors
- 🗳️ **Democratic Debate**: Supervisors discuss and vote on code changes
- 🔄 **Automatic Monitoring**: Hooks into file edits and tool executions
- 🎯 **Consensus-Based Decisions**: Configurable voting thresholds
- 🔌 **Multiple Providers**: Supports OpenAI, Anthropic, Gemini, Grok, DeepSeek, Qwen, Kimi, and more
- 🛠️ **Custom Commands**: Manually trigger debates and check council status

## Installation

```bash
npm install opencode-autopilot-council
```

Or for development:

```bash
git clone <repository-url>
cd opencode-autopilot-council
npm install
npm run build
```

## Configuration

Create a `.opencode/council.json` file in your project root:

```json
{
  "supervisors": [
    {
      "name": "ChatGPT",
      "provider": "openai",
      "model": "gpt-4",
      "systemPrompt": "You are a senior software engineer reviewing code changes."
    },
    {
      "name": "Claude",
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022",
      "systemPrompt": "You are an expert code reviewer focusing on best practices and security."
    },
    {
      "name": "DeepSeek",
      "provider": "deepseek",
      "model": "deepseek-chat",
      "baseURL": "https://api.deepseek.com",
      "systemPrompt": "You are a code quality expert."
    }
  ],
  "debateRounds": 2,
  "autoApprove": false,
  "consensusThreshold": 0.5
}
```

### Configuration Options

- **supervisors**: Array of supervisor configurations
  - `name`: Display name for the supervisor
  - `provider`: AI provider (openai, anthropic, gemini, grok, deepseek, qwen, kimi)
  - `model`: Model name to use
  - `apiKey`: (Optional) API key - defaults to environment variable
  - `baseURL`: (Optional) Custom API endpoint for OpenAI-compatible providers
  - `systemPrompt`: (Optional) Custom system prompt for the supervisor

- **debateRounds**: Number of debate rounds (default: 2)
- **autoApprove**: Automatically approve changes that meet consensus (default: false)
- **consensusThreshold**: Percentage of approvals needed (default: 0.5 = 50%)

## Environment Variables

Set API keys as environment variables:

```bash
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
export GEMINI_API_KEY="your-gemini-key"
export GROK_API_KEY="your-grok-key"
export DEEPSEEK_API_KEY="your-deepseek-key"
export QWEN_API_KEY="your-qwen-key"
export KIMI_API_KEY="your-kimi-key"
```

## Usage

### Automatic Monitoring

Once configured, the council automatically monitors:

- File edits
- Code creation
- Tool executions

When changes are detected, supervisors:
1. Review the change independently
2. Debate through multiple rounds
3. Cast final votes
4. Reach a consensus decision

### Manual Commands

Use custom commands to interact with the council:

#### Check Council Status
```
council_status
```

#### Trigger Manual Debate
```
council_debate topic="Should we refactor the authentication module?"
```

#### Toggle Council Monitoring
```
council_toggle enabled=false
```

## Supported Providers

### OpenAI (ChatGPT)
```json
{
  "name": "ChatGPT",
  "provider": "openai",
  "model": "gpt-4"
}
```

### Anthropic (Claude)
```json
{
  "name": "Claude",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022"
}
```

### Google (Gemini)
```json
{
  "name": "Gemini",
  "provider": "gemini",
  "model": "gemini-pro",
  "baseURL": "https://generativelanguage.googleapis.com"
}
```

### xAI (Grok)
```json
{
  "name": "Grok",
  "provider": "grok",
  "model": "grok-beta",
  "baseURL": "https://api.x.ai/v1"
}
```

### DeepSeek
```json
{
  "name": "DeepSeek",
  "provider": "deepseek",
  "model": "deepseek-chat",
  "baseURL": "https://api.deepseek.com"
}
```

### Alibaba (Qwen)
```json
{
  "name": "Qwen",
  "provider": "qwen",
  "model": "qwen-turbo",
  "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1"
}
```

### Moonshot (Kimi)
```json
{
  "name": "Kimi",
  "provider": "kimi",
  "model": "moonshot-v1-8k",
  "baseURL": "https://api.moonshot.cn/v1"
}
```

## How It Works

1. **Initialization**: Plugin loads and reads council configuration
2. **Monitoring**: Hooks into OpenCode events for file edits and tool executions
3. **Debate Process**:
   - Round 1: Each supervisor provides initial opinion
   - Round 2+: Supervisors consider others' opinions and refine their stance
   - Final Vote: Each supervisor casts an approval/rejection vote
4. **Consensus**: Votes are tallied and compared against the threshold
5. **Action**: Changes are approved or flagged based on consensus

## Example Output

```
🏛️  OpenCode Autopilot Council Plugin loaded
✓ Council initialized with supervisors: ChatGPT, Claude, DeepSeek

🔍 Council reviewing edit operation...

🗳️  Council Debate - Round 1: Initial Opinions

📢 ChatGPT (openai) is evaluating...
✓ ChatGPT: The code changes look good, following best practices...

📢 Claude (anthropic) is evaluating...
✓ Claude: I have some concerns about error handling...

📢 DeepSeek (deepseek) is evaluating...
✓ DeepSeek: The implementation is solid but could benefit from...

🗳️  Council Debate - Round 2: Deliberation

📢 ChatGPT is deliberating...
✓ ChatGPT: Considering Claude's points about error handling...

🗳️  Council Debate - Final Voting

🗳️  ChatGPT is casting final vote...
✓ ChatGPT: APPROVED

🗳️  Claude is casting final vote...
✓ Claude: REJECTED

🗳️  DeepSeek is casting final vote...
✓ DeepSeek: APPROVED

📊 Voting Results: 2/3 approved (67%)
Decision: ✅ APPROVED

✅ Council approved this change
```

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run watch
```

### Testing
```bash
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT

## Credits

Built for OpenCode - The AI-powered development environment.