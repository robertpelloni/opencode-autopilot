import { Hono } from 'hono';
import { smartPilot } from '../services/smart-pilot.js';

export const smartPilotRoutes = new Hono();

smartPilotRoutes.get('/status', (c) => {
  return c.json({
    enabled: smartPilot.isEnabled(),
    config: smartPilot.getConfig(),
  });
});

smartPilotRoutes.post('/enable', (c) => {
  smartPilot.setEnabled(true);
  return c.json({ success: true, enabled: true });
});

smartPilotRoutes.post('/disable', (c) => {
  smartPilot.setEnabled(false);
  return c.json({ success: true, enabled: false });
});

smartPilotRoutes.post('/toggle', (c) => {
  const newState = !smartPilot.isEnabled();
  smartPilot.setEnabled(newState);
  return c.json({ success: true, enabled: newState });
});

smartPilotRoutes.post('/config', async (c) => {
  const body = await c.req.json();
  
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

smartPilotRoutes.post('/reset-approvals', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  
  if (body.sessionId) {
    smartPilot.resetApprovalCount(body.sessionId);
  } else {
    smartPilot.resetAllApprovalCounts();
  }
  
  return c.json({ success: true });
});
