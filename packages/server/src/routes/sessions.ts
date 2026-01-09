import { Hono } from 'hono';
import type { Session, ApiResponse, DevelopmentTask, Guidance } from '@opencode-autopilot/shared';
import { sessionManager } from '../services/session-manager.js';

const sessions = new Hono();

sessions.get('/', (c) => {
  const list = sessionManager.getAllSessions();
  return c.json<ApiResponse<Session[]>>({ success: true, data: list });
});

sessions.get('/active', (c) => {
  const list = sessionManager.getActiveSessions();
  return c.json<ApiResponse<Session[]>>({ success: true, data: list });
});

sessions.get('/:id', (c) => {
  const session = sessionManager.getSession(c.req.param('id'));
  if (!session) {
    return c.json<ApiResponse<null>>({ success: false, error: 'Session not found' }, 404);
  }
  return c.json<ApiResponse<Session>>({ success: true, data: session });
});

sessions.post('/start', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const task = body.task as DevelopmentTask | undefined;
    const session = await sessionManager.startSession(task);
    return c.json<ApiResponse<Session>>({ success: true, data: session });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start session';
    return c.json<ApiResponse<null>>({ success: false, error: message }, 500);
  }
});

sessions.post('/:id/stop', async (c) => {
  try {
    await sessionManager.stopSession(c.req.param('id'));
    const session = sessionManager.getSession(c.req.param('id'));
    return c.json<ApiResponse<Session | null>>({ success: true, data: session || null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to stop session';
    return c.json<ApiResponse<null>>({ success: false, error: message }, 404);
  }
});

sessions.post('/:id/guidance', async (c) => {
  try {
    const body = await c.req.json();
    const guidance: Guidance = {
      approved: body.approved ?? true,
      feedback: body.feedback || body.comment || '',
      suggestedNextSteps: body.suggestedNextSteps || body.suggestions || [],
    };
    await sessionManager.sendGuidance(c.req.param('id'), guidance);
    const session = sessionManager.getSession(c.req.param('id'));
    return c.json<ApiResponse<Session | null>>({ success: true, data: session || null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send guidance';
    return c.json<ApiResponse<null>>({ success: false, error: message }, 400);
  }
});

sessions.get('/:id/logs', (c) => {
  const session = sessionManager.getSession(c.req.param('id'));
  if (!session) {
    return c.json<ApiResponse<null>>({ success: false, error: 'Session not found' }, 404);
  }
  return c.json<ApiResponse<typeof session.logs>>({ success: true, data: session.logs });
});

export { sessions as sessionRoutes };
