export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SupervisorConfig {
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'xai' | 'moonshot' | 'deepseek' | 'qwen' | 'custom' | 'gemini' | 'grok' | 'kimi';
  apiKey?: string;
  model?: string;
  temperature?: number;
  baseURL?: string;
  systemPrompt?: string;
  weight?: number;
}

export interface CouncilConfig {
  supervisors: SupervisorConfig[];
  debateRounds?: number;
  consensusThreshold?: number;
  enabled?: boolean;
  smartPilot?: boolean;
  weightedVoting?: boolean;
}

export interface Session {
  id: string;
  status: 'idle' | 'starting' | 'running' | 'paused' | 'stopped' | 'error' | 'completed';
  startedAt: number;
  lastActivity?: number;
  currentTask?: string;
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
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
  weightedConsensus?: number;
  votes: Vote[];
  reasoning: string;
  dissent?: string[];
}

export interface Vote {
  supervisor: string;
  approved: boolean;
  confidence: number;
  weight: number;
  comment: string;
}

export interface Guidance {
  approved: boolean;
  feedback: string;
  suggestedNextSteps: string[];
}

export interface Supervisor {
  name: string;
  provider: string;
  chat(messages: Message[]): Promise<string>;
  isAvailable(): Promise<boolean>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface WebSocketMessage {
  type: 'session_update' | 'council_decision' | 'log' | 'error';
  payload: unknown;
  timestamp: number;
}
