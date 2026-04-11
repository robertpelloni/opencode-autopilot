package council

import (
	"borg-orchestrator/pkg/shared"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

func (c *SupervisorCouncil) calculateWeightedConsensus(votes []shared.Vote) float64 {
	if len(votes) == 0 {
		return 0
	}

	var weightedApprovals float64 = 0
	var totalWeight float64 = 0

	for _, vote := range votes {
		effectiveWeight := vote.Weight * vote.Confidence
		totalWeight += vote.Weight
		if vote.Approved {
			weightedApprovals += effectiveWeight
		}
	}

	if totalWeight > 0 {
		return weightedApprovals / totalWeight
	}
	return 0
}

func (c *SupervisorCouncil) extractDissent(votes []shared.Vote) []string {
	var dissent []string

	for _, vote := range votes {
		if !vote.Approved && vote.Confidence > 0.7 {
			shortComment := vote.Comment
			if len(shortComment) > 300 {
				shortComment = shortComment[:300] + "..."
			}
			dissent = append(dissent, fmt.Sprintf("%s (confidence: %.2f): %s", vote.Supervisor, vote.Confidence, shortComment))
		}
	}

	return dissent
}

var confidenceRegex = regexp.MustCompile(`(?i)CONFIDENCE:\s*([\d.]+)`)
var altConfidenceRegex = regexp.MustCompile(`(?i)confidence[:\s]+(\d+(?:\.\d+)?)`)

func (c *SupervisorCouncil) parseConfidence(response string) float64 {
	if match := confidenceRegex.FindStringSubmatch(response); len(match) > 1 {
		if value, err := strconv.ParseFloat(match[1], 64); err == nil {
			if value > 1 {
				return math.Min(1, value/100)
			}
			return math.Max(0, math.Min(1, value))
		}
	}

	if match := altConfidenceRegex.FindStringSubmatch(response); len(match) > 1 {
		if value, err := strconv.ParseFloat(match[1], 64); err == nil {
			if value > 1 {
				return math.Min(1, value/100)
			}
			return math.Max(0, math.Min(1, value))
		}
	}

	return 0.7
}

func (c *SupervisorCouncil) formatTaskForDebate(task shared.DevelopmentTask) string {
	filesAffected := strings.Join(task.Files, "\n")
	return fmt.Sprintf(`# Development Task Review

**Task ID**: %s
**Description**: %s

**Context**:
%s

**Files Affected**:
%s

**Your Role**:
As a supervisor, review this development task and provide your expert opinion on:
1. Code quality and best practices
2. Potential issues or risks
3. Suggestions for improvement
4. Whether this task should be approved to proceed

Be thorough but concise in your analysis.`, task.ID, task.Description, task.Context, filesAffected)
}

var approveRegex = regexp.MustCompile(`\b(APPROVE|APPROVED|ACCEPT|ACCEPTED|LGTM)\b`)
var rejectRegex = regexp.MustCompile(`\b(REJECT|REJECTED|DENY|DENIED)\b`)

func (c *SupervisorCouncil) parseVote(response string) bool {
	normalized := strings.ToUpper(response)

	if strings.Contains(normalized, "VOTE: APPROVE") || strings.Contains(normalized, "VOTE:APPROVE") {
		return true
	}
	if strings.Contains(normalized, "VOTE: REJECT") || strings.Contains(normalized, "VOTE:REJECT") {
		return false
	}

	approveMatch := approveRegex.MatchString(normalized)
	rejectMatch := rejectRegex.MatchString(normalized)

	if approveMatch && !rejectMatch {
		return true
	}
	if rejectMatch && !approveMatch {
		return false
	}

	return false
}

func (c *SupervisorCouncil) generateConsensusReasoning(
	votes []shared.Vote,
	approved bool,
	weightedConsensus float64,
	dissent []string,
	mode shared.ConsensusMode,
	modeReasoning string,
	dynamicSelectionInfo *string,
) string {
	approvals := 0
	var totalConfidence float64 = 0

	for _, v := range votes {
		if v.Approved {
			approvals++
		}
		totalConfidence += v.Confidence
	}

	avgConfidence := float64(0)
	if len(votes) > 0 {
		avgConfidence = totalConfidence / float64(len(votes))
	}

	reasoning := ""

	if dynamicSelectionInfo != nil && *dynamicSelectionInfo != "" {
		reasoning += *dynamicSelectionInfo + "\n\n"
	}

	reasoning += fmt.Sprintf("After %d supervisor votes using **%s** mode, ", len(votes), string(mode))

	if approved {
		reasoning += "the council has reached consensus to APPROVE this task."
	} else {
		reasoning += "the council has decided to REJECT this task."
	}

	reasoning += fmt.Sprintf("\n\n**Consensus Mode Decision:**\n%s", modeReasoning)

	reasoning += "\n\n**Voting Summary:**"
	reasoning += fmt.Sprintf("\n- Simple consensus: %d/%d approved (%.0f%%)", approvals, len(votes), float64(approvals)/float64(len(votes))*100)
	reasoning += fmt.Sprintf("\n- Weighted consensus: %.1f%%", weightedConsensus*100)
	reasoning += fmt.Sprintf("\n- Average confidence: %.1f%%", avgConfidence*100)

	if c.config.LeadSupervisor != nil {
		var leadVote *shared.Vote
		for _, v := range votes {
			if v.Supervisor == *c.config.LeadSupervisor {
				leadVote = &v
				break
			}
		}
		if leadVote != nil {
			voteStr := "REJECTED"
			if leadVote.Approved {
				voteStr = "APPROVED"
			}
			reasoning += fmt.Sprintf("\n- Lead supervisor (%s): %s (confidence: %.2f)", *c.config.LeadSupervisor, voteStr, leadVote.Confidence)
		}
	}

	if len(dissent) > 0 {
		reasoning += fmt.Sprintf("\n\n**Strong Dissenting Opinions (%d):**", len(dissent))
		for _, d := range dissent {
			reasoning += fmt.Sprintf("\n- %s", d)
		}
	}

	reasoning += "\n\n**Individual Votes:**"

	for _, vote := range votes {
		status := "❌"
		if vote.Approved {
			status = "✅"
		}
		isLead := ""
		if c.config.LeadSupervisor != nil && vote.Supervisor == *c.config.LeadSupervisor {
			isLead = " [LEAD]"
		}
		comment := vote.Comment
		if len(comment) > 150 {
			comment = comment[:150] + "..."
		}
		reasoning += fmt.Sprintf("\n- %s %s%s (weight: %.1f, confidence: %.2f): %s", status, vote.Supervisor, isLead, vote.Weight, vote.Confidence, comment)
	}

	return reasoning
}
