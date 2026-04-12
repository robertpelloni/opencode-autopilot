package persistence

import "borg-orchestrator/pkg/shared"

var Service = &SessionPersistenceService{}

type SessionPersistenceService struct{}

func (s *SessionPersistenceService) PersistSession(session shared.PersistedSession) {}
