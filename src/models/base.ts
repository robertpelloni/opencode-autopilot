import { Supervisor, Message, SupervisorConfig } from '../types';

/**
 * Abstract base class for supervisor implementations
 */
export abstract class BaseSupervisor implements Supervisor {
  public name: string;
  public provider: string;
  protected model: string;
  protected apiKey?: string;
  protected baseURL?: string;
  protected systemPrompt?: string;

  constructor(config: SupervisorConfig) {
    this.name = config.name;
    this.provider = config.provider;
    this.model = config.model;
    this.apiKey = config.apiKey || process.env[this.getApiKeyEnvVar()];
    this.baseURL = config.baseURL;
    this.systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();
  }

  abstract chat(messages: Message[]): Promise<string>;

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  protected abstract getApiKeyEnvVar(): string;

  protected getDefaultSystemPrompt(): string {
    return `You are ${this.name}, an expert software development supervisor. Your role is to review code changes, provide constructive feedback, and guide the development process. Focus on code quality, best practices, security, and maintainability.`;
  }
}
