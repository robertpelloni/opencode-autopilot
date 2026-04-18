package main

import (
	"log"
	"net/http"

	"borg-orchestrator/pkg/server/api"
	"borg-orchestrator/pkg/server/services/cli"
	"borg-orchestrator/pkg/server/services/env"
	"borg-orchestrator/pkg/server/services/session"
	"borg-orchestrator/pkg/server/services/ws"
)

func main() {
	log.Println("Starting Borg Orchestrator Backend...")

	// Initialize Services
	envMgr := env.NewEnvironmentManagerService()
	cliReg := cli.NewCLIRegistryService()
	wsMgr := ws.NewWSManagerService()
	sessionMgr := session.NewSessionManagerService(envMgr, cliReg, wsMgr)

	// Build API Server
	server := api.NewAPIServer(sessionMgr, envMgr, cliReg, wsMgr)

	// Run Server
	port := ":3847"
	log.Printf("Server listening on %s", port)
	if err := http.ListenAndServe(port, server); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
