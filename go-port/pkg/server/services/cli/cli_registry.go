package cli

import "borg-orchestrator/pkg/shared"

var Service = &CLIRegistry{}

type CLIRegistry struct{}

func (s *CLIRegistry) GetTool(cliType shared.CLIType) *shared.CLITool {
	b := true
	return &shared.CLITool{
		Interactive: &b,
	}
}

type ServeCmd struct {
	Command string
	Args    []string
}

func (s *CLIRegistry) GetServeCommand(cliType shared.CLIType, port int) *ServeCmd {
	return &ServeCmd{
		Command: "echo",
		Args:    []string{"hello"},
	}
}
