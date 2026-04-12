package hierarchy

import "borg-orchestrator/pkg/shared"

var Service = &CouncilHierarchy{}

type CouncilHierarchy struct{}

func (s *CouncilHierarchy) RouteTask(task shared.DevelopmentTask) (shared.CouncilDecision, error) {
	return shared.CouncilDecision{}, nil
}
