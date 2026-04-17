package session

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"log"
	"os/exec"
	"sync"

	"borg-orchestrator/pkg/server/services/cli"
	"borg-orchestrator/pkg/server/services/env"
	"borg-orchestrator/pkg/server/services/ws"
	"borg-orchestrator/pkg/shared"
)

type Session struct {
	ID        string            `json:"id"`
	Type      shared.CLIType    `json:"type"`
	Status    string            `json:"status"`
	Cmd       *exec.Cmd         `json:"-"`
	StdinPipe io.WriteCloser    `json:"-"`
}

type SessionManagerService struct {
	sessions    map[string]*Session
	envManager  *env.EnvironmentManagerService
	cliRegistry *cli.CLIRegistryService
	wsManager   *ws.WSManagerService
	mu          sync.RWMutex
}

func NewSessionManagerService(envMgr *env.EnvironmentManagerService, cliReg *cli.CLIRegistryService, wsMgr *ws.WSManagerService) *SessionManagerService {
	return &SessionManagerService{
		sessions:    make(map[string]*Session),
		envManager:  envMgr,
		cliRegistry: cliReg,
		wsManager:   wsMgr,
	}
}

func (s *SessionManagerService) CreateSession(id string, cliType shared.CLIType) (*Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.sessions[id]; exists {
		return nil, errors.New("Session already exists")
	}

	config, err := s.cliRegistry.GetConfig(cliType)
	if err != nil {
		return nil, err
	}

	envContext, err := s.envManager.PrepareEnvironment(id, cliType, nil)
	if err != nil {
		return nil, err
	}

	cmd := exec.Command(config.Command, config.Arguments...)

	// Build the environment slice
	var envPairs []string
	for k, v := range envContext.Resolved {
		envPairs = append(envPairs, fmt.Sprintf("%s=%s", k, v))
	}
	cmd.Env = envPairs

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("Failed to create stdin pipe: %v", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("Failed to create stdout pipe: %v", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("Failed to create stderr pipe: %v", err)
	}

	session := &Session{
		ID:        id,
		Type:      cliType,
		Status:    "creating",
		Cmd:       cmd,
		StdinPipe: stdin,
	}

	// Multiplex stdout to websocket
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			text := scanner.Text()
			if s.wsManager != nil {
				s.wsManager.NotifyLog(id, text)
			}
		}
	}()

	// Multiplex stderr to websocket
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			text := scanner.Text()
			if s.wsManager != nil {
				s.wsManager.NotifyLog(id, "ERROR: "+text)
			}
		}
	}()

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

func (s *SessionManagerService) GetActiveSessions() []*Session {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var active []*Session
	for _, session := range s.sessions {
		if session.Status == "running" || session.Status == "creating" {
			active = append(active, session)
		}
	}
	return active
}

func (s *SessionManagerService) SendGuidance(id string, message string) error {
	session, err := s.GetSession(id)
	if err != nil {
		return err
	}

	if session.Status != "running" {
		return errors.New("Session is not running")
	}

	if session.StdinPipe == nil {
		return errors.New("Session has no stdin pipe")
	}

	_, err = io.WriteString(session.StdinPipe, message+"\n")
	if err != nil {
		log.Printf("Failed to write to session %s: %v", id, err)
		return err
	}

	return nil
}

func (s *SessionManagerService) StartSession(id string) error {
	s.mu.Lock()
	session, exists := s.sessions[id]
	if !exists {
		s.mu.Unlock()
		return errors.New("Session not found")
	}
	s.mu.Unlock()

	if session.Status == "running" {
		return errors.New("Session already running")
	}

	err := session.Cmd.Start()
	if err != nil {
		s.mu.Lock()
		session.Status = "crashed"
		s.mu.Unlock()
		return fmt.Errorf("Failed to start command: %v", err)
	}

	s.mu.Lock()
	session.Status = "running"
	s.mu.Unlock()

	if s.wsManager != nil {
		s.wsManager.Broadcast("session_status", map[string]string{"id": id, "status": "running"})
	}

	go func(sess *Session) {
		err := sess.Cmd.Wait()
		s.mu.Lock()
		if err != nil {
			log.Printf("Session %s exited with error: %v", sess.ID, err)
			sess.Status = "crashed"
		} else {
			log.Printf("Session %s completed successfully", sess.ID)
			sess.Status = "completed"
		}

		if s.wsManager != nil {
			s.wsManager.Broadcast("session_status", map[string]string{"id": sess.ID, "status": sess.Status})
		}

		s.mu.Unlock()
	}(session)

	return nil
}

func (s *SessionManagerService) StopSession(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	session, exists := s.sessions[id]
	if !exists {
		return errors.New("Session not found")
	}

	if session.Status != "running" {
		return nil
	}

	if session.Cmd != nil && session.Cmd.Process != nil {
		err := session.Cmd.Process.Kill()
		if err != nil {
			return err
		}
	}

	session.Status = "stopped"
	if s.wsManager != nil {
		s.wsManager.Broadcast("session_status", map[string]string{"id": id, "status": "stopped"})
	}

	return nil
}
