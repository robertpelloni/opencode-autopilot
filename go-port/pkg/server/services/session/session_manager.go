package session

import (
	"errors"
	"sync"
	"borg-orchestrator/pkg/shared"
	"borg-orchestrator/pkg/server/services/env"
	"borg-orchestrator/pkg/server/services/cli"
)

type Session struct {
	ID      string         `json:"id"`
	Type    shared.CLIType `json:"type"`
	Status  string         `json:"status"`
	// add terminal processes later
}

type SessionManagerService struct {
	sessions    map[string]*Session
	envManager  *env.EnvironmentManagerService
	cliRegistry *cli.CLIRegistryService
	mu          sync.RWMutex
}

func NewSessionManagerService(envMgr *env.EnvironmentManagerService, cliReg *cli.CLIRegistryService) *SessionManagerService {
	return &SessionManagerService{
		sessions:    make(map[string]*Session),
		envManager:  envMgr,
		cliRegistry: cliReg,
	}
}

func (s *SessionManagerService) CreateSession(id string, cliType shared.CLIType) (*Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.sessions[id]; exists {
		return nil, errors.New("Session already exists")
	}

	_, err := s.cliRegistry.GetConfig(cliType)
	if err != nil {
		return nil, err
	}

	_, err = s.envManager.PrepareEnvironment(id, cliType, nil)
	if err != nil {
		return nil, err
	}

	session := &Session{
		ID:     id,
		Type:   cliType,
		Status: "creating",
	}

	s.sessions[id] = session
	return session, nil
}

func (s *SessionManagerService) GetSession(id string) (*Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, exists := s.sessions[id]
	if !exists {
		return nil, errors.New("Session not found")
	}

	return session, nil
}
