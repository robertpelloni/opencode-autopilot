import type { Supervisor, CouncilConfig, CouncilDecision, DevelopmentTask, Message, SupervisorConfig } from '@opencode-autopilot/shared';

export class SupervisorCouncil {
  private supervisors: Supervisor[] = [];
  private config: CouncilConfig;

  constructor(config: CouncilConfig) {
    this.config = config;
  }

  addSupervisor(supervisor: Supervisor) {
    this.supervisors.push(supervisor);
  }

  async getAvailableSupervisors(): Promise<Supervisor[]> {
    const available: Supervisor[] = [];
    for (const supervisor of this.supervisors) {
      if (await supervisor.isAvailable()) {
        available.push(supervisor);
      }
    }
    return available;
  }

  async debate(task: DevelopmentTask): Promise<CouncilDecision> {
    const available = await this.getAvailableSupervisors();
    
    if (available.length === 0) {
      return {
        approved: true,
        consensus: 1.0,
        votes: [],
        reasoning: 'No supervisors available - auto-approving',
      };
    }

    const rounds = this.config.debateRounds || 2;
    const votes: CouncilDecision['votes'] = [];

    const taskContext: Message = {
      role: 'user',
      content: this.formatTaskForDebate(task),
    };

    const initialOpinions: string[] = [];
    
    for (const supervisor of available) {
      try {
        const response = await supervisor.chat([taskContext]);
        initialOpinions.push(`**${supervisor.name}**: ${response}`);
      } catch (error) {
        initialOpinions.push(`**${supervisor.name}**: [Unable to provide opinion]`);
      }
    }

    let debateContext = taskContext.content + '\n\n**Initial Opinions:**\n' + initialOpinions.join('\n\n');
    
    for (let round = 2; round <= rounds; round++) {
      const roundOpinions: string[] = [];
      
      for (const supervisor of available) {
        try {
          const message: Message = {
            role: 'user',
            content: debateContext + '\n\nConsidering the above opinions, provide your refined assessment.',
          };
          
          const response = await supervisor.chat([message]);
          roundOpinions.push(`**${supervisor.name}**: ${response}`);
        } catch {
        }
      }
      
      debateContext += '\n\n**Round ' + round + ' Opinions:**\n' + roundOpinions.join('\n\n');
    }

    for (const supervisor of available) {
      try {
        const votePrompt: Message = {
          role: 'user',
          content: debateContext + 
            '\n\nBased on all discussions, provide your FINAL VOTE:\n' +
            '1. Vote: APPROVE or REJECT\n' +
            '2. Brief reasoning (2-3 sentences)\n' +
            'Format: VOTE: [APPROVE/REJECT]\nREASONING: [your reasoning]',
        };
        
        const response = await supervisor.chat([votePrompt]);
        const approved = this.parseVote(response);
        
        votes.push({
          supervisor: supervisor.name,
          approved,
          comment: response,
        });
      } catch {
        votes.push({
          supervisor: supervisor.name,
          approved: false,
          comment: 'Failed to vote',
        });
      }
    }

    const approvals = votes.filter(v => v.approved).length;
    const consensus = votes.length > 0 ? approvals / votes.length : 0;
    const threshold = this.config.consensusThreshold || 0.5;
    const approved = consensus >= threshold;

    return {
      approved,
      consensus,
      votes,
      reasoning: this.generateConsensusReasoning(votes, approved),
    };
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

  private generateConsensusReasoning(votes: CouncilDecision['votes'], approved: boolean): string {
    const approvals = votes.filter(v => v.approved).length;
    const rejections = votes.length - approvals;
    
    let reasoning = `After ${votes.length} supervisor votes, `;
    
    if (approved) {
      reasoning += `the council has reached consensus to APPROVE this task (${approvals} approvals, ${rejections} rejections).`;
    } else {
      reasoning += `the council has decided to REJECT this task (${approvals} approvals, ${rejections} rejections).`;
    }
    
    reasoning += '\n\nKey points from the debate:\n';
    
    for (const vote of votes) {
      const comment = vote.comment.substring(0, 200);
      reasoning += `\n- ${vote.supervisor}: ${comment}...`;
    }
    
    return reasoning;
  }

  getSupervisors(): Supervisor[] {
    return [...this.supervisors];
  }

  clearSupervisors(): void {
    this.supervisors = [];
  }

  setDebateRounds(rounds: number): void {
    this.config.debateRounds = rounds;
  }

  setConsensusThreshold(threshold: number): void {
    this.config.consensusThreshold = threshold;
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
});
