import type { CouncilConfig, SupervisorConfig } from '@opencode-autopilot/shared';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const CONFIG_DIR = process.env.AUTOPILOT_CONFIG_DIR || join(process.cwd(), '.autopilot');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export interface AutopilotConfig {
  council: CouncilConfig;
  server: {
    port: number;
    host: string;
    corsOrigins?: string;
  };
  sessions: {
    basePort: number;
    maxSessions: number;
    pollInterval: number;
  };
}

const DEFAULT_CONFIG: AutopilotConfig = {
  council: {
    supervisors: [],
    debateRounds: 2,
    consensusThreshold: 0.7,
    enabled: true,
    smartPilot: false,
  },
  server: {
    port: 3847,
    host: '0.0.0.0',
  },
  sessions: {
    basePort: 4096,
    maxSessions: 10,
    pollInterval: 10000,
  },
};

function loadSupervisorsFromEnv(): SupervisorConfig[] {
  const supervisors: SupervisorConfig[] = [];

  if (process.env.OPENAI_API_KEY) {
    supervisors.push({
      name: 'GPT-4o',
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    supervisors.push({
      name: 'Claude',
      provider: 'anthropic',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  if (process.env.DEEPSEEK_API_KEY) {
    supervisors.push({
      name: 'DeepSeek',
      provider: 'deepseek',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
  }

  if (process.env.GEMINI_API_KEY) {
    supervisors.push({
      name: 'Gemini',
      provider: 'gemini',
      model: process.env.GEMINI_MODEL || 'gemini-pro',
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  if (process.env.GROK_API_KEY || process.env.XAI_API_KEY) {
    supervisors.push({
      name: 'Grok',
      provider: 'grok',
      model: process.env.GROK_MODEL || 'grok-beta',
      apiKey: process.env.GROK_API_KEY || process.env.XAI_API_KEY,
    });
  }

  if (process.env.QWEN_API_KEY) {
    supervisors.push({
      name: 'Qwen',
      provider: 'qwen',
      model: process.env.QWEN_MODEL || 'qwen-plus',
      apiKey: process.env.QWEN_API_KEY,
    });
  }

  if (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY) {
    supervisors.push({
      name: 'Kimi',
      provider: 'kimi',
      model: process.env.KIMI_MODEL || 'moonshot-v1-8k',
      apiKey: process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY,
    });
  }

  return supervisors;
}

export function loadConfig(): AutopilotConfig {
  let config = { ...DEFAULT_CONFIG };

  if (existsSync(CONFIG_FILE)) {
    try {
      const fileContent = readFileSync(CONFIG_FILE, 'utf-8');
      const fileConfig = JSON.parse(fileContent) as Partial<AutopilotConfig>;
      config = {
        ...config,
        ...fileConfig,
        council: { ...config.council, ...fileConfig.council },
        server: { ...config.server, ...fileConfig.server },
        sessions: { ...config.sessions, ...fileConfig.sessions },
      };
    } catch {
      console.warn(`Failed to load config from ${CONFIG_FILE}, using defaults`);
    }
  }

  const envSupervisors = loadSupervisorsFromEnv();
  if (envSupervisors.length > 0) {
    const existingNames = new Set(config.council.supervisors.map(s => s.name));
    for (const sup of envSupervisors) {
      if (!existingNames.has(sup.name)) {
        config.council.supervisors.push(sup);
      }
    }
  }

  if (process.env.AUTOPILOT_PORT) {
    config.server.port = parseInt(process.env.AUTOPILOT_PORT);
  }
  if (process.env.AUTOPILOT_HOST) {
    config.server.host = process.env.AUTOPILOT_HOST;
  }
  if (process.env.AUTOPILOT_BASE_PORT) {
    config.sessions.basePort = parseInt(process.env.AUTOPILOT_BASE_PORT);
  }
  if (process.env.AUTOPILOT_DEBATE_ROUNDS) {
    config.council.debateRounds = parseInt(process.env.AUTOPILOT_DEBATE_ROUNDS);
  }
  if (process.env.AUTOPILOT_CONSENSUS) {
    config.council.consensusThreshold = parseFloat(process.env.AUTOPILOT_CONSENSUS);
  }
  if (process.env.AUTOPILOT_SMART_PILOT) {
    config.council.smartPilot = process.env.AUTOPILOT_SMART_PILOT === 'true';
  }

  return config;
}

export function saveConfig(config: AutopilotConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const sanitizedConfig = {
    ...config,
    council: {
      ...config.council,
      supervisors: config.council.supervisors.map(s => ({
        ...s,
        apiKey: undefined,
      })),
    },
  };

  writeFileSync(CONFIG_FILE, JSON.stringify(sanitizedConfig, null, 2));
}

export function updateCouncilConfig(updates: Partial<CouncilConfig>): AutopilotConfig {
  const config = loadConfig();
  config.council = { ...config.council, ...updates };
  saveConfig(config);
  return config;
}
