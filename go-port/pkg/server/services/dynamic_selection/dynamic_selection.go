package dynamic_selection

import "borg-orchestrator/pkg/shared"

var Service = &DynamicSupervisorSelection{}

type DynamicSupervisorSelection struct{}

func (s *DynamicSupervisorSelection) SetEnabled(enabled bool) {}

func (s *DynamicSupervisorSelection) IsEnabled() bool { return false }

func (s *DynamicSupervisorSelection) SetAvailableSupervisors(names []string) {}

func (s *DynamicSupervisorSelection) SelectTeam(task shared.DevelopmentTask) shared.TeamSelectionResult {
	return shared.TeamSelectionResult{}
}
