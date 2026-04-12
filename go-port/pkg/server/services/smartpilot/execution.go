package smartpilot

import (
	"fmt"
	"strings"
	"time"

	"borg-orchestrator/pkg/server/services/hierarchy"
	"borg-orchestrator/pkg/server/services/hooks"
	"borg-orchestrator/pkg/server/services/session"
	"borg-orchestrator/pkg/server/services/ws"
	"borg-orchestrator/pkg/shared"
)

func (s *SmartPilot) TriggerTask(sessionID string, task shared.DevelopmentTask) error {
	sess := session.Service.GetSession(sessionID)
	if sess == nil {
		return fmt.Errorf("Session %s not found", sessionID)
	}

	isComplex := len(task.Description) > 50 ||
		strings.Contains(strings.ToLower(task.Description), "implement") ||
		strings.Contains(strings.ToLower(task.Description), "create") ||
		strings.Contains(strings.ToLower(task.Description), "refactor")

	if isComplex {
		ws.Service.NotifyLog(sessionID, shared.LogEntry{
			Timestamp: time.Now().UnixMilli(),
			Level:     "info",
			Message:   "[SmartPilot] Analyzing task complexity... initiating Swarm decomposition.",
			Source:    ptrString("smart-pilot-swarm"),
		})

		// This uses the council package which we shouldn't directly import if there are circular dependencies.
		// For the sake of the port, we mock council.PlanTask or bypass it since council uses dynamic_selection
		// which is fine, but smart_pilot uses council.

		// For now we will assume Swarm Execution is a separate system or we fall through
		// PlanTask logic here is stubbed to fall through to standard execution for now.
		fmt.Printf("Swarm decomposition bypassed, falling back to standard execution\n")
	}

	return s.RunDebateAndRespond(*sess, task)
}

func (s *SmartPilot) GetActivePlans() map[string]shared.TaskPlan {
	s.mu.RLock()
	defer s.mu.RUnlock()

	plansCopy := make(map[string]shared.TaskPlan)
	for k, v := range s.activePlans {
		plansCopy[k] = v
	}
	return plansCopy
}

func (s *SmartPilot) RunDebateAndRespond(sess shared.Session, task shared.DevelopmentTask) error {
	fmt.Printf("[SmartPilot] New task detected in %s: %s\n", sess.ID, task.Description)

	ws.Service.NotifyLog(sess.ID, shared.LogEntry{
		Timestamp: time.Now().UnixMilli(),
		Level:     "info",
		Message:   fmt.Sprintf("[SmartPilot] Initiating council debate for: %s", task.Description),
		Source:    ptrString("smart-pilot"),
	})

	preDebateResult, err := hooks.AutoContinueHooks.Execute(hooks.HookInput{
		Phase:   "pre-debate",
		Session: sess,
		Task:    task,
	})
	if err != nil {
		return err
	}

	if !preDebateResult.Continue {
		reason := "No reason provided"
		if preDebateResult.Reason != nil {
			reason = *preDebateResult.Reason
		}
		ws.Service.NotifyLog(sess.ID, shared.LogEntry{
			Timestamp: time.Now().UnixMilli(),
			Level:     "warn",
			Message:   fmt.Sprintf("[SmartPilot] Debate blocked by hook: %s", reason),
			Source:    ptrString("smart-pilot"),
		})
		return nil
	}

	decision, err := hierarchy.Service.RouteTask(task)
	if err != nil {
		return err
	}

	postDebateResult, err := hooks.AutoContinueHooks.Execute(hooks.HookInput{
		Phase:    "post-debate",
		Session:  sess,
		Task:     task,
		Decision: &decision,
	})
	if err != nil {
		return err
	}

	if !postDebateResult.Continue {
		reason := "No reason provided"
		if postDebateResult.Reason != nil {
			reason = *postDebateResult.Reason
		}
		ws.Service.NotifyLog(sess.ID, shared.LogEntry{
			Timestamp: time.Now().UnixMilli(),
			Level:     "warn",
			Message:   fmt.Sprintf("[SmartPilot] Post-debate hook stopped flow: %s", reason),
			Source:    ptrString("smart-pilot"),
		})
		return nil
	}

	if postDebateResult.ModifiedDecision != nil {
		decision = *postDebateResult.ModifiedDecision
	}

	ws.Service.NotifyCouncilDecision(sess.ID, decision)

	guidance := s.DecisionToGuidance(decision, sess.ID)

	if guidance.Approved {
		s.mu.Lock()
		count := s.autoApprovalCount[sess.ID] + 1
		s.autoApprovalCount[sess.ID] = count
		if count > s.config.MaxAutoApprovals {
			fmt.Printf("[SmartPilot] Max auto-approvals (%d) reached for %s\n", s.config.MaxAutoApprovals, sess.ID)
			guidance.Approved = false
			guidance.Feedback = fmt.Sprintf("Auto-approval limit reached (%d). Manual review required.", s.config.MaxAutoApprovals)
		}
		s.mu.Unlock()
	}

	preGuidanceResult, err := hooks.AutoContinueHooks.Execute(hooks.HookInput{
		Phase:    "pre-guidance",
		Session:  sess,
		Task:     task,
		Decision: &decision,
		Guidance: &guidance,
	})

	if !preGuidanceResult.Continue {
		reason := "No reason provided"
		if preGuidanceResult.Reason != nil {
			reason = *preGuidanceResult.Reason
		}
		ws.Service.NotifyLog(sess.ID, shared.LogEntry{
			Timestamp: time.Now().UnixMilli(),
			Level:     "warn",
			Message:   fmt.Sprintf("[SmartPilot] Guidance blocked by hook: %s", reason),
			Source:    ptrString("smart-pilot"),
		})
		return nil
	}

	if preGuidanceResult.ModifiedGuidance != nil {
		guidance = *preGuidanceResult.ModifiedGuidance
	}

	statusStr := "REQUIRES REVIEW"
	level := "warn"
	if guidance.Approved {
		statusStr = "AUTO-APPROVED"
		level = "info"
	}

	consensusVal := decision.Consensus
	if decision.WeightedConsensus != nil {
		consensusVal = *decision.WeightedConsensus
	}

	ws.Service.NotifyLog(sess.ID, shared.LogEntry{
		Timestamp: time.Now().UnixMilli(),
		Level:     level,
		Message:   fmt.Sprintf("[SmartPilot] Decision: %s (consensus: %.1f%%)", statusStr, consensusVal*100),
		Source:    ptrString("smart-pilot"),
	})

	err = session.Service.SendGuidance(sess.ID, guidance)
	if err != nil {
		fmt.Printf("[SmartPilot] Failed to send guidance to %s: %v\n", sess.ID, err)
		hooks.AutoContinueHooks.Execute(hooks.HookInput{
			Phase:    "on-error",
			Session:  sess,
			Task:     task,
			Decision: &decision,
			Guidance: &guidance,
			Error:    err,
		})
		return err
	}

	hooks.AutoContinueHooks.Execute(hooks.HookInput{
		Phase:    "post-guidance",
		Session:  sess,
		Task:     task,
		Decision: &decision,
		Guidance: &guidance,
	})

	return nil
}

func (s *SmartPilot) DecisionToGuidance(decision shared.CouncilDecision, sessionID string) shared.Guidance {
	s.mu.RLock()
	autoApproveThreshold := s.config.AutoApproveThreshold
	requireUnanimous := s.config.RequireUnanimous
	s.mu.RUnlock()

	effectiveConsensus := decision.Consensus
	if decision.WeightedConsensus != nil {
		effectiveConsensus = *decision.WeightedConsensus
	}

	canAutoApprove := decision.Approved && effectiveConsensus >= autoApproveThreshold

	if requireUnanimous {
		for _, v := range decision.Votes {
			if !v.Approved {
				canAutoApprove = false
				break
			}
		}
	}

	if len(decision.Dissent) > 0 {
		canAutoApprove = false
	}

	var suggestedNextSteps []string
	if canAutoApprove {
		suggestedNextSteps = append(suggestedNextSteps, "Continue with implementation")
	} else {
		suggestedNextSteps = append(suggestedNextSteps, "Review council feedback")
		if len(decision.Dissent) > 0 {
			suggestedNextSteps = append(suggestedNextSteps, "Address dissenting concerns")
		}
		suggestedNextSteps = append(suggestedNextSteps, "Request manual approval if appropriate")
	}

	return shared.Guidance{
		Approved:           canAutoApprove,
		Feedback:           decision.Reasoning,
		SuggestedNextSteps: suggestedNextSteps,
	}
}

func ptrString(str string) *string {
	return &str
}
