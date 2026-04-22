package council

import (
	"borg-orchestrator/pkg/server/services/analytics"
	"borg-orchestrator/pkg/server/services/dynamic_selection"
	"borg-orchestrator/pkg/server/services/history"
	"borg-orchestrator/pkg/server/services/metrics"
	"borg-orchestrator/pkg/shared"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"
)

func (c *SupervisorCouncil) getNextFallbackSupervisor() shared.Supervisor {
	fallbackChain := c.GetFallbackChain()

	for c.fallbackIndex < len(fallbackChain) {
		name := fallbackChain[c.fallbackIndex]
		var supervisor shared.Supervisor
		for _, s := range c.supervisors {
			if s.GetName() == name {
				supervisor = s
				break
			}
		}
		c.fallbackIndex++

		if supervisor != nil {
			if isAvail, err := supervisor.IsAvailable(); err == nil && isAvail {
				return supervisor
			}
		}
	}

	c.fallbackIndex = 0
	return nil
}

func (c *SupervisorCouncil) ChatWithFallback(messages []shared.Message) (string, string, error) {
	if c.config.LeadSupervisor != nil {
		var lead shared.Supervisor
		for _, s := range c.supervisors {
			if s.GetName() == *c.config.LeadSupervisor {
				lead = s
				break
			}
		}
		if lead != nil {
			if isAvail, err := lead.IsAvailable(); err == nil && isAvail {
				response, err := lead.Chat(messages)
				if err == nil {
					return response, lead.GetName(), nil
				}
			}
		}
	}

	fallback := c.getNextFallbackSupervisor()
	for fallback != nil {
		response, err := fallback.Chat(messages)
		if err == nil {
			return response, fallback.GetName(), nil
		}
		fallback = c.getNextFallbackSupervisor()
	}

	available := c.GetAvailableSupervisors()
	for _, supervisor := range available {
		response, err := supervisor.Chat(messages)
		if err == nil {
			return response, supervisor.GetName(), nil
		}
	}

	return "", "", fmt.Errorf("no supervisors available or all chat requests failed")
}

func (c *SupervisorCouncil) Debate(task shared.DevelopmentTask) (shared.CouncilDecision, error) {
	startTime := time.Now()

	var supervisorNames []string
	for _, s := range c.supervisors {
		supervisorNames = append(supervisorNames, s.GetName())
	}
	dynamic_selection.Service.SetAvailableSupervisors(supervisorNames)

	supervisorsToUse := c.supervisors
	consensusModeToUse := c.GetConsensusMode()
	leadSupervisorToUse := c.config.LeadSupervisor

	var dynamicSelectionInfo *string
	var dynamicSelectionData map[string]interface{}

	if dynamic_selection.Service.IsEnabled() {
		selection := dynamic_selection.Service.SelectTeam(task)

		var selectedSupervisors []shared.Supervisor
		for _, s := range c.supervisors {
			for _, t := range selection.Team {
				if s.GetName() == t {
					selectedSupervisors = append(selectedSupervisors, s)
					break
				}
			}
		}

		if len(selectedSupervisors) > 0 {
			supervisorsToUse = selectedSupervisors
			if leadSupervisorToUse == nil {
				leadSupervisorToUse = selection.LeadSupervisor
			}
			info := fmt.Sprintf("**Dynamic Selection:** %s (confidence: %.0f%%)", selection.Reasoning, selection.Confidence*100)
			dynamicSelectionInfo = &info
			dynamicSelectionData = map[string]interface{}{
				"enabled":    true,
				"taskType":   selection.TaskType,
				"confidence": selection.Confidence,
			}
		}
	}

	var available []shared.Supervisor
	for _, supervisor := range supervisorsToUse {
		if isAvail, err := supervisor.IsAvailable(); err == nil && isAvail {
			available = append(available, supervisor)
		}
	}

	if len(available) == 0 {
		metrics.Service.RecordDebate(time.Since(startTime).Milliseconds(), 0, true)
		return shared.CouncilDecision{
			Approved:          true,
			Consensus:         1.0,
			WeightedConsensus: func(f float64) *float64 { return &f }(1.0),
			Votes:             []shared.Vote{},
			Reasoning:         "No supervisors available - auto-approving",
			Dissent:           []string{},
		}, nil
	}

	rounds := 2
	if c.config.DebateRounds != nil {
		rounds = *c.config.DebateRounds
	}

	var votes []shared.Vote

	taskContext := shared.Message{
		Role:    "user",
		Content: c.formatTaskForDebate(task),
	}

	// Round 1
	var initialOpinions []string
	for _, supervisor := range available {
		response, err := supervisor.Chat([]shared.Message{taskContext})
		if err != nil {
			initialOpinions = append(initialOpinions, fmt.Sprintf("**%s**: [Unable to provide opinion]", supervisor.GetName()))
		} else {
			initialOpinions = append(initialOpinions, fmt.Sprintf("**%s**: %s", supervisor.GetName(), response))
		}
	}

	debateContext := taskContext.Content + "\n\n**Initial Opinions:**\n" + strings.Join(initialOpinions, "\n\n")

	// Additional Rounds
	for round := 2; round <= rounds; round++ {
		var roundOpinions []string
		for _, supervisor := range available {
			message := shared.Message{
				Role:    "user",
				Content: debateContext + "\n\nConsidering the above opinions, provide your refined assessment.",
			}
			response, err := supervisor.Chat([]shared.Message{message})
			if err == nil {
				roundOpinions = append(roundOpinions, fmt.Sprintf("**%s**: %s", supervisor.GetName(), response))
			}
		}
		debateContext += fmt.Sprintf("\n\n**Round %d Opinions:**\n%s", round, strings.Join(roundOpinions, "\n\n"))
	}

	// Final Voting
	type voteResult struct {
		vote           shared.Vote
		responseTimeMs int64
	}
	var voteResults []voteResult

	for _, supervisor := range available {
		voteStartTime := time.Now()
		votePrompt := shared.Message{
			Role: "user",
			Content: debateContext +
				"\n\nBased on all discussions, provide your FINAL VOTE:\n" +
				"1. Vote: APPROVE or REJECT\n" +
				"2. Confidence: A number between 0.0 and 1.0 (how confident are you in this decision?)\n" +
				"3. Brief reasoning (2-3 sentences)\n\n" +
				"Format:\nVOTE: [APPROVE/REJECT]\nCONFIDENCE: [0.0-1.0]\nREASONING: [your reasoning]",
		}

		response, err := supervisor.Chat([]shared.Message{votePrompt})
		responseTimeMs := time.Since(voteStartTime).Milliseconds()

		if err != nil {
			voteResults = append(voteResults, voteResult{
				vote: shared.Vote{
					Supervisor: supervisor.GetName(),
					Approved:   false,
					Confidence: 0.5,
					Weight:     c.GetSupervisorWeight(supervisor.GetName()),
					Comment:    "Failed to vote",
				},
				responseTimeMs: responseTimeMs,
			})
		} else {
			voteResults = append(voteResults, voteResult{
				vote: shared.Vote{
					Supervisor: supervisor.GetName(),
					Approved:   c.parseVote(response),
					Confidence: c.parseConfidence(response),
					Weight:     c.GetSupervisorWeight(supervisor.GetName()),
					Comment:    response,
				},
				responseTimeMs: responseTimeMs,
			})
		}
	}

	for _, vr := range voteResults {
		votes = append(votes, vr.vote)
	}

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

	weightedConsensus := c.calculateWeightedConsensus(votes)
	dissent := c.extractDissent(votes)

	var leadVote *shared.Vote
	if leadSupervisorToUse != nil {
		for _, v := range votes {
			if v.Supervisor == *leadSupervisorToUse {
				leadVoteVal := v
				leadVote = &leadVoteVal
				break
			}
		}
	}

	mode := consensusModeToUse
	handler := c.consensusHandlers[mode]
	if handler == nil {
		handler = c.handleWeighted
	}

	approved, modeReasoning := handler(votes, c.config, leadVote)

	metrics.Service.RecordDebate(time.Since(startTime).Milliseconds(), rounds, approved)

	durationMs := time.Since(startTime).Milliseconds()

	desc := task.Description
	if len(desc) > 100 {
		desc = desc[:100]
	}

	outcomeStr := "rejected"
	if approved {
		outcomeStr = "approved"
	}

	var availNames []string
	for _, s := range available {
		availNames = append(availNames, s.GetName())
	}

	analytics.Service.RecordDebateOutcome(
		task.ID,
		desc,
		mode,
		outcomeStr,
		availNames,
		rounds,
		durationMs,
	)

	for _, vr := range voteResults {
		vote := vr.vote
		voteStr := "reject"
		if vote.Approved {
			voteStr = "approve"
		}
		conVoteStr := "reject"
		if approved {
			conVoteStr = "approve"
		}

		analytics.Service.RecordVote(
			vote.Supervisor,
			task.ID,
			voteStr,
			vote.Confidence,
			vr.responseTimeMs,
			0,
			conVoteStr,
		)
	}

	decision := shared.CouncilDecision{
		Approved:          approved,
		Consensus:         consensus,
		WeightedConsensus: &weightedConsensus,
		Votes:             votes,
		Reasoning:         c.generateConsensusReasoning(votes, approved, weightedConsensus, dissent, mode, modeReasoning, dynamicSelectionInfo),
		Dissent:           dissent,
	}

	if (&history.DebateHistoryService{}).IsEnabled() {
		(&history.DebateHistoryService{}).SaveDebate(task, decision, map[string]interface{}{
			"debateRounds":     rounds,
			"consensusMode":    mode,
			"leadSupervisor":   leadSupervisorToUse,
			"dynamicSelection": dynamicSelectionData,
			"durationMs":       durationMs,
		})
	}

	return decision, nil
}

func (c *SupervisorCouncil) PlanTask(task shared.DevelopmentTask) (shared.TaskPlan, error) {
	available := c.GetAvailableSupervisors()
	if len(available) == 0 {
		return shared.TaskPlan{}, fmt.Errorf("No supervisors available for planning")
	}

	var planner shared.Supervisor
	if c.config.LeadSupervisor != nil {
		for _, s := range available {
			if s.GetName() == *c.config.LeadSupervisor {
				planner = s
				break
			}
		}
	}
	if planner == nil {
		planner = available[0]
	}

	context := task.Context
	if context == "" {
		context = "No additional context"
	}

	planningPrompt := shared.Message{
		Role: "user",
		Content: fmt.Sprintf(`
# Task Decomposition

**Goal**: Break down the following high-level task into smaller, executable subtasks.

**Task Description**: %s
**Context**: %s

**Instructions**:
1. Analyze the task requirements.
2. Identify independent components or sequential steps.
3. Assign each subtask to the most suitable AI CLI tool if applicable:
   - 'opencode': Best for multi-file editing and workspace management.
   - 'gemini': Best for research, complex reasoning, and multimodal tasks.
   - 'copilot': Best for quick code suggestions, shell commands, and explaining existing logic.
4. Generate a JSON list of subtasks. Each subtask must have:
   - id: string (unique)
   - title: string
   - description: string (detailed instructions)
   - dependencies: string[] (ids of tasks that must finish first)
   - preferredCLI: 'opencode' | 'gemini' | 'copilot' | null (optional)

**Output Format**:
You MUST return ONLY a JSON object with this structure:
{
  "reasoning": "Brief explanation of the plan...",
  "subtasks": [
    { "id": "1", "title": "...", "description": "...", "dependencies": [], "preferredCLI": "opencode" }
  ]
}
`, task.Description, context),
	}

	response, err := planner.Chat([]shared.Message{planningPrompt})
	if err == nil {
		jsonRegex := regexp.MustCompile(`\{[\s\S]*\}`)
		match := jsonRegex.FindString(response)
		if match != "" {
			var plan shared.TaskPlan
			if err := json.Unmarshal([]byte(match), &plan); err == nil {
				plan.OriginalTaskID = task.ID
				for i := range plan.Subtasks {
					plan.Subtasks[i].Status = shared.SubTaskPending
				}
				return plan, nil
			}
		}
	}

	fmt.Printf("Planning failed, falling back to single task\n")

	// Fallback
	return shared.TaskPlan{
		OriginalTaskID: task.ID,
		Reasoning:      "Automatic decomposition failed, treating as single task.",
		Subtasks: []shared.SubTask{
			{
				ID:           task.ID + "-1",
				Title:        "Execute Task",
				Description:  task.Description,
				Dependencies: []string{},
				Status:       shared.SubTaskPending,
			},
		},
	}, nil
}
