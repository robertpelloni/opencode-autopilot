#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';

const args = process.argv.slice(2);
const command = args[0];

const API_BASE = process.env.AUTOPILOT_API || 'http://localhost:3847';

async function runCommand() {
  if (command === 'debate') {
    const description = args[1] || 'Manual debate request';
    const context = args[2] || 'Triggered from CLI';
    
    console.log(`🏛️  Starting council debate...`);
    console.log(`   Description: ${description}\n`);
    
    const task = {
      id: `cli-${Date.now()}`,
      description,
      context,
      files: [],
    };
    
    try {
      const res = await fetch(`${API_BASE}/api/council/debate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
      const data = await res.json();
      
      if (data.success) {
        const d = data.data;
        console.log(`📊 Result: ${d.approved ? '✅ APPROVED' : '❌ REJECTED'}`);
        console.log(`   Consensus: ${Math.round(d.consensus * 100)}%`);
        console.log(`   Votes: ${d.votes.length}\n`);
        
        for (const vote of d.votes) {
          console.log(`   ${vote.approved ? '✓' : '✗'} ${vote.supervisor}`);
        }
        
        console.log(`\n${d.reasoning.slice(0, 500)}`);
      } else {
        console.error(`❌ Error: ${data.error}`);
      }
    } catch (e) {
      console.error('❌ Failed to connect to server. Is it running?');
    }
    return;
  }
  
  if (command === 'status') {
    try {
      const res = await fetch(`${API_BASE}/api/council/status`);
      const data = await res.json();
      
      if (data.success) {
        const s = data.data;
        console.log('🏛️  Council Status\n');
        console.log(`   Enabled: ${s.enabled ? '✅ Yes' : '❌ No'}`);
        console.log(`   Supervisors: ${s.supervisorCount} configured, ${s.availableCount} available`);
        console.log(`   Debate Rounds: ${s.config.debateRounds}`);
        console.log(`   Consensus Threshold: ${s.config.consensusThreshold * 100}%`);
        
        if (s.config.supervisors.length > 0) {
          console.log('\n   Configured Supervisors:');
          for (const sup of s.config.supervisors) {
            console.log(`     • ${sup.name} (${sup.provider}) - ${sup.model || 'default'}`);
          }
        }
      }
    } catch {
      console.error('❌ Failed to connect to server');
    }
    return;
  }
  
  if (command === 'add-mock') {
    const count = parseInt(args[1]) || 1;
    console.log(`Adding ${count} mock supervisor(s)...`);
    
    for (let i = 0; i < count; i++) {
      await fetch(`${API_BASE}/api/council/add-mock`, { method: 'POST' });
    }
    console.log('✅ Done');
    return;
  }
  
  if (command === 'toggle') {
    const res = await fetch(`${API_BASE}/api/council/toggle`, { method: 'POST' });
    const data = await res.json();
    console.log(`Council ${data.data.enabled ? 'enabled' : 'disabled'}`);
    return;
  }
  
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`
borg-orchestrator CLI

Usage:
  autopilot              Start interactive TUI
  autopilot debate <desc> [context]  Run a council debate
  autopilot status       Show council status
  autopilot add-mock [n] Add n mock supervisors (default: 1)
  autopilot toggle       Toggle council on/off
  autopilot help         Show this help

Environment:
  AUTOPILOT_API   Server URL (default: http://localhost:3847)
  AUTOPILOT_WS    WebSocket URL (default: ws://localhost:3847/ws)
`);
    return;
  }
  
  render(<App />);
}

runCommand();
