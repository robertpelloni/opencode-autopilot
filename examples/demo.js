#!/usr/bin/env node

/**
 * Demo script for Borg Orchestrator Council
 * 
 * This script demonstrates how to use the council programmatically
 */

const { SupervisorCouncil } = require('../dist/council');

// Demo configuration
const demoConfig = {
  supervisors: [
    {
      name: 'Demo Supervisor 1',
      provider: 'openai',
      model: 'gpt-4',
    },
    {
      name: 'Demo Supervisor 2',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
    },
  ],
  debateRounds: 2,
  consensusThreshold: 0.5,
};

// Demo task
const demoTask = {
  id: 'demo-task-1',
  description: 'Add input validation to user registration',
  context: `
    The task involves adding validation to the user registration endpoint:
    - Email format validation
    - Password strength requirements
    - Username length constraints
    - SQL injection prevention
  `,
  files: ['src/routes/auth.ts', 'src/validators/user.ts'],
  timestamp: Date.now(),
};

async function runDemo() {
  console.log('🏛️  Borg Orchestrator Council Demo\n');
  console.log('='.repeat(60));
  
  // Check for API keys
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  
  console.log('\n📋 Environment Check:');
  console.log(`  OPENAI_API_KEY: ${hasOpenAI ? '✓ Set' : '✗ Not set'}`);
  console.log(`  ANTHROPIC_API_KEY: ${hasAnthropic ? '✓ Set' : '✗ Not set'}`);
  
  if (!hasOpenAI && !hasAnthropic) {
    console.log('\n⚠️  Warning: No API keys found. This is a dry run demo.');
    console.log('   Set API keys to see actual council debates.');
    console.log('\n   Example:');
    console.log('   export OPENAI_API_KEY="sk-..."');
    console.log('   export ANTHROPIC_API_KEY="sk-ant-..."');
    console.log('\n   For this demo, we\'ll show the structure without real API calls.\n');
    
    demoStructure();
    return;
  }
  
  // Initialize council
  console.log('\n🏗️  Initializing Council...');
  const council = new SupervisorCouncil(demoConfig);
  
  // Get available supervisors
  const available = await council.getAvailableSupervisors();
  console.log(`✓ Council initialized with ${available.length} available supervisors:`);
  for (const supervisor of available) {
    console.log(`  - ${supervisor.name} (${supervisor.provider})`);
  }
  
  // Run debate
  console.log('\n🗳️  Starting Council Debate...\n');
  console.log('='.repeat(60));
  
  try {
    const decision = await council.debate(demoTask);
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Final Decision:');
    console.log(`  Status: ${decision.approved ? '✅ APPROVED' : '❌ REJECTED'}`);
    console.log(`  Consensus: ${(decision.consensus * 100).toFixed(0)}%`);
    console.log(`  Votes:`);
    
    for (const vote of decision.votes) {
      const status = vote.approved ? '✓' : '✗';
      console.log(`    ${status} ${vote.supervisor}: ${vote.approved ? 'APPROVED' : 'REJECTED'}`);
    }
    
    console.log(`\n📝 Summary:\n${decision.reasoning}`);
    
  } catch (error) {
    console.error('\n❌ Error during debate:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✨ Demo completed!\n');
}

function demoStructure() {
  console.log('\n📚 Council Structure Demo:\n');
  
  console.log('1️⃣  Council Configuration:');
  console.log(JSON.stringify(demoConfig, null, 2));
  
  console.log('\n2️⃣  Task to Review:');
  console.log(JSON.stringify(demoTask, null, 2));
  
  console.log('\n3️⃣  Expected Flow:');
  console.log('  ┌─────────────────────────────────┐');
  console.log('  │ Council Initialization          │');
  console.log('  └──────────┬──────────────────────┘');
  console.log('             │');
  console.log('  ┌──────────▼──────────────────────┐');
  console.log('  │ Round 1: Initial Opinions       │');
  console.log('  │ - Each supervisor reviews       │');
  console.log('  │ - Provides independent opinion  │');
  console.log('  └──────────┬──────────────────────┘');
  console.log('             │');
  console.log('  ┌──────────▼──────────────────────┐');
  console.log('  │ Round 2: Deliberation           │');
  console.log('  │ - Supervisors read others\' views│');
  console.log('  │ - Refine their positions        │');
  console.log('  └──────────┬──────────────────────┘');
  console.log('             │');
  console.log('  ┌──────────▼──────────────────────┐');
  console.log('  │ Final Voting                    │');
  console.log('  │ - Each casts APPROVE/REJECT     │');
  console.log('  │ - Consensus calculated          │');
  console.log('  └──────────┬──────────────────────┘');
  console.log('             │');
  console.log('  ┌──────────▼──────────────────────┐');
  console.log('  │ Decision & Reasoning            │');
  console.log('  │ - Approved or Rejected          │');
  console.log('  │ - Summary of debate             │');
  console.log('  └─────────────────────────────────┘');
  
  console.log('\n4️⃣  To run with real API calls:');
  console.log('  $ export OPENAI_API_KEY="sk-..."');
  console.log('  $ export ANTHROPIC_API_KEY="sk-ant-..."');
  console.log('  $ node examples/demo.js\n');
}

// Run the demo
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = { runDemo };
