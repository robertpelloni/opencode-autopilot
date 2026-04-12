package ws

import "borg-orchestrator/pkg/shared"

var Service = &WSManager{}

type WSManager struct{}

func (s *WSManager) NotifyLog(sessionId string, log shared.LogEntry) {}

func (s *WSManager) NotifyCouncilDecision(sessionId string, decision shared.CouncilDecision) {}
