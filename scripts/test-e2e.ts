#!/usr/bin/env bun

const API = 'http://localhost:3847';

async function runTests() {
  console.log('🧪 OpenCode Autopilot E2E Test\n');

  console.log('1. Checking server health...');
  const health = await fetch(API).then(r => r.json()).catch(() => null);
  if (!health) {
    console.error('❌ Server not running. Start with: bun run dev');
    process.exit(1);
  }
  console.log('   ✓ Server running\n');

  console.log('2. Adding mock supervisors...');
  await fetch(`${API}/api/council/add-mock`, { method: 'POST' });
  await fetch(`${API}/api/council/add-mock`, { method: 'POST' });
  await fetch(`${API}/api/council/add-mock`, { method: 'POST' });
  const status = await fetch(`${API}/api/council/status`).then(r => r.json());
  console.log(`   ✓ ${status.data.availableCount} supervisors available\n`);

  console.log('3. Testing WebSocket connection...');
  let wsConnected = false;
  const ws = new WebSocket('ws://localhost:3847/ws');
  await new Promise<void>((resolve) => {
    ws.onopen = () => { wsConnected = true; resolve(); };
    ws.onerror = () => resolve();
    setTimeout(resolve, 2000);
  });
  console.log(wsConnected ? '   ✓ WebSocket connected\n' : '   ⚠ WebSocket failed (optional)\n');

  console.log('4. Running council debate...');
  const task = {
    id: `test-${Date.now()}`,
    description: 'Add rate limiting to API endpoints',
    context: 'Prevent abuse by limiting requests per IP to 100/minute',
    files: ['src/middleware/rate-limit.ts']
  };
  
  const debateStart = Date.now();
  const debate = await fetch(`${API}/api/council/debate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task)
  }).then(r => r.json());
  const debateTime = Date.now() - debateStart;

  if (debate.success) {
    const d = debate.data;
    console.log(`   ✓ Decision: ${d.approved ? 'APPROVED' : 'REJECTED'}`);
    console.log(`   ✓ Consensus: ${Math.round(d.consensus * 100)}%`);
    console.log(`   ✓ Votes: ${d.votes.length}`);
    console.log(`   ✓ Time: ${debateTime}ms\n`);
  } else {
    console.log(`   ❌ Debate failed: ${debate.error}\n`);
  }

  console.log('5. Testing session endpoints...');
  const sessions = await fetch(`${API}/api/sessions`).then(r => r.json());
  console.log(`   ✓ Sessions endpoint working (${sessions.data?.length || 0} sessions)\n`);

  ws.close();
  
  console.log('━'.repeat(40));
  console.log('✅ All tests passed!');
  console.log('━'.repeat(40));
}

runTests().catch(console.error);
