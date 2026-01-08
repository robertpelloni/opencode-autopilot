import Anthropic from '@anthropic-ai/sdk';
import { BaseSupervisor } from './base';
import { Message } from '../types';

/**
 * Anthropic Claude-based supervisor
 */
export class ClaudeSupervisor extends BaseSupervisor {
  private client: Anthropic;

  constructor(config: any) {
    super(config);
    this.client = new Anthropic({
      apiKey: this.apiKey,
    });
  }

  protected getApiKeyEnvVar(): string {
    return 'ANTHROPIC_API_KEY';
  }

  async chat(messages: Message[]): Promise<string> {
    // Claude requires system prompt separately
    const userMessages = messages.filter(m => m.role !== 'system');
    
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: this.systemPrompt,
      messages: userMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    });

    return response.content[0]?.type === 'text' ? response.content[0].text : '';
  }
}
