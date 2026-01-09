import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { CouncilConfig, CouncilDecision, ApiResponse, SupervisorConfig } from '@opencode-autopilot/shared';
import { SupervisorCouncil } from '../services/council.js';
import { createSupervisor, createSupervisors, createMockSupervisor } from '../supervisors/index.js';
import { wsManager } from '../services/ws-manager.js';
import { debateRateLimit, apiRateLimit } from '../middleware/rate-limit.js';
import { debateRequestSchema, supervisorConfigSchema } from '../schemas.js';

const council = new Hono();

let config: CouncilConfig = {
  supervisors: [],
  debateRounds: 2,
  consensusThreshold: 0.7,
  enabled: true,
  smartPilot: false,
};

let councilInstance: SupervisorCouncil | null = null;

function getOrCreateCouncil(): SupervisorCouncil {
  if (!councilInstance) {
    councilInstance = new SupervisorCouncil(config);
    
    if (config.supervisors.length > 0) {
      const supervisors = createSupervisors(config.supervisors);
      supervisors.forEach((s) => councilInstance!.addSupervisor(s));
    }
  }
  return councilInstance;
}

const configSchema = z.object({
  supervisors: z.array(supervisorConfigSchema).optional(),
  debateRounds: z.number().int().min(1).max(10).optional(),
  consensusThreshold: z.number().min(0).max(1).optional(),
  enabled: z.boolean().optional(),
  smartPilot: z.boolean().optional(),
  weightedVoting: z.boolean().optional(),
});

const supervisorsBodySchema = z.object({
  supervisors: z.array(supervisorConfigSchema),
});

council.get('/status', apiRateLimit(), async (c) => {
  const instance = getOrCreateCouncil();
  const available = await instance.getAvailableSupervisors();
  
  return c.json<ApiResponse<{ enabled: boolean; supervisorCount: number; availableCount: number; config: CouncilConfig }>>({
    success: true,
    data: {
      enabled: config.enabled ?? true,
      supervisorCount: config.supervisors.length,
      availableCount: available.length,
      config,
    },
  });
});

council.post('/config', apiRateLimit(), zValidator('json', configSchema), async (c) => {
  const body = c.req.valid('json');
  config = { ...config, ...body };
  
  councilInstance = new SupervisorCouncil(config);
  if (config.supervisors && config.supervisors.length > 0) {
    const supervisors = createSupervisors(config.supervisors);
    supervisors.forEach((s) => councilInstance!.addSupervisor(s));
  }
  
  wsManager.broadcast({
    type: 'log',
    payload: { level: 'info', message: `Council config updated: ${config.supervisors.length} supervisors`, timestamp: Date.now() },
    timestamp: Date.now(),
  });
  
  return c.json<ApiResponse<CouncilConfig>>({ success: true, data: config });
});

council.post('/supervisors', apiRateLimit(), zValidator('json', supervisorsBodySchema), async (c) => {
  const body = c.req.valid('json');

  const instance = getOrCreateCouncil();
  const added: string[] = [];
  const failed: string[] = [];

  for (const supervisorConfig of body.supervisors) {
    try {
      const supervisor = createSupervisor(supervisorConfig as SupervisorConfig);
      instance.addSupervisor(supervisor);
      added.push(supervisorConfig.name);
      
      config.supervisors.push(supervisorConfig as SupervisorConfig);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      failed.push(`${supervisorConfig.name}: ${msg}`);
    }
  }

  wsManager.broadcast({
    type: 'log',
    payload: { level: 'info', message: `Added ${added.length} supervisors: ${added.join(', ')}`, timestamp: Date.now() },
    timestamp: Date.now(),
  });

  return c.json<ApiResponse<{ added: string[]; failed: string[] }>>({
    success: true,
    data: { added, failed },
  });
});

council.delete('/supervisors', apiRateLimit(), (c) => {
  config.supervisors = [];
  councilInstance = new SupervisorCouncil(config);
  
  wsManager.broadcast({
    type: 'log',
    payload: { level: 'info', message: 'All supervisors removed', timestamp: Date.now() },
    timestamp: Date.now(),
  });
  
  return c.json<ApiResponse<{ message: string }>>({ success: true, data: { message: 'All supervisors removed' } });
});

council.post('/debate', debateRateLimit(), zValidator('json', debateRequestSchema.shape.task), async (c) => {
  if (!config.enabled) {
    const decision: CouncilDecision = {
      approved: true,
      consensus: 1.0,
      votes: [],
      reasoning: 'Council is disabled - auto-approving',
    };
    
    wsManager.broadcast({
      type: 'council_decision',
      payload: decision,
      timestamp: Date.now(),
    });
    
    return c.json<ApiResponse<CouncilDecision>>({ success: true, data: decision });
  }

  const task = c.req.valid('json');
  const instance = getOrCreateCouncil();
  
  wsManager.broadcast({
    type: 'log',
    payload: { level: 'info', message: `Debate started: ${task.description}`, timestamp: Date.now(), source: 'council' },
    timestamp: Date.now(),
  });
  
  try {
    const decision = await instance.debate(task);
    
    wsManager.broadcast({
      type: 'council_decision',
      payload: decision,
      timestamp: Date.now(),
    });
    
    wsManager.broadcast({
      type: 'log',
      payload: { 
        level: decision.approved ? 'info' : 'warn', 
        message: `Debate completed: ${decision.approved ? 'APPROVED' : 'REJECTED'} (${Math.round(decision.consensus * 100)}% consensus)`,
        timestamp: Date.now(),
        source: 'council'
      },
      timestamp: Date.now(),
    });
    
    return c.json<ApiResponse<CouncilDecision>>({ success: true, data: decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    wsManager.notifyError(`Debate failed: ${message}`);
    
    return c.json<ApiResponse<CouncilDecision>>({ 
      success: false, 
      error: `Debate failed: ${message}` 
    }, 500);
  }
});

council.post('/toggle', apiRateLimit(), (c) => {
  config.enabled = !config.enabled;
  
  wsManager.broadcast({
    type: 'log',
    payload: { level: 'info', message: `Council ${config.enabled ? 'enabled' : 'disabled'}`, timestamp: Date.now() },
    timestamp: Date.now(),
  });
  
  return c.json<ApiResponse<{ enabled: boolean }>>({ success: true, data: { enabled: config.enabled } });
});

council.post('/add-mock', apiRateLimit(), (c) => {
  const instance = getOrCreateCouncil();
  const mockName = `MockSupervisor-${Date.now()}`;
  instance.addSupervisor(createMockSupervisor(mockName));
  
  wsManager.broadcast({
    type: 'log',
    payload: { level: 'info', message: `Mock supervisor added: ${mockName}`, timestamp: Date.now() },
    timestamp: Date.now(),
  });
  
  return c.json<ApiResponse<{ added: string }>>({ 
    success: true, 
    data: { added: mockName } 
  });
});

export { council as councilRoutes };
