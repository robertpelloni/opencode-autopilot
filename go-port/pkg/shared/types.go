package shared

type Message struct {
	Role    string `json:"role"` // 'system', 'user', 'assistant'
	Content string `json:"content"`
}

type SupervisorConfig struct {
	Name         string  `json:"name"`
	Provider     string  `json:"provider"`
	APIKey       *string `json:"apiKey,omitempty"`
	Model        *string `json:"model,omitempty"`
	Temperature  *float64`json:"temperature,omitempty"`
	BaseURL      *string `json:"baseURL,omitempty"`
	SystemPrompt *string `json:"systemPrompt,omitempty"`
	Weight       *float64`json:"weight,omitempty"`
}

type ConsensusMode string

const (
	SimpleMajority    ConsensusMode = "simple-majority"
	Supermajority     ConsensusMode = "supermajority"
	Unanimous         ConsensusMode = "unanimous"
	Weighted          ConsensusMode = "weighted"
	CEOOverride       ConsensusMode = "ceo-override"
	CEOVeto           ConsensusMode = "ceo-veto"
	HybridCEOMajority ConsensusMode = "hybrid-ceo-majority"
	RankedChoice      ConsensusMode = "ranked-choice"
)

type SpecializedCouncilConfig struct {
	CouncilConfig
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Specialties []TaskType `json:"specialties"`
}

type CouncilConfig struct {
	Supervisors         []SupervisorConfig         `json:"supervisors"`
	DebateRounds        *int                       `json:"debateRounds,omitempty"`
	ConsensusThreshold  *float64                   `json:"consensusThreshold,omitempty"`
	Enabled             *bool                      `json:"enabled,omitempty"`
	SmartPilot          *bool                      `json:"smartPilot,omitempty"`
	WeightedVoting      *bool                      `json:"weightedVoting,omitempty"`
	ConsensusMode       *ConsensusMode             `json:"consensusMode,omitempty"`
	LeadSupervisor      *string                    `json:"leadSupervisor,omitempty"`
	FallbackSupervisors []string                   `json:"fallbackSupervisors,omitempty"`
	SpecializedCouncils []SpecializedCouncilConfig `json:"specializedCouncils,omitempty"`
}

type SessionTemplate struct {
	Name          string            `json:"name"`
	Description   *string           `json:"description,omitempty"`
	Supervisors   []SupervisorConfig`json:"supervisors"`
	CouncilConfig *CouncilConfig    `json:"councilConfig,omitempty"`
	AutoStart     *bool             `json:"autoStart,omitempty"`
	Tags          []string          `json:"tags,omitempty"`
}

type SessionStatus string

const (
	Idle       SessionStatus = "idle"
	Starting   SessionStatus = "starting"
	Running    SessionStatus = "running"
	Paused     SessionStatus = "paused"
	Stopped    SessionStatus = "stopped"
	Error      SessionStatus = "error"
	Completed  SessionStatus = "completed"
)

type PersistedSession struct {
	ID               string                 `json:"id"`
	Status           SessionStatus          `json:"status"`
	StartedAt        int64                  `json:"startedAt"`
	LastActivity     *int64                 `json:"lastActivity,omitempty"`
	CurrentTask      *string                `json:"currentTask,omitempty"`
	Port             int                    `json:"port"`
	WorkingDirectory *string                `json:"workingDirectory,omitempty"`
	TemplateName     *string                `json:"templateName,omitempty"`
	Tags             []string               `json:"tags,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

type Session struct {
	ID               string        `json:"id"`
	Status           SessionStatus `json:"status"`
	StartedAt        int64         `json:"startedAt"`
	LastActivity     *int64        `json:"lastActivity,omitempty"`
	CurrentTask      *string       `json:"currentTask,omitempty"`
	Logs             []LogEntry    `json:"logs"`
	Port             *int          `json:"port,omitempty"`
	WorkingDirectory *string       `json:"workingDirectory,omitempty"`
	TemplateName     *string       `json:"templateName,omitempty"`
	Tags             []string      `json:"tags,omitempty"`
}

type LogEntry struct {
	Timestamp int64  `json:"timestamp"`
	Level     string `json:"level"` // 'info', 'warn', 'error', 'debug'
	Message   string `json:"message"`
	Source    *string`json:"source,omitempty"`
}

type DevelopmentTask struct {
	ID          string  `json:"id"`
	Description string  `json:"description"`
	Context     string  `json:"context"`
	Files       []string`json:"files"`
	Timestamp   *int64  `json:"timestamp,omitempty"`
	CLIType     *CLIType`json:"cliType,omitempty"`
}

type CouncilDecision struct {
	Approved          bool     `json:"approved"`
	Consensus         float64  `json:"consensus"`
	WeightedConsensus *float64 `json:"weightedConsensus,omitempty"`
	Votes             []Vote   `json:"votes"`
	Reasoning         string   `json:"reasoning"`
	Dissent           []string `json:"dissent,omitempty"`
}

type Vote struct {
	Supervisor string  `json:"supervisor"`
	Approved   bool    `json:"approved"`
	Confidence float64 `json:"confidence"`
	Weight     float64 `json:"weight"`
	Comment    string  `json:"comment"`
}

type Guidance struct {
	Approved           bool     `json:"approved"`
	Feedback           string   `json:"feedback"`
	SuggestedNextSteps []string `json:"suggestedNextSteps"`
}

// Supervisor interface might need its own package if we want to avoid circular dependencies
// between shared and supervisors, but we'll put it here for now matching TS structure.
type Supervisor interface {
	GetName() string
	GetProvider() string
	Chat(messages []Message) (string, error)
	IsAvailable() (bool, error)
}

type ApiResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *string     `json:"error,omitempty"`
}

type WebSocketMessage struct {
	Type      string      `json:"type"` // 'session_update', 'council_decision', etc.
	Payload   interface{} `json:"payload"`
	Timestamp int64       `json:"timestamp"`
}

type BulkSessionRequest struct {
	Count          int      `json:"count"`
	Template       *string  `json:"template,omitempty"`
	Tags           []string `json:"tags,omitempty"`
	StaggerDelayMs *int     `json:"staggerDelayMs,omitempty"`
}

type BulkSessionResponse struct {
	Sessions []Session `json:"sessions"`
	Failed   []struct {
		Index int    `json:"index"`
		Error string `json:"error"`
	} `json:"failed"`
}

type SessionPersistenceConfig struct {
	Enabled              bool   `json:"enabled"`
	FilePath             string `json:"filePath"`
	AutoSaveIntervalMs   int    `json:"autoSaveIntervalMs"`
	AutoResumeOnStart    bool   `json:"autoResumeOnStart"`
	MaxPersistedSessions int    `json:"maxPersistedSessions"`
}

type CLIType string

const (
	Opencode           CLIType = "opencode"
	Claude             CLIType = "claude"
	Aider              CLIType = "aider"
	Cursor             CLIType = "cursor"
	Continue           CLIType = "continue"
	Cody               CLIType = "cody"
	Copilot            CLIType = "copilot"
	Custom             CLIType = "custom"
	Adrenaline         CLIType = "adrenaline"
	AmazonQ            CLIType = "amazon-q"
	AmazonQDeveloper   CLIType = "amazon-q-developer"
	AmpCode            CLIType = "amp-code"
	Auggie             CLIType = "auggie"
	AzureOpenAI        CLIType = "azure-openai"
	Bito               CLIType = "bito"
	ByteRover          CLIType = "byterover"
	ClaudeCode         CLIType = "claude-code"
	CodeCodex          CLIType = "code-codex"
	CodeBuff           CLIType = "codebuff"
	CodeMachine        CLIType = "codemachine"
	Codex              CLIType = "codex"
	Crush              CLIType = "crush"
	Dolt               CLIType = "dolt"
	Factory            CLIType = "factory"
	Gemini             CLIType = "gemini"
	Goose              CLIType = "goose"
	Grok               CLIType = "grok"
	Jules              CLIType = "jules"
	KiloCode           CLIType = "kilo-code"
	Kimi               CLIType = "kimi"
	LLM                CLIType = "llm"
	LiteLLM            CLIType = "litellm"
	Llamafile          CLIType = "llamafile"
	Manus              CLIType = "manus"
	MistralVibe        CLIType = "mistral-vibe"
	Ollama             CLIType = "ollama"
	OpenInterpreter    CLIType = "open-interpreter"
	Pi                 CLIType = "pi"
	QwenCode           CLIType = "qwen-code"
	RowboatX           CLIType = "rowboatx"
	Rovo               CLIType = "rovo"
	ShellPilot         CLIType = "shell-pilot"
	Smithery           CLIType = "smithery"
	Trae               CLIType = "trae"
	Warp               CLIType = "warp"
)

type CLITool struct {
	Type           CLIType  `json:"type"`
	Name           string   `json:"name"`
	Command        string   `json:"command"`
	Args           []string `json:"args"`
	HealthEndpoint *string  `json:"healthEndpoint,omitempty"`
	DetectCommand  *string  `json:"detectCommand,omitempty"`
	Available      *bool    `json:"available,omitempty"`
	Version        *string  `json:"version,omitempty"`
	Capabilities   []string `json:"capabilities,omitempty"`
	Interactive    *bool    `json:"interactive,omitempty"`
	PromptRegex    *string  `json:"promptRegex,omitempty"`
}

type LogRotationConfig struct {
	MaxLogsPerSession int `json:"maxLogsPerSession"`
	MaxLogAgeMs       int `json:"maxLogAgeMs"`
	PruneIntervalMs   int `json:"pruneIntervalMs"`
}

type HealthCheckConfig struct {
	Enabled     bool `json:"enabled"`
	IntervalMs  int  `json:"intervalMs"`
	TimeoutMs   int  `json:"timeoutMs"`
	MaxFailures int  `json:"maxFailures"`
}

type CrashRecoveryConfig struct {
	Enabled            bool `json:"enabled"`
	MaxRestartAttempts int  `json:"maxRestartAttempts"`
	RestartDelayMs     int  `json:"restartDelayMs"`
	BackoffMultiplier  int  `json:"backoffMultiplier"`
	MaxBackoffMs       int  `json:"maxBackoffMs"`
}

type SessionHealthStatus string

const (
	Healthy      SessionHealthStatus = "healthy"
	Degraded     SessionHealthStatus = "degraded"
	Unresponsive SessionHealthStatus = "unresponsive"
	Crashed      SessionHealthStatus = "crashed"
)

type SessionHealth struct {
	Status              SessionHealthStatus `json:"status"`
	LastCheck           int64               `json:"lastCheck"`
	ConsecutiveFailures int                 `json:"consecutiveFailures"`
	RestartCount        int                 `json:"restartCount"`
	LastRestartAt       *int64              `json:"lastRestartAt,omitempty"`
	ErrorMessage        *string             `json:"errorMessage,omitempty"`
}

type TaskType string

const (
	SecurityAudit TaskType = "security-audit"
	UIDesign      TaskType = "ui-design"
	APIDesign     TaskType = "api-design"
	Performance   TaskType = "performance"
	Refactoring   TaskType = "refactoring"
	BugFix        TaskType = "bug-fix"
	Testing       TaskType = "testing"
	Documentation TaskType = "documentation"
	Architecture  TaskType = "architecture"
	CodeReview    TaskType = "code-review"
	General       TaskType = "general"
)

type SupervisorProfile struct {
	Name               string     `json:"name"`
	Provider           string     `json:"provider"`
	Strengths          []TaskType `json:"strengths"`
	Weaknesses         []TaskType `json:"weaknesses,omitempty"`
	Specializations    []string   `json:"specializations,omitempty"`
	PreferredForLeadOn []TaskType `json:"preferredForLeadOn,omitempty"`
}

type TeamTemplate struct {
	Name           string        `json:"name"`
	Description    string        `json:"description"`
	TaskTypes      []TaskType    `json:"taskTypes"`
	Supervisors    []string      `json:"supervisors"`
	LeadSupervisor *string       `json:"leadSupervisor,omitempty"`
	ConsensusMode  *ConsensusMode`json:"consensusMode,omitempty"`
	MinSupervisors *int          `json:"minSupervisors,omitempty"`
}

type TeamSelectionResult struct {
	Team           []string      `json:"team"`
	LeadSupervisor *string       `json:"leadSupervisor,omitempty"`
	ConsensusMode  ConsensusMode `json:"consensusMode"`
	Reasoning      string        `json:"reasoning"`
	TaskType       TaskType      `json:"taskType"`
	Confidence     float64       `json:"confidence"`
}

type SubTaskStatus string

const (
	SubTaskPending    SubTaskStatus = "pending"
	SubTaskInProgress SubTaskStatus = "in_progress"
	SubTaskCompleted  SubTaskStatus = "completed"
	SubTaskFailed     SubTaskStatus = "failed"
)

type SubTask struct {
	ID                 string        `json:"id"`
	Title              string        `json:"title"`
	Description        string        `json:"description"`
	Dependencies       []string      `json:"dependencies"`
	Status             SubTaskStatus `json:"status"`
	AssignedSupervisor *string       `json:"assignedSupervisor,omitempty"`
	PreferredCLI       *CLIType      `json:"preferredCLI,omitempty"`
	Context            *string       `json:"context,omitempty"`
}

type TaskPlan struct {
	OriginalTaskID string    `json:"originalTaskId"`
	Subtasks       []SubTask `json:"subtasks"`
	Reasoning      string    `json:"reasoning"`
}
