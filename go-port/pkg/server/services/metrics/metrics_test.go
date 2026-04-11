package metrics

import (
	"strings"
	"testing"
)

func TestMetricsService(t *testing.T) {
	service := NewMetricsService()

	// Test HTTP request recording
	service.RecordHttpRequest("GET", "/api/test/123", 200, 100)
	service.RecordHttpRequest("GET", "/api/test/456", 500, 200)

	summary := service.GetSummary()

	if summary.HTTP.TotalRequests != 2 {
		t.Errorf("Expected 2 HTTP requests, got %d", summary.HTTP.TotalRequests)
	}
	if summary.HTTP.TotalErrors != 1 {
		t.Errorf("Expected 1 HTTP error, got %d", summary.HTTP.TotalErrors)
	}
	if summary.HTTP.AvgLatencyMs != 150 {
		t.Errorf("Expected 150ms average latency, got %d", summary.HTTP.AvgLatencyMs)
	}

	endpointSummary, ok := summary.HTTP.ByEndpoint["GET /api/test/:id"]
	if !ok {
		t.Errorf("Expected endpoint 'GET /api/test/:id' to be present")
	}
	if endpointSummary.Count != 2 {
		t.Errorf("Expected endpoint count 2, got %d", endpointSummary.Count)
	}

	// Test supervisor call recording
	service.RecordSupervisorCall("openai", 1000, true, 0)
	service.RecordSupervisorCall("openai", 2000, false, 2)

	summary = service.GetSummary()

	if summary.Supervisors.TotalCalls != 2 {
		t.Errorf("Expected 2 supervisor calls, got %d", summary.Supervisors.TotalCalls)
	}
	if summary.Supervisors.TotalErrors != 1 {
		t.Errorf("Expected 1 supervisor error, got %d", summary.Supervisors.TotalErrors)
	}
	if summary.Supervisors.AvgLatencyMs != 1500 {
		t.Errorf("Expected 1500ms supervisor average latency, got %d", summary.Supervisors.AvgLatencyMs)
	}

	openaiSummary, ok := summary.Supervisors.ByProvider["openai"]
	if !ok {
		t.Errorf("Expected supervisor 'openai' to be present")
	}
	if openaiSummary.Retries != 2 {
		t.Errorf("Expected 2 retries for openai, got %d", openaiSummary.Retries)
	}

	// Test debate recording
	service.RecordDebate(5000, 2, true)
	service.RecordDebate(3000, 3, false)

	summary = service.GetSummary()

	if summary.Debates.Count != 2 {
		t.Errorf("Expected 2 debates, got %d", summary.Debates.Count)
	}
	if summary.Debates.ConsensusRate != 0.5 {
		t.Errorf("Expected consensus rate 0.5, got %f", summary.Debates.ConsensusRate)
	}
	if summary.Debates.AvgRounds != 2.5 {
		t.Errorf("Expected average rounds 2.5, got %f", summary.Debates.AvgRounds)
	}

	// Test Prometheus format
	prom := service.GetPrometheusFormat()
	if !strings.Contains(prom, "autopilot_http_requests_total{method=\"GET\",path=\"/api/test/:id\"} 2") {
		t.Errorf("Prometheus output missing HTTP request metrics")
	}
	if !strings.Contains(prom, "autopilot_supervisor_calls_total{supervisor=\"openai\"} 2") {
		t.Errorf("Prometheus output missing supervisor metrics")
	}

	// Test Reset
	service.Reset()
	summary = service.GetSummary()
	if summary.HTTP.TotalRequests != 0 || summary.Supervisors.TotalCalls != 0 || summary.Debates.Count != 0 {
		t.Errorf("Expected metrics to be reset")
	}
}
