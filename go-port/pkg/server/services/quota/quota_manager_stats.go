package quota

import (
	"math"
	"time"
)

func (s *QuotaManagerService) SetProviderLimits(provider string, limits RateLimitConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing := DefaultProviderLimits["openai"]
	if val, ok := s.providerLimits[provider]; ok {
		existing = val
	}

	// Merge limits logically equivalent to JS object spread
	if limits.RequestsPerMinute != 0 {
		existing.RequestsPerMinute = limits.RequestsPerMinute
	}
	if limits.RequestsPerHour != 0 {
		existing.RequestsPerHour = limits.RequestsPerHour
	}
	if limits.TokensPerMinute != nil {
		existing.TokensPerMinute = limits.TokensPerMinute
	}
	if limits.TokensPerDay != nil {
		existing.TokensPerDay = limits.TokensPerDay
	}
	if limits.CostPer1kTokens != nil {
		existing.CostPer1kTokens = limits.CostPer1kTokens
	}
	if limits.MaxConcurrent != nil {
		existing.MaxConcurrent = limits.MaxConcurrent
	}

	s.providerLimits[provider] = existing
}

func (s *QuotaManagerService) GetLimits(provider string) RateLimitConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.getLimitsLocked(provider)
}

func (s *QuotaManagerService) GetProviderStats(provider string) ProviderStats {
	s.mu.Lock()
	usage := s.ensureUsageRecordLocked(provider)
	s.updateWindowsLocked(provider)
	limits := s.getLimitsLocked(provider)

	// Create a copy of the slice for thread-safety during calculation
	historyCopy := make([]RequestRecord, len(usage.RequestHistory))
	copy(historyCopy, usage.RequestHistory)
	s.mu.Unlock()

	now := time.Now().UnixMilli()
	var recentHistory []RequestRecord
	for _, r := range historyCopy {
		if r.Timestamp > now-3600000 {
			recentHistory = append(recentHistory, r)
		}
	}

	successCount := 0
	var totalLatency int64 = 0
	for _, r := range recentHistory {
		if r.Success {
			successCount++
		}
		totalLatency += r.LatencyMs
	}

	successRate := 1.0
	if len(recentHistory) > 0 {
		successRate = float64(successCount) / float64(len(recentHistory))
	}

	avgLatencyMs := float64(0)
	if len(recentHistory) > 0 {
		avgLatencyMs = float64(totalLatency) / float64(len(recentHistory))
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	usagePercent := Utilization{
		RequestsPerMinute: (float64(usage.RequestsThisMinute) / float64(limits.RequestsPerMinute)) * 100,
		RequestsPerHour:   (float64(usage.RequestsThisHour) / float64(limits.RequestsPerHour)) * 100,
	}

	if limits.TokensPerMinute != nil {
		usagePercent.TokensPerMinute = (float64(usage.TokensThisMinute) / float64(*limits.TokensPerMinute)) * 100
	}
	if limits.TokensPerDay != nil {
		usagePercent.TokensPerDay = (float64(usage.TokensToday) / float64(*limits.TokensPerDay)) * 100
	}

	return ProviderStats{
		Provider: provider,
		Usage: QuotaCheckUsage{
			RequestsPerMinute: usage.RequestsThisMinute,
			RequestsPerHour:   usage.RequestsThisHour,
			TokensPerMinute:   usage.TokensThisMinute,
			TokensPerDay:      usage.TokensToday,
			ConcurrentRequests: usage.ConcurrentRequests,
			TotalCost:         usage.TotalCost,
		},
		Limits: limits,
		Health: ProviderHealth{
			IsThrottled:     usage.IsThrottled,
			ThrottleEndTime: usage.ThrottleEndTime,
			SuccessRate:     successRate,
			AvgLatencyMs:    int64(math.Round(avgLatencyMs)),
		},
		UtilizationPercent: usagePercent,
	}
}

type GlobalStats struct {
	DailyCostTotal          float64  `json:"dailyCostTotal"`
	DailyBudgetLimit        *float64 `json:"dailyBudgetLimit,omitempty"`
	BudgetUtilizationPercent float64  `json:"budgetUtilizationPercent"`
}

func (s *QuotaManagerService) GetAllStats() ([]ProviderStats, GlobalStats) {
	s.mu.RLock()
	providersList := make([]string, 0, len(s.providerUsage))
	for p := range s.providerUsage {
		providersList = append(providersList, p)
	}
	s.mu.RUnlock()

	var providers []ProviderStats
	for _, p := range providersList {
		providers = append(providers, s.GetProviderStats(p))
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	budgetPercent := float64(0)
	if s.config.DailyBudgetLimit != nil {
		budgetPercent = (s.dailyCostTotal / *s.config.DailyBudgetLimit) * 100
	}

	global := GlobalStats{
		DailyCostTotal:          s.dailyCostTotal,
		DailyBudgetLimit:        s.config.DailyBudgetLimit,
		BudgetUtilizationPercent: budgetPercent,
	}

	return providers, global
}

type QuotaStatus struct {
	Enabled            bool               `json:"enabled"`
	Config             QuotaManagerConfig `json:"config"`
	ProvidersTracked   int                `json:"providersTracked"`
	DailyCostTotal     float64            `json:"dailyCostTotal"`
	ThrottledProviders []string           `json:"throttledProviders"`
}

func (s *QuotaManagerService) GetStatus() QuotaStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var throttled []string
	for p, usage := range s.providerUsage {
		if usage.IsThrottled {
			throttled = append(throttled, p)
		}
	}

	return QuotaStatus{
		Enabled:            s.config.Enabled,
		Config:             s.config,
		ProvidersTracked:   len(s.providerUsage),
		DailyCostTotal:     s.dailyCostTotal,
		ThrottledProviders: throttled,
	}
}

func (s *QuotaManagerService) SetConfig(config QuotaManagerConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()
	// Mimics Partial<Config> spread updating
	s.config.Enabled = config.Enabled
	if config.DailyBudgetLimit != nil {
		s.config.DailyBudgetLimit = config.DailyBudgetLimit
	}
	if config.AlertThreshold != 0 {
		s.config.AlertThreshold = config.AlertThreshold
	}
	if config.HistoryRetentionHours != 0 {
		s.config.HistoryRetentionHours = config.HistoryRetentionHours
	}
	s.config.AutoThrottle = config.AutoThrottle
	if config.ThrottleDurationSeconds != 0 {
		s.config.ThrottleDurationSeconds = config.ThrottleDurationSeconds
	}
}

func (s *QuotaManagerService) GetConfig() QuotaManagerConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

func (s *QuotaManagerService) SetEnabled(enabled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config.Enabled = enabled
}

func (s *QuotaManagerService) IsEnabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config.Enabled
}

func (s *QuotaManagerService) ResetProviderUsage(provider string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.providerUsage, provider)
}

func (s *QuotaManagerService) ResetAllUsage() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.providerUsage = make(map[string]*ProviderUsage)
	s.dailyCostTotal = 0
	s.dayStart = getStartOfDay()
}

func (s *QuotaManagerService) UnthrottleProvider(provider string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if usage, ok := s.providerUsage[provider]; ok {
		usage.IsThrottled = false
		usage.ThrottleEndTime = nil
	}
}
