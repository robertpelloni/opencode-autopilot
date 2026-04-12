package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

type DatabaseService struct {
	db     *sql.DB
	dbPath string
}

var Service *DatabaseService

func init() {
	Service = NewDatabaseService()
}

func NewDatabaseService() *DatabaseService {
	isTest := os.Getenv("NODE_ENV") == "test" || os.Getenv("GO_ENV") == "test"
	var dbPath string

	if isTest {
		dbPath = ":memory:"
	} else {
		cwd, err := os.Getwd()
		if err != nil {
			cwd = "."
		}
		// Adjusting relative path for a Go runtime vs Bun workspace
		dataDir := filepath.Join(cwd, "..", "..", ".autopilot")
		if _, err := os.Stat(dataDir); os.IsNotExist(err) {
			os.MkdirAll(dataDir, 0755)
		}
		dbPath = filepath.Join(dataDir, "autopilot.sqlite")
	}

	// For memory DB, cache=shared helps concurrent access
	dsn := dbPath
	if isTest {
		dsn = "file::memory:?cache=shared"
	}

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		fmt.Printf("Failed to open database: %v\n", err)
	}

	service := &DatabaseService{
		db:     db,
		dbPath: dbPath,
	}
	service.initDB()

	return service
}

func (s *DatabaseService) initDB() {
	if s.db == nil {
		return
	}

	_, err := s.db.Exec("PRAGMA journal_mode = WAL;")
	if err != nil {
		fmt.Printf("Failed to set PRAGMA: %v\n", err)
	}

	s.createTables()
}

func (s *DatabaseService) createTables() {
	debatesTable := `
	CREATE TABLE IF NOT EXISTS debates (
		id TEXT PRIMARY KEY,
		title TEXT,
		sessionId TEXT,
		workspaceId TEXT,
		taskType TEXT,
		status TEXT,
		consensus REAL,
		weightedConsensus REAL,
		outcome TEXT,
		rounds INTEGER,
		timestamp INTEGER,
		data JSON
	);`

	_, err := s.db.Exec(debatesTable)
	if err != nil {
		fmt.Printf("Failed to create debates table: %v\n", err)
	}

	workspacesTable := `
	CREATE TABLE IF NOT EXISTS workspaces (
		id TEXT PRIMARY KEY,
		name TEXT,
		path TEXT,
		status TEXT,
		config JSON,
		description TEXT,
		createdAt INTEGER,
		updatedAt INTEGER
	);`

	_, err = s.db.Exec(workspacesTable)
	if err != nil {
		fmt.Printf("Failed to create workspaces table: %v\n", err)
	}

	// Indexes
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_debates_session ON debates(sessionId);",
		"CREATE INDEX IF NOT EXISTS idx_debates_timestamp ON debates(timestamp);",
		"CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);",
	}

	for _, idx := range indexes {
		_, err := s.db.Exec(idx)
		if err != nil {
			fmt.Printf("Failed to create index: %v\n", err)
		}
	}
}

func (s *DatabaseService) GetDb() *sql.DB {
	return s.db
}

func (s *DatabaseService) Close() {
	if s.db != nil {
		s.db.Close()
	}
}
