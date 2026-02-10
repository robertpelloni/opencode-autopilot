import { Hono } from 'hono';
import { systemManager } from '../services/system-manager.js';

const app = new Hono();

app.get('/submodules', async (c) => {
  const submodules = await systemManager.getSubmodules();
  return c.json({ success: true, data: submodules });
});

app.get('/version', async (c) => {
  const version = await systemManager.getProjectVersion();
  return c.json({ success: true, data: version });
});

export default app;
