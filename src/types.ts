export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SupervisorConfig {
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'xai' | 'moonshot' | 'deepseek' | 'qwen' | 'custom' | 'gemini' | 'grok' | 'kimi';
  apiKey?: string;
  modelName?: string;
  model?: string;  // Alias for modelName - used by council/index.ts
  temperature?: number;
  baseURL?: string;
  systemPrompt?: string;
}

export interface DevelopmentContext {
  currentGoal: string;
  recentChanges: string[];
  fileContext: Record<string, string>;
  projectState: string;
}

export interface Guidance {
  approved: boolean;
  feedback: string;
  suggestedNextSteps: string[];
}

export interface ISupervisor {
  name: string;
  init(): Promise<void>;
  review(context: DevelopmentContext, history: Message[]): Promise<Guidance>;
  chat(messages: Message[]): Promise<string>;
}

export interface CouncilConfig {
  supervisors: SupervisorConfig[];
  debateRounds?: number; // How many rounds of discussion before final consensus
  autoContinue?: boolean; // Whether to automatically proceed based on consensus
  autoApprove?: boolean;
  enabled?: boolean;
  smartPilot?: boolean;
  fallbackMessages?: string[];
  consensusThreshold?: number;
}

export interface Supervisor {
  name: string;
  provider: string;
  chat(messages: Message[]): Promise<string>;
  isAvailable(): Promise<boolean>;
}

export interface DevelopmentTask {
  id: string;
  description: string;
  context: string;
  files: string[];
  timestamp?: number;
}

export interface CouncilDecision {
  approved: boolean;
  consensus: number;
  votes: Array<{
    supervisor: string;
    approved: boolean;
    comment: string;
  }>;
  reasoning: string;
}
