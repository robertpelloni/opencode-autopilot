package session

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"log"
	"os/exec"
	"sync"
	"os"

	"github.com/creack/pty"

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
	PtyFile   *os.File          `json:"-"`
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

	var envPairs []string
	for k, v := range envContext.Resolved {
		envPairs = append(envPairs, fmt.Sprintf("%s=%s", k, v))
	}
	cmd.Env = envPairs

	// Instead of pipes, we'll start the process with a pseudo-terminal
	// But we won't start it until StartSession is called.
	// PTY creation happens during StartSession to ensure proper lifecycle.

	session := &Session{
		ID:     id,
		Type:   cliType,
		Status: "creating",
		Cmd:    cmd,
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

	if session.PtyFile == nil {
		return errors.New("Session has no PTY attached")
	}

	_, err = io.WriteString(session.PtyFile, message+"\n")
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

	ptyFile, err := pty.Start(session.Cmd)
	if err != nil {
		s.mu.Lock()
		session.Status = "crashed"
		s.mu.Unlock()
		return fmt.Errorf("Failed to start command with PTY: %v", err)
	}

	s.mu.Lock()
	session.Status = "running"
	session.PtyFile = ptyFile
	s.mu.Unlock()

	if s.wsManager != nil {
		s.wsManager.Broadcast("session_status", map[string]string{"id": id, "status": "running"})
	}

	// Multiplex PTY output to websocket
	go func() {
		scanner := bufio.NewScanner(ptyFile)
		for scanner.Scan() {
			text := scanner.Text()
			if s.wsManager != nil {
				s.wsManager.NotifyLog(id, text)
			}
		}
	}()

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

		if sess.PtyFile != nil {
			sess.PtyFile.Close()
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

	if session.PtyFile != nil {
		session.PtyFile.Close()
	}

	session.Status = "stopped"
	if s.wsManager != nil {
		s.wsManager.Broadcast("session_status", map[string]string{"id": id, "status": "stopped"})
	}

	return nil
}
