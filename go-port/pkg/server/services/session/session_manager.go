package session

import "borg-orchestrator/pkg/shared"

var Service = &SessionManager{}

type SessionManager struct{}

func (s *SessionManager) GetSession(id string) *shared.Session {
	return nil
}

func (s *SessionManager) GetSessionCLIType(id string) *shared.CLIType {
	return nil
}

func (s *SessionManager) StartSession(templateName *string, options map[string]interface{}) (*shared.Session, error) {
	return nil, nil
}

func (s *SessionManager) GetActiveSessions() []shared.Session {
	return nil
}

func (s *SessionManager) GetAllSessions() []shared.Session {
	return nil
}

func (s *SessionManager) SendGuidance(id string, guidance shared.Guidance) error {
	return nil
}
