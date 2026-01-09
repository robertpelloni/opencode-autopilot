import { Hono } from 'hono';
import type { CouncilConfig, CouncilDecision, DevelopmentTask, ApiResponse, SupervisorConfig } from '@opencode-autopilot/shared';
import { SupervisorCouncil } from '../services/council.js';
import { createSupervisor, createSupervisors, createMockSupervisor } from '../supervisors/index.js';
import { wsManager } from '../services/ws-manager.js';

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

council.get('/status', async (c) => {
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

council.post('/config', async (c) => {
  const body = await c.req.json<Partial<CouncilConfig>>();
  config = { ...config, ...body };
  
  councilInstance = new SupervisorCouncil(config);
  if (config.supervisors.length > 0) {
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

council.post('/supervisors', async (c) => {
  const body = await c.req.json<{ supervisors: SupervisorConfig[] }>();
  
  if (!body.supervisors || !Array.isArray(body.supervisors)) {
    return c.json<ApiResponse<never>>({ success: false, error: 'supervisors array required' }, 400);
  }

  const instance = getOrCreateCouncil();
  const added: string[] = [];
  const failed: string[] = [];

  for (const supervisorConfig of body.supervisors) {
    try {
      const supervisor = createSupervisor(supervisorConfig);
      instance.addSupervisor(supervisor);
      added.push(supervisorConfig.name);
      
      config.supervisors.push(supervisorConfig);
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

council.delete('/supervisors', (c) => {
  config.supervisors = [];
  councilInstance = new SupervisorCouncil(config);
  
  wsManager.broadcast({
    type: 'log',
    payload: { level: 'info', message: 'All supervisors removed', timestamp: Date.now() },
    timestamp: Date.now(),
  });
  
  return c.json<ApiResponse<{ message: string }>>({ success: true, data: { message: 'All supervisors removed' } });
});

council.post('/debate', async (c) => {
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

  const task = await c.req.json<DevelopmentTask>();
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

council.post('/toggle', (c) => {
  config.enabled = !config.enabled;
  
  wsManager.broadcast({
    type: 'log',
    payload: { level: 'info', message: `Council ${config.enabled ? 'enabled' : 'disabled'}`, timestamp: Date.now() },
    timestamp: Date.now(),
  });
  
  return c.json<ApiResponse<{ enabled: boolean }>>({ success: true, data: { enabled: config.enabled } });
});

council.post('/add-mock', (c) => {
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
