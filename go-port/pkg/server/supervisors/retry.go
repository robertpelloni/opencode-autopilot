package supervisors

import (
	"bytes"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"time"

	"borg-orchestrator/pkg/server/services/metrics"
)

type RetryConfig struct {
	MaxRetries  int
	BaseDelayMs int
	MaxDelayMs  int
}

var DefaultRetryConfig = RetryConfig{
	MaxRetries:  3,
	BaseDelayMs: 1000,
	MaxDelayMs:  10000,
}

func IsRetryableError(status int) bool {
	return status == 429 || status == 500 || status == 502 || status == 503 || status == 504
}

func FetchWithRetry(name string, req *http.Request, retryConfig RetryConfig) (*http.Response, error) {
	var lastErr error
	retryCount := 0
	startTime := time.Now()
	client := &http.Client{}

	// We need to re-read the body on retries, so we buffer it if it exists.
	var bodyBytes []byte
	if req.Body != nil {
		var err error
		bodyBytes, err = io.ReadAll(req.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read request body: %w", err)
		}
		req.Body.Close()
	}

	for attempt := 0; attempt <= retryConfig.MaxRetries; attempt++ {
		if bodyBytes != nil {
			req.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		}

		resp, err := client.Do(req)

		if err == nil {
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				metrics.Service.RecordSupervisorCall(name, time.Since(startTime).Milliseconds(), true, retryCount)
				return resp, nil
			}

			if !IsRetryableError(resp.StatusCode) || attempt == retryConfig.MaxRetries {
				metrics.Service.RecordSupervisorCall(name, time.Since(startTime).Milliseconds(), false, retryCount)
				return resp, nil
			}

			retryCount++
			retryAfter := resp.Header.Get("Retry-After")
			var delayMs int
			if retryAfter != "" {
				parsed, parseErr := strconv.Atoi(retryAfter)
				if parseErr == nil {
					delayMs = parsed * 1000
				}
			}

			if delayMs == 0 {
				calculatedDelay := float64(retryConfig.BaseDelayMs) * math.Pow(2, float64(attempt))
				delayMs = int(math.Min(calculatedDelay, float64(retryConfig.MaxDelayMs)))
			}

			fmt.Printf("[%s] Retry %d/%d after %dms (status: %d)\n", name, attempt+1, retryConfig.MaxRetries, delayMs, resp.StatusCode)
			resp.Body.Close()
			time.Sleep(time.Duration(delayMs) * time.Millisecond)
			continue
		}

		// Network error path
		lastErr = err

		if attempt == retryConfig.MaxRetries {
			metrics.Service.RecordSupervisorCall(name, time.Since(startTime).Milliseconds(), false, retryCount)
			return nil, lastErr
		}

		retryCount++
		calculatedDelay := float64(retryConfig.BaseDelayMs) * math.Pow(2, float64(attempt))
		delayMs := int(math.Min(calculatedDelay, float64(retryConfig.MaxDelayMs)))

		fmt.Printf("[%s] Retry %d/%d after %dms (network error)\n", name, attempt+1, retryConfig.MaxRetries, delayMs)
		time.Sleep(time.Duration(delayMs) * time.Millisecond)
	}

	metrics.Service.RecordSupervisorCall(name, time.Since(startTime).Milliseconds(), false, retryCount)
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, fmt.Errorf("max retries exceeded")
}
