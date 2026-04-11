package metrics

import (
	"fmt"
	"math"
	"regexp"
	"strings"
	"sync"
	"time"
)

type RequestMetric struct {
	Count          int64
	TotalLatencyMs int64
	Errors         int64
	LastRequestAt  int64
}

type SupervisorMetric struct {
	Calls          int64
	TotalLatencyMs int64
	Errors         int64
	Retries        int64
	LastCallAt     int64
}

type DebateMetric struct {
	Count            int64
	TotalLatencyMs   int64
	TotalRounds      int64
	ConsensusReached int64
	LastDebateAt     int64
}

type EndpointSummary struct {
	Count        int64   `json:"count"`
	AvgLatencyMs int64   `json:"avgLatencyMs"`
	ErrorRate    float64 `json:"errorRate"`
}

type ProviderSummary struct {
	Calls        int64   `json:"calls"`
	AvgLatencyMs int64   `json:"avgLatencyMs"`
	ErrorRate    float64 `json:"errorRate"`
	Retries      int64   `json:"retries"`
}

type HTTPSummary struct {
	TotalRequests int64                      `json:"totalRequests"`
	TotalErrors   int64                      `json:"totalErrors"`
	AvgLatencyMs  int64                      `json:"avgLatencyMs"`
	ByEndpoint    map[string]EndpointSummary `json:"byEndpoint"`
}

type SupervisorsSummary struct {
	TotalCalls   int64                      `json:"totalCalls"`
	TotalErrors  int64                      `json:"totalErrors"`
	AvgLatencyMs int64                      `json:"avgLatencyMs"`
	ByProvider   map[string]ProviderSummary `json:"byProvider"`
}

type DebatesSummary struct {
	Count         int64   `json:"count"`
	AvgLatencyMs  int64   `json:"avgLatencyMs"`
	AvgRounds     float64 `json:"avgRounds"`
	ConsensusRate float64 `json:"consensusRate"`
}

type MetricsSummary struct {
	Uptime      int64              `json:"uptime"`
	HTTP        HTTPSummary        `json:"http"`
	Supervisors SupervisorsSummary `json:"supervisors"`
	Debates     DebatesSummary     `json:"debates"`
}

type MetricsService struct {
	mu              sync.RWMutex
	httpRequests    map[string]*RequestMetric
	supervisorCalls map[string]*SupervisorMetric
	debateMetrics   DebateMetric
	startTime       time.Time
}

var Service = NewMetricsService()

func NewMetricsService() *MetricsService {
	return &MetricsService{
		httpRequests:    make(map[string]*RequestMetric),
		supervisorCalls: make(map[string]*SupervisorMetric),
		startTime:       time.Now(),
	}
}

func (m *MetricsService) RecordHttpRequest(method string, path string, statusCode int, latencyMs int64) {
	key := fmt.Sprintf("%s %s", method, m.normalizePath(path))

	m.mu.Lock()
	defer m.mu.Unlock()

	existing, ok := m.httpRequests[key]
	if !ok {
		existing = &RequestMetric{}
		m.httpRequests[key] = existing
	}

	existing.Count++
	existing.TotalLatencyMs += latencyMs
	existing.LastRequestAt = time.Now().UnixMilli()
	if statusCode >= 400 {
		existing.Errors++
	}
}

func (m *MetricsService) RecordSupervisorCall(supervisorName string, latencyMs int64, success bool, retryCount int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	existing, ok := m.supervisorCalls[supervisorName]
	if !ok {
		existing = &SupervisorMetric{}
		m.supervisorCalls[supervisorName] = existing
	}

	existing.Calls++
	existing.TotalLatencyMs += latencyMs
	existing.Retries += int64(retryCount)
	existing.LastCallAt = time.Now().UnixMilli()
	if !success {
		existing.Errors++
	}
}

func (m *MetricsService) RecordDebate(latencyMs int64, rounds int, consensusReached bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.debateMetrics.Count++
	m.debateMetrics.TotalLatencyMs += latencyMs
	m.debateMetrics.TotalRounds += int64(rounds)
	if consensusReached {
		m.debateMetrics.ConsensusReached++
	}
	m.debateMetrics.LastDebateAt = time.Now().UnixMilli()
}

func (m *MetricsService) GetSummary() MetricsSummary {
	m.mu.RLock()
	defer m.mu.RUnlock()

	httpTotalRequests := int64(0)
	httpTotalLatency := int64(0)
	httpTotalErrors := int64(0)
	byEndpoint := make(map[string]EndpointSummary)

	for key, metric := range m.httpRequests {
		httpTotalRequests += metric.Count
		httpTotalLatency += metric.TotalLatencyMs
		httpTotalErrors += metric.Errors

		avgLatency := int64(0)
		errorRate := float64(0)
		if metric.Count > 0 {
			avgLatency = int64(math.Round(float64(metric.TotalLatencyMs) / float64(metric.Count)))
			errorRate = float64(metric.Errors) / float64(metric.Count)
		}

		byEndpoint[key] = EndpointSummary{
			Count:        metric.Count,
			AvgLatencyMs: avgLatency,
			ErrorRate:    errorRate,
		}
	}

	supervisorTotalCalls := int64(0)
	supervisorTotalLatency := int64(0)
	supervisorTotalErrors := int64(0)
	byProvider := make(map[string]ProviderSummary)

	for name, metric := range m.supervisorCalls {
		supervisorTotalCalls += metric.Calls
		supervisorTotalLatency += metric.TotalLatencyMs
		supervisorTotalErrors += metric.Errors

		avgLatency := int64(0)
		errorRate := float64(0)
		if metric.Calls > 0 {
			avgLatency = int64(math.Round(float64(metric.TotalLatencyMs) / float64(metric.Calls)))
			errorRate = float64(metric.Errors) / float64(metric.Calls)
		}

		byProvider[name] = ProviderSummary{
			Calls:        metric.Calls,
			AvgLatencyMs: avgLatency,
			ErrorRate:    errorRate,
			Retries:      metric.Retries,
		}
	}

	httpAvgLatency := int64(0)
	if httpTotalRequests > 0 {
		httpAvgLatency = int64(math.Round(float64(httpTotalLatency) / float64(httpTotalRequests)))
	}

	supervisorAvgLatency := int64(0)
	if supervisorTotalCalls > 0 {
		supervisorAvgLatency = int64(math.Round(float64(supervisorTotalLatency) / float64(supervisorTotalCalls)))
	}

	debateAvgLatency := int64(0)
	debateAvgRounds := float64(0)
	debateConsensusRate := float64(0)

	if m.debateMetrics.Count > 0 {
		debateAvgLatency = int64(math.Round(float64(m.debateMetrics.TotalLatencyMs) / float64(m.debateMetrics.Count)))
		debateAvgRounds = math.Round((float64(m.debateMetrics.TotalRounds)/float64(m.debateMetrics.Count))*10) / 10
		debateConsensusRate = float64(m.debateMetrics.ConsensusReached) / float64(m.debateMetrics.Count)
	}

	return MetricsSummary{
		Uptime: int64(time.Since(m.startTime).Seconds()),
		HTTP: HTTPSummary{
			TotalRequests: httpTotalRequests,
			TotalErrors:   httpTotalErrors,
			AvgLatencyMs:  httpAvgLatency,
			ByEndpoint:    byEndpoint,
		},
		Supervisors: SupervisorsSummary{
			TotalCalls:   supervisorTotalCalls,
			TotalErrors:  supervisorTotalErrors,
			AvgLatencyMs: supervisorAvgLatency,
			ByProvider:   byProvider,
		},
		Debates: DebatesSummary{
			Count:         m.debateMetrics.Count,
			AvgLatencyMs:  debateAvgLatency,
			AvgRounds:     debateAvgRounds,
			ConsensusRate: debateConsensusRate,
		},
	}
}

func (m *MetricsService) GetPrometheusFormat() string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var lines []string
	prefix := "autopilot"

	lines = append(lines, fmt.Sprintf("# HELP %s_uptime_seconds Server uptime in seconds", prefix))
	lines = append(lines, fmt.Sprintf("# TYPE %s_uptime_seconds gauge", prefix))
	lines = append(lines, fmt.Sprintf("%s_uptime_seconds %d", prefix, int64(time.Since(m.startTime).Seconds())))
	lines = append(lines, "")

	lines = append(lines, fmt.Sprintf("# HELP %s_http_requests_total Total HTTP requests", prefix))
	lines = append(lines, fmt.Sprintf("# TYPE %s_http_requests_total counter", prefix))
	for key, metric := range m.httpRequests {
		parts := strings.SplitN(key, " ", 2)
		if len(parts) == 2 {
			lines = append(lines, fmt.Sprintf("%s_http_requests_total{method=\"%s\",path=\"%s\"} %d", prefix, parts[0], parts[1], metric.Count))
		}
	}
	lines = append(lines, "")

	lines = append(lines, fmt.Sprintf("# HELP %s_http_errors_total Total HTTP errors (4xx, 5xx)", prefix))
	lines = append(lines, fmt.Sprintf("# TYPE %s_http_errors_total counter", prefix))
	for key, metric := range m.httpRequests {
		parts := strings.SplitN(key, " ", 2)
		if len(parts) == 2 {
			lines = append(lines, fmt.Sprintf("%s_http_errors_total{method=\"%s\",path=\"%s\"} %d", prefix, parts[0], parts[1], metric.Errors))
		}
	}
	lines = append(lines, "")

	lines = append(lines, fmt.Sprintf("# HELP %s_http_latency_ms_total Total HTTP latency in milliseconds", prefix))
	lines = append(lines, fmt.Sprintf("# TYPE %s_http_latency_ms_total counter", prefix))
	for key, metric := range m.httpRequests {
		parts := strings.SplitN(key, " ", 2)
		if len(parts) == 2 {
			lines = append(lines, fmt.Sprintf("%s_http_latency_ms_total{method=\"%s\",path=\"%s\"} %d", prefix, parts[0], parts[1], metric.TotalLatencyMs))
		}
	}
	lines = append(lines, "")

	lines = append(lines, fmt.Sprintf("# HELP %s_supervisor_calls_total Total supervisor API calls", prefix))
	lines = append(lines, fmt.Sprintf("# TYPE %s_supervisor_calls_total counter", prefix))
	for name, metric := range m.supervisorCalls {
		lines = append(lines, fmt.Sprintf("%s_supervisor_calls_total{supervisor=\"%s\"} %d", prefix, name, metric.Calls))
	}
	lines = append(lines, "")

	lines = append(lines, fmt.Sprintf("# HELP %s_supervisor_errors_total Total supervisor errors", prefix))
	lines = append(lines, fmt.Sprintf("# TYPE %s_supervisor_errors_total counter", prefix))
	for name, metric := range m.supervisorCalls {
		lines = append(lines, fmt.Sprintf("%s_supervisor_errors_total{supervisor=\"%s\"} %d", prefix, name, metric.Errors))
	}
	lines = append(lines, "")

	lines = append(lines, fmt.Sprintf("# HELP %s_supervisor_retries_total Total supervisor retries", prefix))
	lines = append(lines, fmt.Sprintf("# TYPE %s_supervisor_retries_total counter", prefix))
	for name, metric := range m.supervisorCalls {
		lines = append(lines, fmt.Sprintf("%s_supervisor_retries_total{supervisor=\"%s\"} %d", prefix, name, metric.Retries))
	}
	lines = append(lines, "")

	lines = append(lines, fmt.Sprintf("# HELP %s_supervisor_latency_ms_total Total supervisor latency in milliseconds", prefix))
	lines = append(lines, fmt.Sprintf("# TYPE %s_supervisor_latency_ms_total counter", prefix))
	for name, metric := range m.supervisorCalls {
		lines = append(lines, fmt.Sprintf("%s_supervisor_latency_ms_total{supervisor=\"%s\"} %d", prefix, name, metric.TotalLatencyMs))
	}
	lines = append(lines, "")

	lines = append(lines, fmt.Sprintf("# HELP %s_debates_total Total debates conducted", prefix))
	lines = append(lines, fmt.Sprintf("# TYPE %s_debates_total counter", prefix))
	lines = append(lines, fmt.Sprintf("%s_debates_total %d", prefix, m.debateMetrics.Count))
	lines = append(lines, "")

	lines = append(lines, fmt.Sprintf("# HELP %s_debates_consensus_total Debates that reached consensus", prefix))
	lines = append(lines, fmt.Sprintf("# TYPE %s_debates_consensus_total counter", prefix))
	lines = append(lines, fmt.Sprintf("%s_debates_consensus_total %d", prefix, m.debateMetrics.ConsensusReached))
	lines = append(lines, "")

	lines = append(lines, fmt.Sprintf("# HELP %s_debates_rounds_total Total debate rounds", prefix))
	lines = append(lines, fmt.Sprintf("# TYPE %s_debates_rounds_total counter", prefix))
	lines = append(lines, fmt.Sprintf("%s_debates_rounds_total %d", prefix, m.debateMetrics.TotalRounds))
	lines = append(lines, "")

	lines = append(lines, fmt.Sprintf("# HELP %s_debates_latency_ms_total Total debate latency in milliseconds", prefix))
	lines = append(lines, fmt.Sprintf("# TYPE %s_debates_latency_ms_total counter", prefix))
	lines = append(lines, fmt.Sprintf("%s_debates_latency_ms_total %d", prefix, m.debateMetrics.TotalLatencyMs))

	return strings.Join(lines, "\n")
}

func (m *MetricsService) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.httpRequests = make(map[string]*RequestMetric)
	m.supervisorCalls = make(map[string]*SupervisorMetric)
	m.debateMetrics = DebateMetric{}
	m.startTime = time.Now()
}

var uuidPattern = regexp.MustCompile(`(?i)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)
var numericIDPattern = regexp.MustCompile(`/[0-9]+`)
var longIDPattern = regexp.MustCompile(`(?i)/[a-z0-9]{20,}`)

func (m *MetricsService) normalizePath(path string) string {
	path = uuidPattern.ReplaceAllString(path, "/:id")
	path = numericIDPattern.ReplaceAllString(path, "/:id")
	path = longIDPattern.ReplaceAllString(path, "/:id")
	return path
}
