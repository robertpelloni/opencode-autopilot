package history

import "borg-orchestrator/pkg/shared"

var Service = &DebateHistoryService{}

type DebateHistoryService struct{}

func (s *DebateHistoryService) IsEnabled() bool { return false }

func (s *DebateHistoryService) SaveDebate(task shared.DevelopmentTask, decision shared.CouncilDecision, metadata map[string]interface{}) {}
