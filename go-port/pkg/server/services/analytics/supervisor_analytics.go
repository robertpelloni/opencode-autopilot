package analytics

import "borg-orchestrator/pkg/shared"

var Service = &SupervisorAnalyticsService{}

type SupervisorAnalyticsService struct{}

func (s *SupervisorAnalyticsService) RecordVote(supervisor string, debateId string, vote string, confidence float64, responseTimeMs int64, tokensUsed int, consensusVote string) {}

func (s *SupervisorAnalyticsService) RecordDebateOutcome(taskId string, description string, mode shared.ConsensusMode, outcome string, participants []string, rounds int, durationMs int64) {}
