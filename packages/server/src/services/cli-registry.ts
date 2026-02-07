import type { CLITool, CLIType } from '@opencode-autopilot/shared';
import { spawn } from 'child_process';

interface CLIDefinition {
  type: CLIType;
  name: string;
  command: string;
  serveArgs: string[];
  versionArgs: string[];
  healthEndpoint: string;
  detectCommands: string[];
  capabilities: string[];
}

const CLI_DEFINITIONS: CLIDefinition[] = [
  {
    type: 'opencode',
    name: 'OpenCode',
    command: 'opencode',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['opencode', 'npx opencode'],
    capabilities: ['serve', 'chat', 'edit', 'multi-file'],
  },
  {
    type: 'claude',
    name: 'Claude CLI',
    command: 'claude',
    serveArgs: ['--serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/api/health',
    detectCommands: ['claude'],
    capabilities: ['chat', 'code', 'analysis'],
  },
  {
    type: 'aider',
    name: 'Aider',
    command: 'aider',
    serveArgs: ['--serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['aider', 'python -m aider'],
    capabilities: ['chat', 'edit', 'git-aware', 'multi-file'],
  },
  {
    type: 'cursor',
    name: 'Cursor',
    command: 'cursor',
    serveArgs: ['--serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['cursor'],
    capabilities: ['ide', 'chat', 'edit'],
  },
  {
    type: 'continue',
    name: 'Continue',
    command: 'continue',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['continue'],
    capabilities: ['chat', 'autocomplete', 'edit'],
  },
  {
    type: 'cody',
    name: 'Sourcegraph Cody',
    command: 'cody',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['cody'],
    capabilities: ['chat', 'autocomplete', 'search'],
  },
  {
    type: 'copilot',
    name: 'GitHub Copilot CLI',
    command: 'github-copilot-cli',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['github-copilot-cli', 'gh copilot'],
    capabilities: ['explain', 'suggest', 'chat'],
  },
  {
    type: 'adrenaline',
    name: 'Adrenaline CLI',
    command: 'adrenaline',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['adrenaline'],
    capabilities: ['chat', 'explain', 'debug'],
  },
  {
    type: 'amazon-q',
    name: 'Amazon Q CLI',
    command: 'q',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['q', 'amazon-q'],
    capabilities: ['chat', 'aws', 'deploy'],
  },
  {
    type: 'amazon-q-developer',
    name: 'Amazon Q Developer CLI',
    command: 'q-developer',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['q-developer'],
    capabilities: ['chat', 'code', 'aws'],
  },
  {
    type: 'amp-code',
    name: 'Amp Code CLI',
    command: 'amp',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['amp'],
    capabilities: ['chat', 'edit', 'terminal'],
  },
  {
    type: 'auggie',
    name: 'Auggie CLI',
    command: 'auggie',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['auggie'],
    capabilities: ['chat', 'review', 'git'],
  },
  {
    type: 'azure-openai',
    name: 'Azure OpenAI CLI',
    command: 'az-openai',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['az-openai', 'az openai'],
    capabilities: ['chat', 'code', 'azure'],
  },
  {
    type: 'bito',
    name: 'Bito CLI',
    command: 'bito',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['bito'],
    capabilities: ['chat', 'code', 'explain'],
  },
  {
    type: 'byterover',
    name: 'Byterover CLI',
    command: 'byterover',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['byterover'],
    capabilities: ['chat', 'code', 'analyze'],
  },
  {
    type: 'claude-code',
    name: 'Claude Code CLI',
    command: 'claude-code',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['claude-code'],
    capabilities: ['chat', 'code', 'analyze'],
  },
  {
    type: 'code-codex',
    name: 'Code CLI (Codex fork)',
    command: 'code-codex',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['code-codex'],
    capabilities: ['chat', 'code', 'edit'],
  },
  {
    type: 'codebuff',
    name: 'Codebuff CLI',
    command: 'codebuff',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['codebuff'],
    capabilities: ['chat', 'code', 'refactor'],
  },
  {
    type: 'codemachine',
    name: 'Codemachine CLI',
    command: 'codemachine',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['codemachine'],
    capabilities: ['chat', 'code', 'generate'],
  },
  {
    type: 'codex',
    name: 'Codex CLI',
    command: 'codex',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['codex'],
    capabilities: ['chat', 'code'],
  },
  {
    type: 'crush',
    name: 'Crush CLI',
    command: 'crush',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['crush'],
    capabilities: ['chat', 'code', 'data'],
  },
  {
    type: 'dolt',
    name: 'Dolt CLI',
    command: 'dolt',
    serveArgs: ['sql-server', '--port'],
    versionArgs: ['version'],
    healthEndpoint: '/health',
    detectCommands: ['dolt'],
    capabilities: ['sql', 'version-control', 'data'],
  },
  {
    type: 'factory',
    name: 'Factory CLI',
    command: 'factory',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['factory'],
    capabilities: ['chat', 'code', 'build'],
  },
  {
    type: 'gemini',
    name: 'Gemini CLI',
    command: 'gemini',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['gemini'],
    capabilities: ['chat', 'code', 'multimodal'],
  },
  {
    type: 'goose',
    name: 'Goose CLI',
    command: 'goose',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['goose'],
    capabilities: ['chat', 'code', 'agent'],
  },
  {
    type: 'grok',
    name: 'Grok CLI',
    command: 'grok',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['grok'],
    capabilities: ['chat', 'code', 'realtime'],
  },
  {
    type: 'jules',
    name: 'Jules CLI',
    command: 'jules',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['jules'],
    capabilities: ['chat', 'code', 'agent'],
  },
  {
    type: 'kilo-code',
    name: 'Kilo Code CLI',
    command: 'kilo',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['kilo'],
    capabilities: ['chat', 'code', 'editor'],
  },
  {
    type: 'kimi',
    name: 'Kimi CLI',
    command: 'kimi',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['kimi'],
    capabilities: ['chat', 'code', 'long-context'],
  },
  {
    type: 'llm',
    name: 'LLM CLI',
    command: 'llm',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['llm'],
    capabilities: ['chat', 'code', 'local'],
  },
  {
    type: 'litellm',
    name: 'LiteLLM CLI',
    command: 'litellm',
    serveArgs: ['--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['litellm'],
    capabilities: ['proxy', 'chat', 'code'],
  },
  {
    type: 'llamafile',
    name: 'Llamafile CLI',
    command: 'llamafile',
    serveArgs: ['--server', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['llamafile'],
    capabilities: ['local', 'chat', 'code'],
  },
  {
    type: 'manus',
    name: 'Manus CLI',
    command: 'manus',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['manus'],
    capabilities: ['chat', 'code', 'agent'],
  },
  {
    type: 'mistral-vibe',
    name: 'Mistral Vibe CLI',
    command: 'mistral',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['mistral'],
    capabilities: ['chat', 'code', 'local'],
  },
  {
    type: 'ollama',
    name: 'Ollama CLI',
    command: 'ollama',
    serveArgs: ['serve'],
    versionArgs: ['--version'],
    healthEndpoint: '/api/health',
    detectCommands: ['ollama'],
    capabilities: ['local', 'chat', 'code'],
  },
  {
    type: 'open-interpreter',
    name: 'Open Interpreter CLI',
    command: 'interpreter',
    serveArgs: ['--server', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['interpreter', 'open-interpreter'],
    capabilities: ['code', 'execution', 'agent'],
  },
  {
    type: 'qwen-code',
    name: 'Qwen Code CLI',
    command: 'qwen',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['qwen'],
    capabilities: ['chat', 'code', 'local'],
  },
  {
    type: 'rowboatx',
    name: 'RowboatX CLI',
    command: 'rowboatx',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['rowboatx'],
    capabilities: ['chat', 'code', 'data'],
  },
  {
    type: 'rovo',
    name: 'Rovo CLI',
    command: 'rovo',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['rovo'],
    capabilities: ['chat', 'code', 'search'],
  },
  {
    type: 'shell-pilot',
    name: 'Shell Pilot CLI',
    command: 'shell-pilot',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['shell-pilot'],
    capabilities: ['chat', 'shell', 'automation'],
  },
  {
    type: 'smithery',
    name: 'Smithery CLI',
    command: 'smithery',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['smithery'],
    capabilities: ['chat', 'code', 'forge'],
  },
  {
    type: 'trae',
    name: 'Trae CLI',
    command: 'trae',
    serveArgs: ['serve', '--port'],
    versionArgs: ['--version'],
    healthEndpoint: '/health',
    detectCommands: ['trae'],
    capabilities: ['chat', 'code', 'review'],
  },
];

class CLIRegistry {
  private tools: Map<CLIType, CLITool> = new Map();
  private customTools: Map<string, CLITool> = new Map();
  private detectionPromise: Promise<void> | null = null;

  async detectAll(): Promise<CLITool[]> {
    if (this.detectionPromise) {
      await this.detectionPromise;
      return this.getAllTools();
    }

    this.detectionPromise = this.runDetection();
    await this.detectionPromise;
    return this.getAllTools();
  }

  private async runDetection(): Promise<void> {
    const detectionPromises = CLI_DEFINITIONS.map(async (def) => {
      const tool = await this.detectTool(def);
      if (tool) {
        this.tools.set(def.type, tool);
      }
    });

    await Promise.all(detectionPromises);
  }

  private async detectTool(def: CLIDefinition): Promise<CLITool | null> {
    for (const cmd of def.detectCommands) {
      try {
        const result = await this.runCommand(cmd, def.versionArgs);
        if (result.success) {
          return {
            type: def.type,
            name: def.name,
            command: cmd.split(' ')[0],
            args: def.serveArgs,
            healthEndpoint: def.healthEndpoint,
            detectCommand: cmd,
            available: true,
            version: this.parseVersion(result.output),
            capabilities: def.capabilities,
          };
        }
      } catch {
        continue;
      }
    }

    return {
      type: def.type,
      name: def.name,
      command: def.command,
      args: def.serveArgs,
      healthEndpoint: def.healthEndpoint,
      available: false,
      capabilities: def.capabilities,
    };
  }

  private runCommand(command: string, args: string[]): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const parts = command.split(' ');
      const cmd = parts[0];
      const cmdArgs = [...parts.slice(1), ...args];

      const proc = spawn(cmd, cmdArgs, {
        shell: true,
        timeout: 5000,
        windowsHide: true,
      });

      let output = '';
      proc.stdout?.on('data', (data) => { output += data.toString(); });
      proc.stderr?.on('data', (data) => { output += data.toString(); });

      proc.on('close', (code) => {
        resolve({ success: code === 0, output: output.trim() });
      });

      proc.on('error', () => {
        resolve({ success: false, output: '' });
      });

      setTimeout(() => {
        proc.kill();
        resolve({ success: false, output: '' });
      }, 5000);
    });
  }

  private parseVersion(output: string): string {
    const match = output.match(/v?(\d+\.\d+\.\d+)/);
    return match ? match[1] : 'unknown';
  }

  getTool(type: CLIType): CLITool | undefined {
    return this.tools.get(type);
  }

  getAvailableTools(): CLITool[] {
    return [...this.tools.values(), ...this.customTools.values()].filter(t => t.available);
  }

  getAllTools(): CLITool[] {
    return [...this.tools.values(), ...this.customTools.values()];
  }

  registerCustomTool(tool: CLITool): void {
    this.customTools.set(tool.name, tool);
  }

  unregisterCustomTool(name: string): boolean {
    return this.customTools.delete(name);
  }

  getServeCommand(type: CLIType, port: number): { command: string; args: string[] } | null {
    const tool = this.tools.get(type);
    if (!tool || !tool.available) return null;

    const args = [...tool.args];
    const portArgIndex = args.findIndex(a => a.includes('port'));
    if (portArgIndex >= 0) {
      args.splice(portArgIndex + 1, 0, String(port));
    } else {
      args.push(String(port));
    }

    return { command: tool.command, args };
  }

  getHealthEndpoint(type: CLIType): string {
    const tool = this.tools.get(type);
    return tool?.healthEndpoint || '/health';
  }

  async refreshDetection(): Promise<CLITool[]> {
    this.tools.clear();
    this.detectionPromise = null;
    return this.detectAll();
  }
}

export const cliRegistry = new CLIRegistry();
