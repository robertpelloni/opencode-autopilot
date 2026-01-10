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
