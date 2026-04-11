package council

import (
	"borg-orchestrator/pkg/shared"
	"fmt"
	"math"
)

func (c *SupervisorCouncil) handleSimpleMajority(votes []shared.Vote, config shared.CouncilConfig, leadVote *shared.Vote) (bool, string) {
	approvals := 0
	for _, v := range votes {
		if v.Approved {
			approvals++
		}
	}

	consensus := float64(0)
	if len(votes) > 0 {
		consensus = float64(approvals) / float64(len(votes))
	}

	threshold := 0.5
	if config.ConsensusThreshold != nil {
		threshold = *config.ConsensusThreshold
	}

	approved := consensus >= threshold
	reasoning := fmt.Sprintf("Simple majority: %d/%d (%.0f%%) approved (threshold: %.0f%%)", approvals, len(votes), consensus*100, threshold*100)

	return approved, reasoning
}

func (c *SupervisorCouncil) handleSupermajority(votes []shared.Vote, config shared.CouncilConfig, leadVote *shared.Vote) (bool, string) {
	approvals := 0
	for _, v := range votes {
		if v.Approved {
			approvals++
		}
	}

	// 2/3 = 0.6666... In JS, `votes.length * 0.667`
	threshold := float64(len(votes)) * 0.667
	approved := float64(approvals) >= threshold
	reasoning := fmt.Sprintf("Supermajority: %d/%d approved (need >=%d, 66.7%%)", approvals, len(votes), int(math.Ceil(threshold)))

	return approved, reasoning
}

func (c *SupervisorCouncil) handleUnanimous(votes []shared.Vote, config shared.CouncilConfig, leadVote *shared.Vote) (bool, string) {
	approvals := 0
	for _, v := range votes {
		if v.Approved {
			approvals++
		}
	}

	approved := approvals == len(votes)
	reasoning := fmt.Sprintf("Unanimous: %d/%d approved (need %d/%d)", approvals, len(votes), len(votes), len(votes))

	return approved, reasoning
}

func (c *SupervisorCouncil) handleWeighted(votes []shared.Vote, config shared.CouncilConfig, leadVote *shared.Vote) (bool, string) {
	weightedConsensus := c.calculateWeightedConsensus(votes)
	threshold := 0.5
	if config.ConsensusThreshold != nil {
		threshold = *config.ConsensusThreshold
	}

	approved := weightedConsensus >= threshold
	reasoning := fmt.Sprintf("Weighted consensus: %.1f%% (threshold: %.1f%%)", weightedConsensus*100, threshold*100)

	return approved, reasoning
}

func (c *SupervisorCouncil) handleCeoOverride(votes []shared.Vote, config shared.CouncilConfig, leadVote *shared.Vote) (bool, string) {
	if leadVote == nil {
		return c.handleWeighted(votes, config, leadVote)
	}

	voteStr := "REJECTED"
	if leadVote.Approved {
		voteStr = "APPROVED"
	}

	leadName := "Lead"
	if config.LeadSupervisor != nil {
		leadName = *config.LeadSupervisor
	}

	reasoning := fmt.Sprintf("CEO Override: %s %s (confidence: %.2f)", leadName, voteStr, leadVote.Confidence)
	return leadVote.Approved, reasoning
}

func (c *SupervisorCouncil) handleCeoVeto(votes []shared.Vote, config shared.CouncilConfig, leadVote *shared.Vote) (bool, string) {
	approvals := 0
	for _, v := range votes {
		if v.Approved {
			approvals++
		}
	}

	majorityApproved := approvals > len(votes)/2

	if leadVote != nil && !leadVote.Approved && leadVote.Confidence >= 0.7 {
		majorityStr := "against"
		if majorityApproved {
			majorityStr = "in favor"
		}

		leadName := "Lead"
		if config.LeadSupervisor != nil {
			leadName = *config.LeadSupervisor
		}

		reasoning := fmt.Sprintf("CEO Veto: %s VETOED with high confidence (%.2f). Majority was %s.", leadName, leadVote.Confidence, majorityStr)
		return false, reasoning
	}

	majorityStr := "rejected"
	if majorityApproved {
		majorityStr = "approved"
	}

	leadName := "Lead"
	if config.LeadSupervisor != nil {
		leadName = *config.LeadSupervisor
	}

	reasoning := fmt.Sprintf("CEO Veto (not used): Majority %s (%d/%d). %s did not veto.", majorityStr, approvals, len(votes), leadName)
	return majorityApproved, reasoning
}

func (c *SupervisorCouncil) handleHybridCeoMajority(votes []shared.Vote, config shared.CouncilConfig, leadVote *shared.Vote) (bool, string) {
	approvals := 0
	for _, v := range votes {
		if v.Approved {
			approvals++
		}
	}
	rejections := len(votes) - approvals

	if approvals > rejections+1 {
		reasoning := fmt.Sprintf("Hybrid CEO-Majority: Clear majority approved (%d/%d)", approvals, len(votes))
		return true, reasoning
	}

	if rejections > approvals+1 {
		reasoning := fmt.Sprintf("Hybrid CEO-Majority: Clear majority rejected (%d/%d against)", rejections, len(votes))
		return false, reasoning
	}

	if leadVote != nil {
		voteStr := "REJECTED"
		if leadVote.Approved {
			voteStr = "APPROVED"
		}

		leadName := "Lead"
		if config.LeadSupervisor != nil {
			leadName = *config.LeadSupervisor
		}

		reasoning := fmt.Sprintf("Hybrid CEO-Majority: Tie/close vote (%d-%d), %s breaks tie: %s", approvals, rejections, leadName, voteStr)
		return leadVote.Approved, reasoning
	}

	majorityStr := "reject"
	if approvals >= rejections {
		majorityStr = "approve"
	}

	reasoning := fmt.Sprintf("Hybrid CEO-Majority: Tie/close vote (%d-%d), no CEO to break tie, defaulting to %s", approvals, rejections, majorityStr)
	return approvals >= rejections, reasoning
}

func (c *SupervisorCouncil) handleRankedChoice(votes []shared.Vote, config shared.CouncilConfig, leadVote *shared.Vote) (bool, string) {
	var approveScore float64 = 0
	var rejectScore float64 = 0

	for _, vote := range votes {
		score := vote.Weight * vote.Confidence
		if vote.Approved {
			approveScore += score
		} else {
			rejectScore += score
		}
	}

	approved := approveScore >= rejectScore
	reasoning := fmt.Sprintf("Ranked Choice: Approve score %.2f vs Reject score %.2f", approveScore, rejectScore)

	return approved, reasoning
}
