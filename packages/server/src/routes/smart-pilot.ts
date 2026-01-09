import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { smartPilot } from '../services/smart-pilot.js';
import { apiRateLimit } from '../middleware/rate-limit.js';
import { smartPilotConfigSchema } from '../schemas.js';

export const smartPilotRoutes = new Hono();

smartPilotRoutes.get('/status', apiRateLimit(), (c) => {
  return c.json({
    enabled: smartPilot.isEnabled(),
    config: smartPilot.getConfig(),
  });
});

smartPilotRoutes.post('/enable', apiRateLimit(), (c) => {
  smartPilot.setEnabled(true);
  return c.json({ success: true, enabled: true });
});

smartPilotRoutes.post('/disable', apiRateLimit(), (c) => {
  smartPilot.setEnabled(false);
  return c.json({ success: true, enabled: false });
});

smartPilotRoutes.post('/toggle', apiRateLimit(), (c) => {
  const newState = !smartPilot.isEnabled();
  smartPilot.setEnabled(newState);
  return c.json({ success: true, enabled: newState });
});

smartPilotRoutes.post('/config', apiRateLimit(), zValidator('json', smartPilotConfigSchema), (c) => {
  const body = c.req.valid('json');
  
  if (typeof body.autoApproveThreshold === 'number') {
    smartPilot.setAutoApproveThreshold(body.autoApproveThreshold);
  }
  if (typeof body.requireUnanimous === 'boolean') {
    smartPilot.setRequireUnanimous(body.requireUnanimous);
  }
  if (typeof body.maxAutoApprovals === 'number') {
    smartPilot.setMaxAutoApprovals(body.maxAutoApprovals);
  }
  
  return c.json({ success: true, config: smartPilot.getConfig() });
});

smartPilotRoutes.post('/reset-approvals', apiRateLimit(), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  
  if (body.sessionId) {
    smartPilot.resetApprovalCount(body.sessionId);
  } else {
    smartPilot.resetAllApprovalCounts();
  }
  
  return c.json({ success: true });
});
