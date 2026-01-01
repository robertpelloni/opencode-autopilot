import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { SessionManager } from './session-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const manager = new SessionManager();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Endpoints

// List all sessions
app.get('/api/sessions', (req, res) => {
    res.json(manager.getSessions());
});

// Add a new session (repo)
app.post('/api/sessions', async (req, res) => {
    const { path } = req.body;
    if (!path) return res.status(400).json({ error: 'Path is required' });
    
    try {
        const session = await manager.addSession(path);
        res.json(session);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Start a session (spawn OpenCode)
app.post('/api/sessions/:id/start', async (req, res) => {
    try {
        await manager.startSession(req.params.id);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Stop a session
app.post('/api/sessions/:id/stop', async (req, res) => {
    try {
        await manager.stopSession(req.params.id);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Delete a session
app.delete('/api/sessions/:id', async (req, res) => {
    try {
        await manager.removeSession(req.params.id);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Get logs
app.get('/api/sessions/:id/logs', (req, res) => {
    const logs = manager.getLogs(req.params.id);
    res.json(logs);
});

// Update session configuration
app.post('/api/sessions/:id/config', async (req, res) => {
    try {
        await manager.updateSessionConfig(req.params.id, req.body);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Orchestrator running at http://localhost:${PORT}`);
    manager.init(); // Start the orchestration loop
});
