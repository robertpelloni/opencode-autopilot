package quota

import (
	"sync"
	"time"
)

type RateLimitConfig struct {
	RequestsPerMinute int     `json:"requestsPerMinute"`
	RequestsPerHour   int     `json:"requestsPerHour"`
	TokensPerMinute   *int    `json:"tokensPerMinute,omitempty"`
	TokensPerDay      *int    `json:"tokensPerDay,omitempty"`
	CostPer1kTokens   *float64`json:"costPer1kTokens,omitempty"`
	MaxConcurrent     *int    `json:"maxConcurrent,omitempty"`
}

type RequestRecord struct {
	Timestamp  int64   `json:"timestamp"`
	TokensUsed int     `json:"tokensUsed"`
	LatencyMs  int64   `json:"latencyMs"`
	Success    bool    `json:"success"`
	Cost       float64 `json:"cost"`
}

type ProviderUsage struct {
	RequestsThisMinute int
	RequestsThisHour   int
	TokensThisMinute   int
	TokensToday        int
	TotalCost          float64
	ConcurrentRequests int
	MinuteWindowStart  int64
	HourWindowStart    int64
	DayWindowStart     int64
	RequestHistory     []RequestRecord
	IsThrottled        bool
	ThrottleEndTime    *int64
}

type QuotaCheckUsage struct {
	RequestsPerMinute int     `json:"requestsPerMinute"`
	RequestsPerHour   int     `json:"requestsPerHour"`
	TokensPerMinute   int     `json:"tokensPerMinute"`
	TokensPerDay      int     `json:"tokensPerDay"`
	ConcurrentRequests int    `json:"concurrentRequests"`
	TotalCost         float64 `json:"totalCost"`
}

type QuotaCheckResult struct {
	Allowed      bool            `json:"allowed"`
	Reason       *string         `json:"reason,omitempty"`
	WaitTimeMs   *int64          `json:"waitTimeMs,omitempty"`
	CurrentUsage QuotaCheckUsage `json:"currentUsage"`
	Limits       RateLimitConfig `json:"limits"`
}

type ProviderStats struct {
	Provider           string          `json:"provider"`
	Usage              QuotaCheckUsage `json:"usage"`
	Limits             RateLimitConfig `json:"limits"`
	Health             ProviderHealth  `json:"health"`
	UtilizationPercent Utilization     `json:"utilizationPercent"`
}

type ProviderHealth struct {
	IsThrottled     bool    `json:"isThrottled"`
	ThrottleEndTime *int64  `json:"throttleEndTime,omitempty"`
	SuccessRate     float64 `json:"successRate"`
	AvgLatencyMs    int64   `json:"avgLatencyMs"`
}

type Utilization struct {
	RequestsPerMinute float64 `json:"requestsPerMinute"`
	RequestsPerHour   float64 `json:"requestsPerHour"`
	TokensPerMinute   float64 `json:"tokensPerMinute"`
	TokensPerDay      float64 `json:"tokensPerDay"`
}

type QuotaManagerConfig struct {
	Enabled                 bool     `json:"enabled"`
	DailyBudgetLimit        *float64 `json:"dailyBudgetLimit,omitempty"`
	AlertThreshold          float64  `json:"alertThreshold"`
	HistoryRetentionHours   int      `json:"historyRetentionHours"`
	AutoThrottle            bool     `json:"autoThrottle"`
	ThrottleDurationSeconds int      `json:"throttleDurationSeconds"`
}

var DefaultProviderLimits = map[string]RateLimitConfig{
	"openai": {
		RequestsPerMinute: 60,
		RequestsPerHour:   3500,
		TokensPerMinute:   ptrInt(90000),
		TokensPerDay:      ptrInt(1000000),
		CostPer1kTokens:   ptrFloat(0.03),
		MaxConcurrent:     ptrInt(10),
	},
	"anthropic": {
		RequestsPerMinute: 50,
		RequestsPerHour:   2000,
		TokensPerMinute:   ptrInt(100000),
		TokensPerDay:      ptrInt(1000000),
		CostPer1kTokens:   ptrFloat(0.015),
		MaxConcurrent:     ptrInt(10),
	},
	"gemini": {
		RequestsPerMinute: 60,
		RequestsPerHour:   1500,
		TokensPerMinute:   ptrInt(60000),
		TokensPerDay:      ptrInt(500000),
		CostPer1kTokens:   ptrFloat(0.001),
		MaxConcurrent:     ptrInt(10),
	},
	"deepseek": {
		RequestsPerMinute: 60,
		RequestsPerHour:   3000,
		TokensPerMinute:   ptrInt(100000),
		TokensPerDay:      ptrInt(2000000),
		CostPer1kTokens:   ptrFloat(0.0014),
		MaxConcurrent:     ptrInt(10),
	},
	"grok": {
		RequestsPerMinute: 30,
		RequestsPerHour:   1000,
		TokensPerMinute:   ptrInt(50000),
		TokensPerDay:      ptrInt(500000),
		CostPer1kTokens:   ptrFloat(0.005),
		MaxConcurrent:     ptrInt(5),
	},
	"qwen": {
		RequestsPerMinute: 60,
		RequestsPerHour:   2000,
		TokensPerMinute:   ptrInt(80000),
		TokensPerDay:      ptrInt(1000000),
		CostPer1kTokens:   ptrFloat(0.002),
		MaxConcurrent:     ptrInt(10),
	},
	"kimi": {
		RequestsPerMinute: 40,
		RequestsPerHour:   1500,
		TokensPerMinute:   ptrInt(60000),
		TokensPerDay:      ptrInt(500000),
		CostPer1kTokens:   ptrFloat(0.002),
		MaxConcurrent:     ptrInt(8),
	},
}

func ptrInt(i int) *int             { return &i }
func ptrFloat(f float64) *float64   { return &f }
func ptrString(s string) *string    { return &s }
func ptrInt64(i int64) *int64       { return &i }

type QuotaManagerService struct {
	mu              sync.RWMutex
	config          QuotaManagerConfig
	providerLimits  map[string]RateLimitConfig
	providerUsage   map[string]*ProviderUsage
	dailyCostTotal  float64
	dayStart        int64
	cleanupTicker   *time.Ticker
	cleanupStopChan chan struct{}
}

var Service = NewQuotaManagerService()

func getStartOfDay() int64 {
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return start.UnixMilli()
}

func NewQuotaManagerService() *QuotaManagerService {
	s := &QuotaManagerService{
		config: QuotaManagerConfig{
			Enabled:                 true,
			AlertThreshold:          0.8,
			HistoryRetentionHours:   24,
			AutoThrottle:            true,
			ThrottleDurationSeconds: 60,
		},
		providerLimits:  make(map[string]RateLimitConfig),
		providerUsage:   make(map[string]*ProviderUsage),
		dailyCostTotal:  0,
		dayStart:        getStartOfDay(),
		cleanupTicker:   time.NewTicker(60 * time.Second),
		cleanupStopChan: make(chan struct{}),
	}

	for k, v := range DefaultProviderLimits {
		s.providerLimits[k] = v
	}

	go func() {
		for {
			select {
			case <-s.cleanupTicker.C:
				s.cleanup()
			case <-s.cleanupStopChan:
				return
			}
		}
	}()

	return s
}

func (s *QuotaManagerService) Stop() {
	if s.cleanupTicker != nil {
		s.cleanupTicker.Stop()
	}
	if s.cleanupStopChan != nil {
		close(s.cleanupStopChan)
	}
}

func (s *QuotaManagerService) cleanup() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UnixMilli()
	cutoff := now - int64(s.config.HistoryRetentionHours*3600000)

	for _, usage := range s.providerUsage {
		var newHistory []RequestRecord
		for _, r := range usage.RequestHistory {
			if r.Timestamp > cutoff {
				newHistory = append(newHistory, r)
			}
		}
		usage.RequestHistory = newHistory
	}
}

func (s *QuotaManagerService) ensureUsageRecordLocked(provider string) *ProviderUsage {
	usage, exists := s.providerUsage[provider]
	if !exists {
		now := time.Now().UnixMilli()
		usage = &ProviderUsage{
			RequestsThisMinute: 0,
			RequestsThisHour:   0,
			TokensThisMinute:   0,
			TokensToday:        0,
			TotalCost:          0,
			ConcurrentRequests: 0,
			MinuteWindowStart:  now,
			HourWindowStart:    now,
			DayWindowStart:     getStartOfDay(),
			RequestHistory:     []RequestRecord{},
			IsThrottled:        false,
		}
		s.providerUsage[provider] = usage
	}
	return usage
}

func (s *QuotaManagerService) formatUsage(usage *ProviderUsage) QuotaCheckUsage {
	return QuotaCheckUsage{
		RequestsPerMinute: usage.RequestsThisMinute,
		RequestsPerHour:   usage.RequestsThisHour,
		TokensPerMinute:   usage.TokensThisMinute,
		TokensPerDay:      usage.TokensToday,
		ConcurrentRequests: usage.ConcurrentRequests,
		TotalCost:         usage.TotalCost,
	}
}

func (s *QuotaManagerService) getEmptyUsage() QuotaCheckUsage {
	return QuotaCheckUsage{}
}
