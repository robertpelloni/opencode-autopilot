package quota

import (
	"testing"
)

func TestQuotaManagerService_Basic(t *testing.T) {
	service := NewQuotaManagerService()

	// Initial quota check should pass
	res := service.CheckQuota("openai")
	if !res.Allowed {
		t.Errorf("Expected initial check to be allowed")
	}

	// Start a request
	service.StartRequest("openai")
	res = service.CheckQuota("openai")
	if res.CurrentUsage.ConcurrentRequests != 1 {
		t.Errorf("Expected concurrent requests to be 1, got %d", res.CurrentUsage.ConcurrentRequests)
	}

	// Record request
	service.RecordRequest("openai", 1000, 200, true)
	res = service.CheckQuota("openai")

	if res.CurrentUsage.TokensPerMinute != 1000 {
		t.Errorf("Expected 1000 tokens used this minute, got %d", res.CurrentUsage.TokensPerMinute)
	}
	if res.CurrentUsage.RequestsPerMinute != 1 {
		t.Errorf("Expected 1 request this minute, got %d", res.CurrentUsage.RequestsPerMinute)
	}
	if res.CurrentUsage.ConcurrentRequests != 0 {
		t.Errorf("Expected 0 concurrent requests after record, got %d", res.CurrentUsage.ConcurrentRequests)
	}

	// Test max concurrent limits
	service.SetProviderLimits("openai", RateLimitConfig{MaxConcurrent: ptrInt(1)})
	service.StartRequest("openai")
	res = service.CheckQuota("openai")
	if res.Allowed {
		t.Errorf("Expected second concurrent request to be rejected, but was allowed")
	}

	// Cleanup
	service.Stop()
}

func TestQuotaManagerService_Limits(t *testing.T) {
	service := NewQuotaManagerService()

	// Rate limit triggering
	service.SetProviderLimits("openai", RateLimitConfig{RequestsPerMinute: 1})
	service.RecordRequest("openai", 100, 50, true)
	res := service.CheckQuota("openai")
	if res.Allowed {
		t.Errorf("Expected request limit to block usage")
	}

	// Reset
	service.ResetProviderUsage("openai")

	// Token limit triggering
	service.SetProviderLimits("openai", RateLimitConfig{RequestsPerMinute: 10, TokensPerMinute: ptrInt(100)})
	service.RecordRequest("openai", 150, 50, true)
	res = service.CheckQuota("openai")
	if res.Allowed {
		t.Errorf("Expected token limit to block usage")
	}

	service.Stop()
}

func TestQuotaManagerService_Throttling(t *testing.T) {
	service := NewQuotaManagerService()

	service.RecordRateLimitError("openai")
	res := service.CheckQuota("openai")
	if res.Allowed {
		t.Errorf("Expected provider to be throttled after error")
	}
	if res.WaitTimeMs == nil || *res.WaitTimeMs <= 0 {
		t.Errorf("Expected a wait time for throttled provider")
	}

	service.UnthrottleProvider("openai")
	res = service.CheckQuota("openai")
	if !res.Allowed {
		t.Errorf("Expected provider to be allowed after unthrottle")
	}

	service.Stop()
}

func TestQuotaManagerService_GlobalBudget(t *testing.T) {
	service := NewQuotaManagerService()
	service.SetConfig(QuotaManagerConfig{
		Enabled: true,
		DailyBudgetLimit: ptrFloat(1.00),
	})

	// OpenAI default cost is $0.03 / 1k tokens. 100k tokens = $3.00
	service.RecordRequest("openai", 100000, 100, true)

	res := service.CheckQuota("openai")
	if res.Allowed {
		t.Errorf("Expected budget limit to block usage")
	}

	service.Stop()
}
