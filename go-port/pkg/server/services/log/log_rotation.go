package log

import (
	"borg-orchestrator/pkg/server/services/config"
	"borg-orchestrator/pkg/shared"
)

var Service = &LogRotation{}

type LogRotation struct{}

func (s *LogRotation) Configure(config config.AutopilotConfig) {}
func (s *LogRotation) RegisterSession(sessionID string) {}
func (s *LogRotation) AddLog(sessionID string, entry shared.LogEntry) {}
