import { Hono } from 'hono';
import { autoContinueHooks, type HookPhase, type HookHandler } from '../services/hooks.js';

export const hooksRoutes = new Hono();

const dynamicHooks: Map<string, HookHandler> = new Map();

hooksRoutes.get('/', (c) => {
  return c.json({
    hooks: autoContinueHooks.getRegisteredHooks(),
  });
});

hooksRoutes.post('/register', async (c) => {
  const body = await c.req.json();
  const { phase, webhookUrl, priority } = body as { 
    phase: HookPhase; 
    webhookUrl: string; 
    priority?: number;
  };
  
  if (!phase || !webhookUrl) {
    return c.json({ error: 'Missing phase or webhookUrl' }, 400);
  }

  const handler: HookHandler = async (context) => {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      });
      
      if (!res.ok) {
        return { continue: true };
      }
      
      return await res.json();
    } catch {
      return { continue: true };
    }
  };

  const id = autoContinueHooks.register(phase, handler, priority);
  dynamicHooks.set(id, handler);
  
  return c.json({ success: true, hookId: id });
});

hooksRoutes.delete('/:id', (c) => {
  const id = c.req.param('id');
  const removed = autoContinueHooks.unregister(id);
  
  if (removed) {
    dynamicHooks.delete(id);
  }
  
  return c.json({ success: removed });
});

hooksRoutes.delete('/', (c) => {
  autoContinueHooks.clear();
  dynamicHooks.clear();
  return c.json({ success: true });
});
