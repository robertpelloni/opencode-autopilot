package smartpilot

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"borg-orchestrator/pkg/server/services/config"
	"borg-orchestrator/pkg/server/services/session"
	"borg-orchestrator/pkg/shared"
)

func (s *SmartPilot) Start() {
	s.mu.Lock()
	if s.pollTimer != nil || !s.config.Enabled {
		s.mu.Unlock()
		return
	}

	fmt.Println("[SmartPilot] Starting auto-pilot mode")

	s.pollTimer = time.NewTicker(time.Duration(s.config.PollIntervalMs) * time.Millisecond)
	s.stopChan = make(chan struct{})
	s.mu.Unlock()

	go func() {
		for {
			select {
			case <-s.pollTimer.C:
				s.checkAllSessions()
			case <-s.stopChan:
				return
			}
		}
	}()
}

func (s *SmartPilot) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.pollTimer != nil {
		s.pollTimer.Stop()
		close(s.stopChan)
		s.pollTimer = nil
		s.stopChan = nil
		fmt.Println("[SmartPilot] Stopped")
	}
}

func (s *SmartPilot) checkAllSessions() {
	activeSessions := session.Service.GetActiveSessions()

	for _, sess := range activeSessions {
		s.checkSession(sess)
	}
}

func (s *SmartPilot) checkSession(sess shared.Session) {
	s.mu.Lock()
	checkpoint, exists := s.checkpoints[sess.ID]
	if !exists {
		checkpoint = &TaskCheckpoint{
			SessionID:     sess.ID,
			LastCheckedAt: time.Now().UnixMilli(),
			PendingDebate: false,
		}
		s.checkpoints[sess.ID] = checkpoint
	}
	s.mu.Unlock()

	if checkpoint.PendingDebate {
		return
	}

	task, err := s.fetchCurrentTask(sess)
	if err != nil || task == nil {
		return
	}

	s.mu.Lock()
	if checkpoint.LastTaskID != nil && task.ID == *checkpoint.LastTaskID {
		s.mu.Unlock()
		return
	}

	checkpoint.LastTaskID = &task.ID
	checkpoint.PendingDebate = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		checkpoint.PendingDebate = false
		checkpoint.LastCheckedAt = time.Now().UnixMilli()
		s.mu.Unlock()
	}()

	_ = s.RunDebateAndRespond(sess, *task)
}

func (s *SmartPilot) fetchCurrentTask(sess shared.Session) (*shared.DevelopmentTask, error) {
	port, err := s.getManagedSessionPort(sess.ID)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("http://localhost:%d/current-task", port)
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("non-ok status: %d", resp.StatusCode)
	}

	var task shared.DevelopmentTask
	if err := json.NewDecoder(resp.Body).Decode(&task); err != nil {
		return nil, err
	}

	return &task, nil
}

func (s *SmartPilot) getManagedSessionPort(sessionID string) (int, error) {
	allSessions := session.Service.GetAllSessions()
	idx := -1
	for i, sess := range allSessions {
		if sess.ID == sessionID {
			idx = i
			break
		}
	}

	if idx == -1 {
		return 0, fmt.Errorf("session not found")
	}

	appConfig := config.LoadConfig()
	basePort := appConfig.Sessions.BasePort

	return basePort + idx, nil
}
