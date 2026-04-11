package metrics

var Service = &MetricsService{}

type MetricsService struct{}

func (m *MetricsService) RecordSupervisorCall(supervisorName string, latencyMs int64, success bool, retryCount int) {}

func (m *MetricsService) RecordDebate(latencyMs int64, rounds int, consensusReached bool) {}
