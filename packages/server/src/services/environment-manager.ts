import type { CLIType } from '@opencode-autopilot/shared';

interface EnvironmentConfig {
  inherit: boolean;
  variables: Record<string, string>;
  secrets: string[];
  passthrough: string[];
}

interface SessionEnvironment {
  sessionId: string;
  cliType: CLIType;
  config: EnvironmentConfig;
  resolved: Record<string, string>;
}

const DEFAULT_PASSTHROUGH_VARS = [
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'TERM',
  'LANG',
  'LC_ALL',
  'TMPDIR',
  'TMP',
  'TEMP',
  'NODE_ENV',
  'BUN_ENV',
];

const CLI_SPECIFIC_VARS: Record<CLIType, string[]> = {
  opencode: ['OPENCODE_*', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY'],
  claude: ['ANTHROPIC_API_KEY', 'CLAUDE_*'],
  aider: ['AIDER_*', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY'],
  cursor: ['CURSOR_*', 'OPENAI_API_KEY'],
  continue: ['CONTINUE_*', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
  cody: ['SRC_*', 'CODY_*'],
  copilot: ['GITHUB_*', 'GH_*'],
  custom: [],
};

class EnvironmentManager {
  private sessions: Map<string, SessionEnvironment> = new Map();
  private globalOverrides: Record<string, string> = {};
  private globalSecrets: Set<string> = new Set();

  setGlobalOverride(key: string, value: string): void {
    this.globalOverrides[key] = value;
  }

  removeGlobalOverride(key: string): void {
    delete this.globalOverrides[key];
  }

  addGlobalSecret(key: string): void {
    this.globalSecrets.add(key);
  }

  createSessionEnvironment(
    sessionId: string,
    cliType: CLIType,
    config?: Partial<EnvironmentConfig>
  ): Record<string, string> {
    const envConfig: EnvironmentConfig = {
      inherit: config?.inherit ?? true,
      variables: config?.variables ?? {},
      secrets: config?.secrets ?? [],
      passthrough: config?.passthrough ?? [],
    };

    const resolved = this.resolveEnvironment(cliType, envConfig);

    this.sessions.set(sessionId, {
      sessionId,
      cliType,
      config: envConfig,
      resolved,
    });

    return resolved;
  }

  private resolveEnvironment(cliType: CLIType, config: EnvironmentConfig): Record<string, string> {
    const result: Record<string, string> = {};

    if (config.inherit) {
      const passthroughPatterns = [
        ...DEFAULT_PASSTHROUGH_VARS,
        ...config.passthrough,
        ...CLI_SPECIFIC_VARS[cliType],
      ];

      for (const [key, value] of Object.entries(process.env)) {
        if (value && this.matchesPattern(key, passthroughPatterns)) {
          result[key] = value;
        }
      }
    }

    for (const [key, value] of Object.entries(this.globalOverrides)) {
      result[key] = value;
    }

    for (const [key, value] of Object.entries(config.variables)) {
      result[key] = this.expandVariables(value, result);
    }

    return result;
  }

  private matchesPattern(key: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        if (key.startsWith(prefix)) return true;
      } else if (pattern === key) {
        return true;
      }
    }
    return false;
  }

  private expandVariables(value: string, env: Record<string, string>): string {
    return value.replace(/\$\{(\w+)\}/g, (_, varName) => {
      return env[varName] || process.env[varName] || '';
    });
  }

  getSessionEnvironment(sessionId: string): Record<string, string> | undefined {
    return this.sessions.get(sessionId)?.resolved;
  }

  updateSessionVariable(sessionId: string, key: string, value: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.config.variables[key] = value;
    session.resolved[key] = this.expandVariables(value, session.resolved);
  }

  removeSessionVariable(sessionId: string, key: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    delete session.config.variables[key];
    delete session.resolved[key];
  }

  deleteSessionEnvironment(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getSanitizedEnvironment(sessionId: string): Record<string, string> {
    const session = this.sessions.get(sessionId);
    if (!session) return {};

    const result: Record<string, string> = {};
    const secretKeys = new Set([...session.config.secrets, ...this.globalSecrets]);

    for (const [key, value] of Object.entries(session.resolved)) {
      if (secretKeys.has(key) || this.looksLikeSecret(key)) {
        result[key] = '***REDACTED***';
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private looksLikeSecret(key: string): boolean {
    const secretPatterns = [
      /api[_-]?key/i,
      /secret/i,
      /password/i,
      /token/i,
      /credential/i,
      /auth/i,
      /private[_-]?key/i,
    ];
    return secretPatterns.some(pattern => pattern.test(key));
  }

  getRequiredVarsForCLI(cliType: CLIType): string[] {
    const required: Record<CLIType, string[]> = {
      opencode: [],
      claude: ['ANTHROPIC_API_KEY'],
      aider: ['OPENAI_API_KEY'],
      cursor: [],
      continue: [],
      cody: ['SRC_ACCESS_TOKEN'],
      copilot: ['GITHUB_TOKEN'],
      custom: [],
    };
    return required[cliType];
  }

  validateEnvironmentForCLI(cliType: CLIType, env: Record<string, string>): { valid: boolean; missing: string[] } {
    const required = this.getRequiredVarsForCLI(cliType);
    const missing = required.filter(key => !env[key]);
    return { valid: missing.length === 0, missing };
  }
}

export const environmentManager = new EnvironmentManager();
