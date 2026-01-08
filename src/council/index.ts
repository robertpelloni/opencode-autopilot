import { Supervisor, CouncilConfig, CouncilDecision, DevelopmentTask, Message } from '../types';
import { SupervisorFactory } from '../models';

/**
 * Council of supervisors that debate and make decisions
 */
export class SupervisorCouncil {
  private supervisors: Supervisor[] = [];
  private config: CouncilConfig;

  constructor(config: CouncilConfig) {
    this.config = config;
    this.initializeSupervisors();
  }

  private initializeSupervisors() {
    for (const supervisorConfig of this.config.supervisors) {
      try {
        const supervisor = SupervisorFactory.createSupervisor(supervisorConfig);
        this.supervisors.push(supervisor);
      } catch (error) {
        console.error(`Failed to initialize supervisor ${supervisorConfig.name}:`, error);
      }
    }
  }

  /**
   * Get available supervisors
   */
  async getAvailableSupervisors(): Promise<Supervisor[]> {
    const available: Supervisor[] = [];
    for (const supervisor of this.supervisors) {
      if (await supervisor.isAvailable()) {
        available.push(supervisor);
      }
    }
    return available;
  }

  /**
   * Conduct a debate among supervisors about a development task
   */
  async debate(task: DevelopmentTask): Promise<CouncilDecision> {
    const available = await this.getAvailableSupervisors();
    
    if (available.length === 0) {
      throw new Error('No supervisors are available');
    }

    const rounds = this.config.debateRounds || 2;
    const votes: CouncilDecision['votes'] = [];

    // Initial context for the debate
    const taskContext: Message = {
      role: 'user',
      content: this.formatTaskForDebate(task),
    };

    // Round 1: Each supervisor provides their initial opinion
    console.log(`\n🗳️  Council Debate - Round 1: Initial Opinions`);
    const initialOpinions: string[] = [];
    
    for (const supervisor of available) {
      console.log(`\n📢 ${supervisor.name} (${supervisor.provider}) is evaluating...`);
      
      try {
        const response = await supervisor.chat([taskContext]);
        initialOpinions.push(`**${supervisor.name}**: ${response}`);
        console.log(`✓ ${supervisor.name}: ${response.substring(0, 100)}...`);
      } catch (error) {
        console.error(`✗ ${supervisor.name} failed:`, error);
        initialOpinions.push(`**${supervisor.name}**: [Unable to provide opinion]`);
      }
    }

    // Round 2+: Supervisors debate considering each other's opinions
    let debateContext = taskContext.content + '\n\n**Initial Opinions:**\n' + initialOpinions.join('\n\n');
    
    for (let round = 2; round <= rounds; round++) {
      console.log(`\n🗳️  Council Debate - Round ${round}: Deliberation`);
      const roundOpinions: string[] = [];
      
      for (const supervisor of available) {
        console.log(`\n📢 ${supervisor.name} is deliberating...`);
        
        try {
          const message: Message = {
            role: 'user',
            content: debateContext + '\n\nConsidering the above opinions, provide your refined assessment.',
          };
          
          const response = await supervisor.chat([message]);
          roundOpinions.push(`**${supervisor.name}**: ${response}`);
          console.log(`✓ ${supervisor.name}: ${response.substring(0, 100)}...`);
        } catch (error) {
          console.error(`✗ ${supervisor.name} failed:`, error);
        }
      }
      
      debateContext += '\n\n**Round ' + round + ' Opinions:**\n' + roundOpinions.join('\n\n');
    }

    // Final voting round
    console.log(`\n🗳️  Council Debate - Final Voting`);
    
    for (const supervisor of available) {
      console.log(`\n🗳️  ${supervisor.name} is casting final vote...`);
      
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
        
        console.log(`✓ ${supervisor.name}: ${approved ? 'APPROVED' : 'REJECTED'}`);
      } catch (error) {
        console.error(`✗ ${supervisor.name} failed to vote:`, error);
        votes.push({
          supervisor: supervisor.name,
          approved: false,
          comment: 'Failed to vote',
        });
      }
    }

    // Calculate consensus
    const approvals = votes.filter(v => v.approved).length;
    const consensus = votes.length > 0 ? approvals / votes.length : 0;
    const threshold = this.config.consensusThreshold || 0.5;
    const approved = consensus >= threshold;

    console.log(`\n📊 Voting Results: ${approvals}/${votes.length} approved (${(consensus * 100).toFixed(0)}%)`);
    console.log(`Decision: ${approved ? '✅ APPROVED' : '❌ REJECTED'}`);

    return {
      approved,
      consensus,
      votes,
      reasoning: this.generateConsensusReasoning(votes, approved),
    };
  }

  /**
   * Format task for debate
   */
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

  /**
   * Parse vote from supervisor response
   */
  private parseVote(response: string): boolean {
    const normalized = response.toUpperCase();
    
    // Look for explicit vote markers (highest priority)
    if (normalized.includes('VOTE: APPROVE') || normalized.includes('VOTE:APPROVE')) {
      return true;
    }
    if (normalized.includes('VOTE: REJECT') || normalized.includes('VOTE:REJECT')) {
      return false;
    }
    
    // Look for clear approval/rejection statements at word boundaries
    // Use word boundary checks to avoid false matches in phrases
    const approveMatch = /\b(APPROVE|APPROVED|ACCEPT|ACCEPTED|LGTM)\b/.test(normalized);
    const rejectMatch = /\b(REJECT|REJECTED|DENY|DENIED)\b/.test(normalized);
    
    if (approveMatch && !rejectMatch) {
      return true;
    }
    if (rejectMatch && !approveMatch) {
      return false;
    }
    
    // If both or neither found, default to rejection for safety
    // (conservative approach - unclear votes should not auto-approve)
    return false;
  }

  /**
   * Generate consensus reasoning
   */
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
}
