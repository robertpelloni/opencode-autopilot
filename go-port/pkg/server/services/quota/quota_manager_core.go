package quota

import (
	"fmt"
	"math"
	"time"
)

func (s *QuotaManagerService) updateWindowsLocked(provider string) {
	usage, exists := s.providerUsage[provider]
	if !exists {
		return
	}

	now := time.Now().UnixMilli()

	if now-usage.MinuteWindowStart >= 60000 {
		usage.RequestsThisMinute = 0
		usage.TokensThisMinute = 0
		usage.MinuteWindowStart = now
	}

	if now-usage.HourWindowStart >= 3600000 {
		usage.RequestsThisHour = 0
		usage.HourWindowStart = now
	}

	today := getStartOfDay()
	if today > usage.DayWindowStart {
		usage.TokensToday = 0
		usage.TotalCost = 0
		usage.DayWindowStart = today
	}

	if today > s.dayStart {
		s.dailyCostTotal = 0
		s.dayStart = today
	}
}

func (s *QuotaManagerService) getLimitsLocked(provider string) RateLimitConfig {
	if limits, ok := s.providerLimits[provider]; ok {
		return limits
	}
	return DefaultProviderLimits["openai"]
}

func (s *QuotaManagerService) checkAlertThresholdsLocked(provider string, usage *ProviderUsage, limits RateLimitConfig) {
	threshold := s.config.AlertThreshold

	if float64(usage.RequestsThisMinute)/float64(limits.RequestsPerMinute) >= threshold {
		// Emit alert event logic here
		fmt.Printf("[QuotaManager] ALERT: %s approaching requests per minute limit (%d/%d)\n", provider, usage.RequestsThisMinute, limits.RequestsPerMinute)
	}

	if float64(usage.RequestsThisHour)/float64(limits.RequestsPerHour) >= threshold {
		// Emit alert event logic here
		fmt.Printf("[QuotaManager] ALERT: %s approaching requests per hour limit (%d/%d)\n", provider, usage.RequestsThisHour, limits.RequestsPerHour)
	}

	if s.config.DailyBudgetLimit != nil && s.dailyCostTotal/(*s.config.DailyBudgetLimit) >= threshold {
		// Emit alert event logic here
		fmt.Printf("[QuotaManager] ALERT: Approaching daily budget limit ($%.2f/$%.2f)\n", s.dailyCostTotal, *s.config.DailyBudgetLimit)
	}
}

func (s *QuotaManagerService) CheckQuota(provider string) QuotaCheckResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.config.Enabled {
		return QuotaCheckResult{
			Allowed:      true,
			CurrentUsage: s.getEmptyUsage(),
			Limits:       s.getLimitsLocked(provider),
		}
	}

	usage := s.ensureUsageRecordLocked(provider)
	s.updateWindowsLocked(provider)

	limits := s.getLimitsLocked(provider)
	now := time.Now().UnixMilli()

	if usage.IsThrottled && usage.ThrottleEndTime != nil {
		if now < *usage.ThrottleEndTime {
			return QuotaCheckResult{
				Allowed:      false,
				Reason:       ptrString("Provider is temporarily throttled due to rate limit errors"),
				WaitTimeMs:   ptrInt64(*usage.ThrottleEndTime - now),
				CurrentUsage: s.formatUsage(usage),
				Limits:       limits,
			}
		} else {
			usage.IsThrottled = false
			usage.ThrottleEndTime = nil
		}
	}

	if limits.MaxConcurrent != nil && usage.ConcurrentRequests >= *limits.MaxConcurrent {
		return QuotaCheckResult{
			Allowed:      false,
			Reason:       ptrString(fmt.Sprintf("Max concurrent requests (%d) reached", *limits.MaxConcurrent)),
			WaitTimeMs:   ptrInt64(1000),
			CurrentUsage: s.formatUsage(usage),
			Limits:       limits,
		}
	}

	if usage.RequestsThisMinute >= limits.RequestsPerMinute {
		waitTime := int64(60000) - (now - usage.MinuteWindowStart)
		return QuotaCheckResult{
			Allowed:      false,
			Reason:       ptrString(fmt.Sprintf("Rate limit: %d requests per minute exceeded", limits.RequestsPerMinute)),
			WaitTimeMs:   ptrInt64(int64(math.Max(0, float64(waitTime)))),
			CurrentUsage: s.formatUsage(usage),
			Limits:       limits,
		}
	}

	if usage.RequestsThisHour >= limits.RequestsPerHour {
		waitTime := int64(3600000) - (now - usage.HourWindowStart)
		return QuotaCheckResult{
			Allowed:      false,
			Reason:       ptrString(fmt.Sprintf("Rate limit: %d requests per hour exceeded", limits.RequestsPerHour)),
			WaitTimeMs:   ptrInt64(int64(math.Max(0, float64(waitTime)))),
			CurrentUsage: s.formatUsage(usage),
			Limits:       limits,
		}
	}

	if limits.TokensPerMinute != nil && usage.TokensThisMinute >= *limits.TokensPerMinute {
		waitTime := int64(60000) - (now - usage.MinuteWindowStart)
		return QuotaCheckResult{
			Allowed:      false,
			Reason:       ptrString(fmt.Sprintf("Token limit: %d tokens per minute exceeded", *limits.TokensPerMinute)),
			WaitTimeMs:   ptrInt64(int64(math.Max(0, float64(waitTime)))),
			CurrentUsage: s.formatUsage(usage),
			Limits:       limits,
		}
	}

	if limits.TokensPerDay != nil && usage.TokensToday >= *limits.TokensPerDay {
		waitTime := getStartOfDay() + 86400000 - now
		return QuotaCheckResult{
			Allowed:      false,
			Reason:       ptrString(fmt.Sprintf("Token limit: %d tokens per day exceeded", *limits.TokensPerDay)),
			WaitTimeMs:   ptrInt64(int64(math.Max(0, float64(waitTime)))),
			CurrentUsage: s.formatUsage(usage),
			Limits:       limits,
		}
	}

	if s.config.DailyBudgetLimit != nil && s.dailyCostTotal >= *s.config.DailyBudgetLimit {
		waitTime := getStartOfDay() + 86400000 - now
		return QuotaCheckResult{
			Allowed:      false,
			Reason:       ptrString(fmt.Sprintf("Daily budget limit ($%.2f) exceeded", *s.config.DailyBudgetLimit)),
			WaitTimeMs:   ptrInt64(int64(math.Max(0, float64(waitTime)))),
			CurrentUsage: s.formatUsage(usage),
			Limits:       limits,
		}
	}

	s.checkAlertThresholdsLocked(provider, usage, limits)

	return QuotaCheckResult{
		Allowed:      true,
		CurrentUsage: s.formatUsage(usage),
		Limits:       limits,
	}
}

func (s *QuotaManagerService) StartRequest(provider string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	usage := s.ensureUsageRecordLocked(provider)
	usage.ConcurrentRequests++
}

func (s *QuotaManagerService) RecordRequest(provider string, tokensUsed int, latencyMs int64, success bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	usage := s.ensureUsageRecordLocked(provider)
	s.updateWindowsLocked(provider)

	limits := s.getLimitsLocked(provider)

	usage.RequestsThisMinute++
	usage.RequestsThisHour++
	usage.TokensThisMinute += tokensUsed
	usage.TokensToday += tokensUsed

	if usage.ConcurrentRequests > 0 {
		usage.ConcurrentRequests--
	}

	cost := float64(0)
	if limits.CostPer1kTokens != nil {
		cost = (float64(tokensUsed) / 1000.0) * (*limits.CostPer1kTokens)
	}
	usage.TotalCost += cost
	s.dailyCostTotal += cost

	now := time.Now().UnixMilli()
	usage.RequestHistory = append(usage.RequestHistory, RequestRecord{
		Timestamp:  now,
		TokensUsed: tokensUsed,
		LatencyMs:  latencyMs,
		Success:    success,
		Cost:       cost,
	})

	cutoff := now - int64(s.config.HistoryRetentionHours*3600000)
	var newHistory []RequestRecord
	for _, r := range usage.RequestHistory {
		if r.Timestamp > cutoff {
			newHistory = append(newHistory, r)
		}
	}
	usage.RequestHistory = newHistory

	// fmt.Printf("[QuotaManager] Request emitted: %+v\n", ...) // Event emission equivalent
}

func (s *QuotaManagerService) RecordRateLimitError(provider string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.config.AutoThrottle {
		return
	}

	usage := s.ensureUsageRecordLocked(provider)
	usage.IsThrottled = true

	now := time.Now().UnixMilli()
	throttleEnd := now + int64(s.config.ThrottleDurationSeconds*1000)
	usage.ThrottleEndTime = &throttleEnd

	fmt.Printf("[QuotaManager] %s throttled until %d\n", provider, throttleEnd) // Event emission equivalent
}
