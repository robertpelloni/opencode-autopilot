package health

import "borg-orchestrator/pkg/server/services/config"

var Service = &HealthMonitor{}

type HealthMonitor struct{}

func (s *HealthMonitor) Configure(config config.AutopilotConfig) {}
func (s *HealthMonitor) ResetHealth(sessionID string) {}
func (s *HealthMonitor) SetRestartCallback(cb func(string, string) bool) {}
