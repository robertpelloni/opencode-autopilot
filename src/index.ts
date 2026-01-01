import type { Plugin } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import { z } from 'zod';
import { Council } from './council.js';
import { OpenAISupervisor } from './supervisors/OpenAISupervisor.js';
import { AnthropicSupervisor } from './supervisors/AnthropicSupervisor.js';
import { GoogleSupervisor } from './supervisors/GoogleSupervisor.js';
import { DeepSeekSupervisor } from './supervisors/DeepSeekSupervisor.js';
import { MockSupervisor } from './supervisors/MockSupervisor.js';
import type { CouncilConfig, SupervisorConfig } from './types.js';
import { VERSION } from './version.js';

const plugin: Plugin = async () => {
  return {
    tool: {
      consult_council: tool({
        description: 'Consult the AI council for guidance on the current project state.',
        args: {
          currentGoal: z.string().describe('The current goal or task being worked on.'),
          recentChanges: z.array(z.string()).describe('List of recent changes made to the project.'),
          fileContext: z.record(z.string(), z.string()).describe('Map of file paths to their content.'),
          projectState: z.string().describe('Brief description of the project state (e.g., Alpha, Beta, etc.).'),
          debateRounds: z.number().optional().default(2).describe('Number of debate rounds for the council.'),
        },
        execute: async (args) => {
          // Initialize supervisors based on available env vars
          const supervisors: SupervisorConfig[] = [];
          
          if (process.env.OPENAI_API_KEY) {
              supervisors.push({ name: "GPT-Architect", provider: "openai", modelName: "gpt-4o" });
          }
          if (process.env.ANTHROPIC_API_KEY) {
              supervisors.push({ name: "Claude-Reviewer", provider: "anthropic", modelName: "claude-3-5-sonnet-20241022" });
          }
          if (process.env.GOOGLE_API_KEY) {
              supervisors.push({ name: "Gemini-Strategist", provider: "google", modelName: "gemini-pro" });
          }
          if (process.env.DEEPSEEK_API_KEY) {
              supervisors.push({ name: "DeepSeek-Analyst", provider: "deepseek", modelName: "deepseek-chat" });
          }

          // Fallback to mock if no keys
          if (supervisors.length === 0) {
              console.warn("No API keys found. Using Mock Supervisor.");
              supervisors.push({ name: "Mock-Critic", provider: "custom", modelName: "mock-v1" });
          }

          const config: CouncilConfig = {
              supervisors,
              debateRounds: args.debateRounds,
              autoContinue: false
          };

          const council = new Council(config);
          
          // Register Supervisors
          config.supervisors.forEach(conf => {
              switch (conf.provider) {
              case 'openai':
                  council.registerSupervisor(new OpenAISupervisor(conf));
                  break;
              case 'anthropic':
                  council.registerSupervisor(new AnthropicSupervisor(conf));
                  break;
              case 'google':
                  council.registerSupervisor(new GoogleSupervisor(conf));
                  break;
              case 'deepseek':
                  council.registerSupervisor(new DeepSeekSupervisor(conf));
                  break;
              case 'custom':
              default:
                  council.registerSupervisor(new MockSupervisor(conf));
                  break;
              }
          });

          await council.init();
          
          const guidance = await council.discuss({
              currentGoal: args.currentGoal,
              recentChanges: args.recentChanges,
              fileContext: args.fileContext,
              projectState: args.projectState
          });

          return JSON.stringify(guidance, null, 2);
        },
      }),
    }
  };
};

export default plugin;
