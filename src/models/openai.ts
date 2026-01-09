import OpenAI from 'openai';
import { BaseSupervisor } from './base.js';
import { Message, SupervisorConfig } from '../types.js';

/**
 * OpenAI-based supervisor (ChatGPT)
 */
export class OpenAISupervisor extends BaseSupervisor {
  private client: OpenAI;

  constructor(config: SupervisorConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
    });
  }

  protected getApiKeyEnvVar(): string {
    return 'OPENAI_API_KEY';
  }

  async chat(messages: Message[]): Promise<string> {
    const systemMessage = { role: 'system' as const, content: this.systemPrompt || '' };
    const allMessages = [systemMessage, ...messages];

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: allMessages,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || '';
  }
}

/**
 * OpenAI-compatible supervisor for Grok, DeepSeek, Qwen, Kimi, etc.
 */
export class OpenAICompatibleSupervisor extends BaseSupervisor {
  private client: OpenAI;

  constructor(config: SupervisorConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
    });
  }

  protected getApiKeyEnvVar(): string {
    // Map provider to environment variable
    const envMap: Record<string, string> = {
      grok: 'GROK_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      qwen: 'QWEN_API_KEY',
      kimi: 'KIMI_API_KEY',
      gemini: 'GEMINI_API_KEY',
    };
    return envMap[this.provider.toLowerCase()] || `${this.provider.toUpperCase()}_API_KEY`;
  }

  async chat(messages: Message[]): Promise<string> {
    const systemMessage = { role: 'system' as const, content: this.systemPrompt || '' };
    const allMessages = [systemMessage, ...messages];

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: allMessages,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || '';
  }
}
