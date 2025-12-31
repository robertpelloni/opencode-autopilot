import { Supervisor, SupervisorConfig } from '../types';
import { OpenAISupervisor, OpenAICompatibleSupervisor } from './openai';
import { ClaudeSupervisor } from './claude';

/**
 * Factory for creating supervisor instances
 */
export class SupervisorFactory {
  static createSupervisor(config: SupervisorConfig): Supervisor {
    switch (config.provider.toLowerCase()) {
      case 'openai':
        return new OpenAISupervisor(config);
      
      case 'anthropic':
      case 'claude':
        return new ClaudeSupervisor(config);
      
      case 'grok':
      case 'deepseek':
      case 'qwen':
      case 'kimi':
      case 'gemini':
        return new OpenAICompatibleSupervisor(config);
      
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
}

export { OpenAISupervisor, OpenAICompatibleSupervisor, ClaudeSupervisor };
export { BaseSupervisor } from './base';
