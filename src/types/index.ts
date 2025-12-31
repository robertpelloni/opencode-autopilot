/**
 * Base interface for all supervisor models
 */
export interface Supervisor {
  name: string;
  provider: string;
  
  /**
   * Send a message to the supervisor and get a response
   */
  chat(messages: Message[]): Promise<string>;
  
  /**
   * Check if the supervisor is available
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Message structure for conversations
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Council configuration
 */
export interface CouncilConfig {
  supervisors: SupervisorConfig[];
  debateRounds?: number;
  autoApprove?: boolean;
  consensusThreshold?: number;
}

/**
 * Supervisor configuration
 */
export interface SupervisorConfig {
  name: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'grok' | 'deepseek' | 'qwen' | 'kimi';
  model: string;
  apiKey?: string;
  baseURL?: string;
  systemPrompt?: string;
}

/**
 * Council decision result
 */
export interface CouncilDecision {
  approved: boolean;
  reasoning: string;
  votes: {
    supervisor: string;
    approved: boolean;
    comment: string;
  }[];
  consensus: number;
}

/**
 * Development task
 */
export interface DevelopmentTask {
  id: string;
  description: string;
  context: string;
  files: string[];
  timestamp: number;
}
