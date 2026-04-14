package hooks

import "borg-orchestrator/pkg/shared"

var AutoContinueHooks = &HooksManager{}

type HooksManager struct{}

type HookResult struct {
	Continue         bool
	Reason           *string
	ModifiedDecision *shared.CouncilDecision
	ModifiedGuidance *shared.Guidance
}

type HookInput struct {
	Phase    string
	Session  shared.Session
	Task     shared.DevelopmentTask
	Decision *shared.CouncilDecision
	Guidance *shared.Guidance
	Error    error
}

func (s *HooksManager) Execute(input HookInput) (HookResult, error) {
	return HookResult{Continue: true}, nil
}
