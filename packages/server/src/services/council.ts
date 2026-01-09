import type { Supervisor, CouncilConfig, CouncilDecision, DevelopmentTask, Message, SupervisorConfig } from '@opencode-autopilot/shared';
import { metrics } from './metrics.js';

export class SupervisorCouncil {
  private supervisors: Supervisor[] = [];
  private supervisorWeights: Map<string, number> = new Map();
  private config: CouncilConfig;

  constructor(config: CouncilConfig) {
    this.config = config;
  }

  addSupervisor(supervisor: Supervisor, weight: number = 1.0) {
    this.supervisors.push(supervisor);
    this.supervisorWeights.set(supervisor.name, weight);
  }

  setSupervisorWeight(name: string, weight: number): void {
    this.supervisorWeights.set(name, Math.max(0, Math.min(2, weight))); // Clamp between 0 and 2
  }

  getSupervisorWeight(name: string): number {
    return this.supervisorWeights.get(name) ?? 1.0;
  }

  async getAvailableSupervisors(): Promise<Supervisor[]> {
    // Parallelize availability checks
    const results = await Promise.all(
      this.supervisors.map(async (supervisor) => ({
        supervisor,
        available: await supervisor.isAvailable(),
      }))
    );
    return results.filter((r) => r.available).map((r) => r.supervisor);
  }

  async debate(task: DevelopmentTask): Promise<CouncilDecision> {
    const startTime = Date.now();
    const available = await this.getAvailableSupervisors();
    
    if (available.length === 0) {
      metrics.recordDebate(Date.now() - startTime, 0, true);
      return {
        approved: true,
        consensus: 1.0,
        weightedConsensus: 1.0,
        votes: [],
        reasoning: 'No supervisors available - auto-approving',
        dissent: [],
      };
    }

    const rounds = this.config.debateRounds || 2;
    const votes: CouncilDecision['votes'] = [];

    const taskContext: Message = {
      role: 'user',
      content: this.formatTaskForDebate(task),
    };

    const initialOpinions = await Promise.all(
      available.map(async (supervisor) => {
        try {
          const response = await supervisor.chat([taskContext]);
          return `**${supervisor.name}**: ${response}`;
        } catch (error) {
          return `**${supervisor.name}**: [Unable to provide opinion]`;
        }
      })
    );

    let debateContext = taskContext.content + '\n\n**Initial Opinions:**\n' + initialOpinions.join('\n\n');
    
    for (let round = 2; round <= rounds; round++) {
      const roundOpinions = await Promise.all(
        available.map(async (supervisor) => {
          try {
            const message: Message = {
              role: 'user',
              content: debateContext + '\n\nConsidering the above opinions, provide your refined assessment.',
            };
            
            const response = await supervisor.chat([message]);
            return `**${supervisor.name}**: ${response}`;
          } catch {
            return null;
          }
        })
      );
      
      const validOpinions = roundOpinions.filter((o): o is string => o !== null);
      debateContext += '\n\n**Round ' + round + ' Opinions:**\n' + validOpinions.join('\n\n');
    }

    const voteResults = await Promise.all(
      available.map(async (supervisor) => {
        try {
          const votePrompt: Message = {
            role: 'user',
            content: debateContext + 
              '\n\nBased on all discussions, provide your FINAL VOTE:\n' +
              '1. Vote: APPROVE or REJECT\n' +
              '2. Confidence: A number between 0.0 and 1.0 (how confident are you in this decision?)\n' +
              '3. Brief reasoning (2-3 sentences)\n\n' +
              'Format:\nVOTE: [APPROVE/REJECT]\nCONFIDENCE: [0.0-1.0]\nREASONING: [your reasoning]',
          };
          
          const response = await supervisor.chat([votePrompt]);
          const approved = this.parseVote(response);
          const confidence = this.parseConfidence(response);
          const weight = this.getSupervisorWeight(supervisor.name);
          
          return {
            supervisor: supervisor.name,
            approved,
            confidence,
            weight,
            comment: response,
          };
        } catch {
          return {
            supervisor: supervisor.name,
            approved: false,
            confidence: 0.5,
            weight: this.getSupervisorWeight(supervisor.name),
            comment: 'Failed to vote',
          };
        }
      })
    );

    votes.push(...voteResults);

    // Calculate simple consensus (backward compatible)
    const approvals = votes.filter(v => v.approved).length;
    const consensus = votes.length > 0 ? approvals / votes.length : 0;

    // Calculate weighted consensus
    const weightedConsensus = this.calculateWeightedConsensus(votes);
    
    // Track strong dissent (rejections with high confidence)
    const dissent = this.extractDissent(votes);

    const threshold = this.config.consensusThreshold || 0.5;
    
    // Use weighted consensus if enabled, otherwise simple consensus
    const effectiveConsensus = this.config.weightedVoting ? weightedConsensus : consensus;
    const approved = effectiveConsensus >= threshold;

    metrics.recordDebate(Date.now() - startTime, rounds, approved);

    return {
      approved,
      consensus,
      weightedConsensus,
      votes,
      reasoning: this.generateConsensusReasoning(votes, approved, weightedConsensus, dissent),
      dissent,
    };
  }

  private calculateWeightedConsensus(votes: CouncilDecision['votes']): number {
    if (votes.length === 0) return 0;

    let weightedApprovals = 0;
    let totalWeight = 0;

    for (const vote of votes) {
      const effectiveWeight = vote.weight * vote.confidence;
      totalWeight += vote.weight; // Total weight is just sum of weights
      if (vote.approved) {
        weightedApprovals += effectiveWeight;
      }
    }

    return totalWeight > 0 ? weightedApprovals / totalWeight : 0;
  }

  private extractDissent(votes: CouncilDecision['votes']): string[] {
    const dissent: string[] = [];
    
    for (const vote of votes) {
      // Strong dissent: rejected with high confidence (> 0.7)
      if (!vote.approved && vote.confidence > 0.7) {
        const shortComment = vote.comment.length > 300 
          ? vote.comment.substring(0, 300) + '...' 
          : vote.comment;
        dissent.push(`${vote.supervisor} (confidence: ${vote.confidence.toFixed(2)}): ${shortComment}`);
      }
    }
    
    return dissent;
  }

  private parseConfidence(response: string): number {
    const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/i);
    if (confidenceMatch) {
      const value = parseFloat(confidenceMatch[1]);
      if (!isNaN(value)) {
        return value > 1 ? Math.min(1, value / 100) : Math.max(0, Math.min(1, value));
      }
    }

    const altMatch = response.match(/confidence[:\s]+(\d+(?:\.\d+)?)/i);
    if (altMatch) {
      const value = parseFloat(altMatch[1]);
      if (!isNaN(value)) {
        return value > 1 ? Math.min(1, value / 100) : Math.max(0, Math.min(1, value));
      }
    }

    return 0.7;
  }

  private formatTaskForDebate(task: DevelopmentTask): string {
    return `
# Development Task Review

**Task ID**: ${task.id}
**Description**: ${task.description}

**Context**: 
${task.context}

**Files Affected**: 
${task.files.join('\n')}

**Your Role**: 
As a supervisor, review this development task and provide your expert opinion on:
1. Code quality and best practices
2. Potential issues or risks
3. Suggestions for improvement
4. Whether this task should be approved to proceed

Be thorough but concise in your analysis.
`.trim();
  }

  private parseVote(response: string): boolean {
    const normalized = response.toUpperCase();
    
    if (normalized.includes('VOTE: APPROVE') || normalized.includes('VOTE:APPROVE')) {
      return true;
    }
    if (normalized.includes('VOTE: REJECT') || normalized.includes('VOTE:REJECT')) {
      return false;
    }
    
    const approveMatch = /\b(APPROVE|APPROVED|ACCEPT|ACCEPTED|LGTM)\b/.test(normalized);
    const rejectMatch = /\b(REJECT|REJECTED|DENY|DENIED)\b/.test(normalized);
    
    if (approveMatch && !rejectMatch) return true;
    if (rejectMatch && !approveMatch) return false;
    
    return false;
  }

  private generateConsensusReasoning(
    votes: CouncilDecision['votes'], 
    approved: boolean,
    weightedConsensus: number,
    dissent: string[]
  ): string {
    const approvals = votes.filter(v => v.approved).length;
    const avgConfidence = votes.length > 0 
      ? votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length 
      : 0;
    
    let reasoning = `After ${votes.length} supervisor votes, `;
    
    if (approved) {
      reasoning += `the council has reached consensus to APPROVE this task.`;
    } else {
      reasoning += `the council has decided to REJECT this task.`;
    }

    reasoning += `\n\n**Voting Summary:**`;
    reasoning += `\n- Simple consensus: ${approvals}/${votes.length} approved (${(approvals/votes.length*100).toFixed(0)}%)`;
    reasoning += `\n- Weighted consensus: ${(weightedConsensus * 100).toFixed(1)}%`;
    reasoning += `\n- Average confidence: ${(avgConfidence * 100).toFixed(1)}%`;
    
    if (dissent.length > 0) {
      reasoning += `\n\n**Strong Dissenting Opinions (${dissent.length}):**`;
      for (const d of dissent) {
        reasoning += `\n- ${d}`;
      }
    }

    reasoning += '\n\n**Individual Votes:**';
    
    for (const vote of votes) {
      const status = vote.approved ? '✅' : '❌';
      const comment = vote.comment.length > 150 ? vote.comment.substring(0, 150) + '...' : vote.comment;
      reasoning += `\n- ${status} ${vote.supervisor} (weight: ${vote.weight.toFixed(1)}, confidence: ${vote.confidence.toFixed(2)}): ${comment}`;
    }
    
    return reasoning;
  }

  getSupervisors(): Supervisor[] {
    return [...this.supervisors];
  }

  clearSupervisors(): void {
    this.supervisors = [];
    this.supervisorWeights.clear();
  }

  setDebateRounds(rounds: number): void {
    this.config.debateRounds = rounds;
  }

  setConsensusThreshold(threshold: number): void {
    this.config.consensusThreshold = threshold;
  }

  setWeightedVoting(enabled: boolean): void {
    this.config.weightedVoting = enabled;
  }

  getConfig(): CouncilConfig {
    return { ...this.config };
  }
}

export const council = new SupervisorCouncil({
  supervisors: [],
  debateRounds: 2,
  consensusThreshold: 0.7,
  enabled: true,
  weightedVoting: true,
});
