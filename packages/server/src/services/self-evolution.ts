import { loadConfig, saveConfig } from './config.js';
import { supervisorAnalytics } from './supervisor-analytics.js';
import { sessionManager } from './session-manager.js';
import { council } from './council.js';
import type { DevelopmentTask } from '@opencode-autopilot/shared';
import { spawn } from 'child_process';

export class SelfEvolutionService {
  private weightOptimizationTimer: ReturnType<typeof setInterval> | null = null;
  private readonly OPTIMIZATION_INTERVAL = 1000 * 60 * 60; // 1 hour

  start(): void {
    if (this.weightOptimizationTimer) return;
    this.weightOptimizationTimer = setInterval(() => {
      this.optimizeWeights();
    }, this.OPTIMIZATION_INTERVAL);
    console.log('[SelfEvolution] Started continuous learning processes.');
  }

  stop(): void {
    if (this.weightOptimizationTimer) {
      clearInterval(this.weightOptimizationTimer);
      this.weightOptimizationTimer = null;
    }
  }

  /**
   * Periodically adjusts supervisor weights based on historical accuracy and consensus agreement.
   */
  optimizeWeights(): void {
    const config = loadConfig();
    const metricsMap = supervisorAnalytics.getAllSupervisorMetrics();

    let configChanged = false;

    for (const supervisor of config.council.supervisors) {
      const metrics = metricsMap.get(supervisor.name);
      if (!metrics || metrics.totalVotes < 5) continue; // Need statistically significant sample size

      // Weight adjustment logic:
      // Base weight is 1.0.
      // High consensus agreement (>85%) -> increase weight.
      // Low consensus agreement (<50%) -> decrease weight.
      
      let newWeight = supervisor.weight || 1.0;

      if (metrics.consensusAgreementRate >= 0.85) {
        newWeight = Math.min(2.0, newWeight + 0.1);
      } else if (metrics.consensusAgreementRate <= 0.50) {
        newWeight = Math.max(0.1, newWeight - 0.1);
      }

      // Round to 1 decimal place
      newWeight = Math.round(newWeight * 10) / 10;

      if (supervisor.weight !== newWeight) {
        console.log(`[SelfEvolution] Adjusting weight for ${supervisor.name}: ${supervisor.weight || 1.0} -> ${newWeight}`);
        supervisor.weight = newWeight;
        configChanged = true;
        
        // Apply immediately to running council
        council.setSupervisorWeight(supervisor.name, newWeight);
      }
    }

    if (configChanged) {
      saveConfig(config);
    }
  }

  /**
   * Spawns an internal meta-session to modify the codebase of opencode-autopilot itself.
   */
  async evolveSystem(description: string): Promise<string> {
    const taskId = `evolve-${Date.now()}`;
    const task: DevelopmentTask = {
      id: taskId,
      description: `[SELF-EVOLUTION] ${description}\n\nYou are modifying the source code of opencode-autopilot itself. \n\nIMPORTANT INSTRUCTIONS:\n1. Create a new git branch named 'evolve-${taskId}'.\n2. Make the requested changes.\n3. Run 'bun run build' and 'bun run typecheck' across the monorepo to ensure integrity.\n4. If tests and builds pass, commit the changes and push the branch.`,
      context: 'Modify opencode-autopilot source code to implement the requested evolution autonomously.',
      files: [],
      cliType: 'opencode'
    };

    console.log(`[SelfEvolution] Initiating system evolution: ${description}`);

    const session = await sessionManager.startSession(task, {
      cliType: 'opencode',
      tags: ['meta', 'self-evolution'],
      workingDirectory: process.cwd() // target the root of the autopilot project itself
    });

    // We rely on smart-pilot or direct council routing to pick this up,
    // but since we just started it, we can trigger the swarm decomposition directly.
    const { smartPilot } = await import('./smart-pilot.js');
    smartPilot.triggerTask(session.id, task).catch(err => {
      console.error('[SelfEvolution] Evolution task failed:', err);
    });

    return session.id;
  }

  /**
   * Executes a self-test to verify system integrity after an evolution
   */
  async runSelfTest(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('[SelfEvolution] Running self-test suite...');
      const proc = spawn('bun', ['run', 'typecheck'], {
        cwd: process.cwd(),
        shell: true
      });

      proc.on('close', (code) => {
        const passed = code === 0;
        console.log(`[SelfEvolution] Self-test ${passed ? 'passed' : 'failed'} (code ${code})`);
        resolve(passed);
      });
    });
  }
}

export const selfEvolution = new SelfEvolutionService();
