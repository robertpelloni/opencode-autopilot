import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { sessionRoutes } from './routes/sessions.js';
import { councilRoutes } from './routes/council.js';
import { wsRoutes } from './routes/ws.js';
import { loadConfig } from './services/config.js';
import { council } from './services/council.js';
import { createSupervisors } from './supervisors/index.js';
import { sessionManager } from './services/session-manager.js';

// Load config and initialize supervisors
const config = loadConfig();

// Auto-add supervisors from config/env
if (config.council.supervisors.length > 0) {
  const supervisors = createSupervisors(config.council.supervisors);
  for (const supervisor of supervisors) {
    council.addSupervisor(supervisor);
  }
  console.log(`Loaded ${supervisors.length} supervisor(s) from config`);
}

// Configure council settings
council.setDebateRounds(config.council.debateRounds || 2);
council.setConsensusThreshold(config.council.consensusThreshold || 0.7);

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.get('/', (c) => c.json({ 
  name: 'opencode-autopilot', 
  version: '0.1.0',
  config: {
    supervisors: council.getSupervisors().map(s => s.name),
    debateRounds: config.council.debateRounds,
    consensusThreshold: config.council.consensusThreshold,
    enabled: config.council.enabled,
  },
  endpoints: {
    sessions: '/api/sessions',
    council: '/api/council',
    websocket: '/ws',
  }
}));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

app.route('/api/sessions', sessionRoutes);
app.route('/api/council', councilRoutes);
app.route('/ws', wsRoutes);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

const port = config.server.port;
const host = config.server.host;

// Start session polling
sessionManager.startPolling();

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await sessionManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await sessionManager.cleanup();
  process.exit(0);
});

export default {
  port,
  hostname: host,
  fetch: app.fetch,
};

console.log(`Server running on http://${host}:${port}`);
console.log(`WebSocket available at ws://${host}:${port}/ws`);
if (council.getSupervisors().length > 0) {
  console.log(`Council supervisors: ${council.getSupervisors().map(s => s.name).join(', ')}`);
} else {
  console.log('No supervisors configured. Add via API or set API keys in environment.');
}
