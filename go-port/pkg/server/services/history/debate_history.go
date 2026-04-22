package history
import "borg-orchestrator/pkg/shared"

type DebateHistoryService struct{}
func NewDebateHistoryService() *DebateHistoryService { return &DebateHistoryService{} }
func (s *DebateHistoryService) IsEnabled() bool { return true }
func (s *DebateHistoryService) SaveDebate(task shared.DevelopmentTask, result shared.CouncilDecision, extra map[string]interface{}) {}
