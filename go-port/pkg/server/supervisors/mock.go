package supervisors

import (
	"strings"
	"time"

	"borg-orchestrator/pkg/shared"
)

type MockSupervisorOptions struct {
	Delay         int
	ShouldApprove bool
}

type MockSupervisor struct {
	name          string
	provider      string
	delay         int
	shouldApprove bool
}

// Ensure interface satisfaction
var _ shared.Supervisor = (*MockSupervisor)(nil)

func NewMockSupervisor(config shared.SupervisorConfig, options ...MockSupervisorOptions) *MockSupervisor {
	delay := 500
	shouldApprove := true

	if len(options) > 0 {
		opt := options[0]
		if opt.Delay != 0 {
			delay = opt.Delay
		}
		// The shouldApprove logic in TS defaults to true, so we check if explicitly set
		// We'll just assume ShouldApprove maps to true unless configured otherwise here.
		shouldApprove = opt.ShouldApprove
	}

	return &MockSupervisor{
		name:          config.Name,
		provider:      config.Provider,
		delay:         delay,
		shouldApprove: shouldApprove,
	}
}

func (s *MockSupervisor) GetName() string {
	return s.name
}

func (s *MockSupervisor) GetProvider() string {
	return s.provider
}

func (s *MockSupervisor) Chat(messages []shared.Message) (string, error) {
	time.Sleep(time.Duration(s.delay) * time.Millisecond)

	content := ""
	if len(messages) > 0 {
		content = messages[len(messages)-1].Content
	}

	if strings.Contains(content, "FINAL VOTE") || strings.Contains(content, "APPROVE or REJECT") {
		return s.generateVoteResponse(), nil
	}

	return s.generateReviewResponse(content), nil
}

func (s *MockSupervisor) IsAvailable() (bool, error) {
	return true, nil
}

func (s *MockSupervisor) generateVoteResponse() string {
	if s.shouldApprove {
		return `VOTE: APPROVE

REASONING: As a mock supervisor, I've reviewed the proposed changes and found them to be well-structured and following best practices. The implementation appears solid and ready for integration.`
	}

	return `VOTE: REJECT

REASONING: As a mock supervisor, I've identified some concerns with the proposed changes that should be addressed before proceeding. Consider reviewing the implementation for potential improvements.`
}

func (s *MockSupervisor) generateReviewResponse(context string) string {
	isTask := strings.Contains(context, "Development Task") || strings.Contains(context, "Task ID")

	if isTask {
		return `**Mock Review by ` + s.name + `**

I've analyzed the development task and here are my observations:

1. **Code Quality**: The proposed changes appear to follow standard coding conventions.

2. **Potential Issues**: No critical issues identified in this mock review.

3. **Suggestions**:
   - Consider adding unit tests for new functionality
   - Ensure error handling is comprehensive

4. **Overall Assessment**: The task looks reasonable and well-scoped.

This is a simulated response for testing purposes.`
	}

	return `**` + s.name + ` Response**

I've reviewed the provided context and have the following thoughts:

The approach seems reasonable. Key considerations:
- Implementation follows common patterns
- No obvious security concerns
- Performance should be acceptable

This is a mock response for testing without API keys.`
}
