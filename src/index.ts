import { SupervisorCouncil } from './council';
import { CouncilConfig, DevelopmentTask } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * OpenCode Autopilot Council Plugin
 * 
 * This plugin uses multiple AI models as supervisors to discuss and guide
 * the development process through a council-based approach.
 */

interface PluginContext {
  client?: any;
  project?: any;
  directory?: string;
  worktree?: string;
  $?: any;
}

interface Event {
  type: string;
  data: any;
}

let council: SupervisorCouncil | null = null;
let pluginEnabled = true;

/**
 * Load council configuration
 */
function loadConfig(projectDir: string): CouncilConfig | null {
  const configPath = path.join(projectDir, '.opencode', 'council.json');
  
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(configData);
    }
  } catch (error) {
    console.error('Failed to load council configuration:', error);
  }
  
  return null;
}

/**
 * Create default configuration
 */
function createDefaultConfig(projectDir: string): void {
  const opencodeDir = path.join(projectDir, '.opencode');
  const configPath = path.join(opencodeDir, 'council.json');
  
  if (!fs.existsSync(opencodeDir)) {
    fs.mkdirSync(opencodeDir, { recursive: true });
  }
  
  const defaultConfig: CouncilConfig = {
    supervisors: [
      {
        name: 'ChatGPT',
        provider: 'openai',
        model: 'gpt-4',
        systemPrompt: 'You are a senior software engineer reviewing code changes.',
      },
      {
        name: 'Claude',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        systemPrompt: 'You are an expert code reviewer focusing on best practices and security.',
      },
    ],
    debateRounds: 2,
    autoApprove: false,
    consensusThreshold: 0.5,
  };
  
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  console.log(`✓ Created default council configuration at ${configPath}`);
  console.log('Please configure your API keys in environment variables:');
  console.log('  - OPENAI_API_KEY for ChatGPT');
  console.log('  - ANTHROPIC_API_KEY for Claude');
  console.log('  - GROK_API_KEY for Grok');
  console.log('  - DEEPSEEK_API_KEY for DeepSeek');
  console.log('  - And others as needed...');
}

/**
 * Initialize the council
 */
function initializeCouncil(context: PluginContext): void {
  const projectDir = context.directory || context.worktree || process.cwd();
  
  let config = loadConfig(projectDir);
  
  if (!config) {
    console.log('📋 No council configuration found. Creating default configuration...');
    createDefaultConfig(projectDir);
    config = loadConfig(projectDir);
  }
  
  if (config) {
    council = new SupervisorCouncil(config);
    console.log('✓ Council initialized with supervisors:', config.supervisors.map(s => s.name).join(', '));
  }
}

/**
 * Main plugin export
 */
export default async function AutopilotCouncilPlugin(context: PluginContext) {
  console.log('🏛️  OpenCode Autopilot Council Plugin loaded');
  
  // Initialize council on startup
  initializeCouncil(context);
  
  return {
    /**
     * Handle tool execution events
     */
    'tool.execute.after': async (input: any, output: any) => {
      if (!pluginEnabled || !council) return;
      
      // Monitor specific tools that make code changes
      const codeChangingTools = ['edit', 'create', 'write_file'];
      
      if (codeChangingTools.includes(input?.tool)) {
        console.log(`\n🔍 Council reviewing ${input.tool} operation...`);
        
        const task: DevelopmentTask = {
          id: `task-${Date.now()}`,
          description: `Tool: ${input.tool}`,
          context: JSON.stringify(input, null, 2),
          files: [input?.path || 'unknown'],
          timestamp: Date.now(),
        };
        
        try {
          const decision = await council.debate(task);
          
          if (!decision.approved) {
            console.log('\n⚠️  Council rejected this change!');
            console.log(decision.reasoning);
            console.log('\n📋 Next steps:');
            console.log('  - Review the supervisor feedback above');
            console.log('  - Address the concerns raised by the council');
            console.log('  - Make necessary revisions and try again');
            console.log('  - Or use council_toggle to disable monitoring temporarily');
            // Note: OpenCode's tool execution model doesn't support rollback
            // Users must manually address feedback and revise their changes
          } else {
            console.log('\n✅ Council approved this change');
          }
        } catch (error) {
          console.error('Council debate failed:', error);
        }
      }
    },
    
    /**
     * Handle file edit events
     */
    event: async ({ event }: { event: Event }) => {
      if (!pluginEnabled || !council) return;
      
      if (event.type === 'file.edited') {
        console.log(`\n🔍 Council reviewing file edit: ${event.data.path}`);
        
        const task: DevelopmentTask = {
          id: `task-${Date.now()}`,
          description: `File edited: ${event.data.path}`,
          context: event.data.content || 'File content not available',
          files: [event.data.path],
          timestamp: Date.now(),
        };
        
        try {
          const decision = await council.debate(task);
          
          if (!decision.approved) {
            console.log('\n⚠️  Council has concerns about this edit:');
            console.log(decision.reasoning);
          } else {
            console.log('\n✅ Council approved this edit');
          }
        } catch (error) {
          console.error('Council debate failed:', error);
        }
      }
      
      // Handle session idle - could trigger proactive suggestions
      if (event.type === 'session.idle') {
        console.log('💭 Session idle - council standing by...');
      }
    },
    
    /**
     * Register custom commands
     */
    'tool.register': async () => {
      return {
        council_debate: {
          description: 'Manually trigger a council debate on a topic',
          parameters: {
            topic: {
              type: 'string',
              description: 'Topic or task to debate',
            },
          },
          execute: async (params: any) => {
            if (!council) {
              return 'Council not initialized';
            }
            
            const task: DevelopmentTask = {
              id: `manual-${Date.now()}`,
              description: params.topic,
              context: 'Manual debate triggered by user',
              files: [],
              timestamp: Date.now(),
            };
            
            const decision = await council.debate(task);
            return {
              decision: decision.approved ? 'APPROVED' : 'REJECTED',
              consensus: `${(decision.consensus * 100).toFixed(0)}%`,
              reasoning: decision.reasoning,
              votes: decision.votes,
            };
          },
        },
        council_status: {
          description: 'Get council status and available supervisors',
          execute: async () => {
            if (!council) {
              return 'Council not initialized';
            }
            
            const available = await council.getAvailableSupervisors();
            return {
              enabled: pluginEnabled,
              totalSupervisors: available.length,
              supervisors: available.map(s => ({
                name: s.name,
                provider: s.provider,
              })),
            };
          },
        },
        council_toggle: {
          description: 'Enable or disable council monitoring',
          parameters: {
            enabled: {
              type: 'boolean',
              description: 'Whether to enable the council',
            },
          },
          execute: async (params: any) => {
            pluginEnabled = params.enabled;
            return `Council ${pluginEnabled ? 'enabled' : 'disabled'}`;
          },
        },
      };
    },
  };
}

// Export types for external use
export * from './types';
export { SupervisorCouncil } from './council';
export { SupervisorFactory } from './models';
