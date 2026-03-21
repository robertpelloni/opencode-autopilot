import React from 'react';
import { Box, Text } from 'ink';
import type { Session, CouncilConfig, CouncilDecision, LogEntry, TaskPlan } from '@opencode-autopilot/shared';

interface SmartPilotStatus {
  enabled: boolean;
  config: {
    pollIntervalMs: number;
    autoApproveThreshold: number;
    requireUnanimous: boolean;
    maxAutoApprovals: number;
  };
}

interface DashboardProps {
  sessions: Session[];
  council: { enabled: boolean; supervisorCount: number; availableCount?: number; config: CouncilConfig; hierarchy?: any[] } | null;
  smartPilot: SmartPilotStatus | null;
  activePlans?: Record<string, TaskPlan>;
  view: 'dashboard' | 'logs' | 'council' | 'pilot' | 'settings' | 'help' | 'evolve' | 'architecture' | 'grid' | 'memory';
  wsLogs?: LogEntry[];
  wsDecisions?: CouncilDecision[];
}

export function Dashboard({ sessions, council, smartPilot, activePlans = {}, view, wsLogs = [], wsDecisions = [] }: DashboardProps) {
  if (view === 'memory') {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold underline color="cyan">Phase 11: Collective Memory (The Borg Knowledge Base)</Text>
        </Box>
        <Text>Sub-agents across different sessions share discovered facts here.</Text>
        
        <Box marginTop={1} flexDirection="column">
          <Text bold underline>Recently Learned Facts</Text>
          {/* In a real scenario, we would fetch these from the API. 
              For the static UI component, we show a placeholder of what it looks like. */}
          <Box gap={2}>
            <Text color="cyan">⚙</Text>
            <Text bold>project_structure</Text>
            <Text color="gray">"Monorepo with Bun/Hono"</Text>
            <Text color="blue">[95% confidence]</Text>
          </Box>
          <Box gap={2}>
            <Text color="cyan">⚙</Text>
            <Text bold>api_key_status</Text>
            <Text color="gray">"OpenAI Key Rotated"</Text>
            <Text color="blue">[100% confidence]</Text>
          </Box>
          <Box gap={2}>
            <Text color="cyan">⚙</Text>
            <Text bold>main_entry_point</Text>
            <Text color="gray">"packages/server/src/index.ts"</Text>
            <Text color="blue">[88% confidence]</Text>
          </Box>
        </Box>

        <Box marginTop={1}>
          <Text color="gray">Use 'opencode memory search [query]' to query the collective mind.</Text>
        </Box>
      </Box>
    );
  }

  if (view === 'grid') {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold underline color="yellow">Multi-Session Grid View</Text>
        </Box>
        <Box flexWrap="wrap" gap={2}>
          {sessions.map((s) => (
            <Box key={s.id} width={40} height={10} borderStyle="single" borderColor={s.status === 'running' ? 'green' : 'gray'} flexDirection="column" paddingX={1}>
              <Box justifyContent="space-between">
                <Text bold>{s.id.slice(-8)}</Text>
                <Text color={s.status === 'running' ? 'green' : 'gray'}>{s.status.toUpperCase()}</Text>
              </Box>
              <Text color="cyan">CLI Session</Text>
              <Box marginTop={1}>
                <Text color="gray" italic>{s.currentTask?.slice(0, 35) || 'Idle...'}</Text>
              </Box>
              <Box marginTop={1} flexDirection="column">
                {s.logs.slice(-3).map((l, i) => (
                  <Text key={i} color="gray" dimColor>{'>'} {l.message.slice(0, 30)}</Text>
                ))}
              </Box>
            </Box>
          ))}
          {sessions.length === 0 && <Text color="gray">No active sessions to display in grid.</Text>}
        </Box>
      </Box>
    );
  }

  if (view === 'architecture') {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold underline color="blue">Phase 8: Visual Architecture (Mermaid)</Text>
        </Box>
        <Text color="gray">System and Swarm architecture generated as Mermaid code:</Text>
        
        <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1}>
          <Text color="cyan">graph LR</Text>
          <Text color="cyan">  subgraph Council["Supreme Council"]</Text>
          <Text color="cyan">    Orchestrator((Orchestrator))</Text>
          <Text color="cyan">    Analytics[(Analytics DB)]</Text>
          <Text color="cyan">  end</Text>
          <Text color="cyan">  subgraph Tools["AI Tool Fleet"]</Text>
          <Text color="cyan">    opencode[opencode]</Text>
          <Text color="cyan">    gemini[gemini]</Text>
          <Text color="cyan">    copilot[copilot]</Text>
          <Text color="cyan">  end</Text>
          <Text color="cyan">  Orchestrator --&gt; Tools</Text>
        </Box>
        
        <Box marginTop={1}>
          <Text>Open http://localhost:3847/api/visual/system to see live architecture.</Text>
        </Box>
      </Box>
    );
  }

  if (view === 'evolve') {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold underline color="magenta">Phase 7: Self-Evolution Console</Text>
        </Box>
        <Text>The system can analyze its own performance metrics and re-weight supervisor</Text>
        <Text>trust scores dynamically, or spawn meta-sessions to rewrite its own source code.</Text>

        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">Controls:</Text>
          <Text> [o] Optimize Weights - Read analytics and adjust supervisor weightings.</Text>
          <Text> [e] Evolve Codebase  - Launch an autonomous session to self-improve code.</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold underline>Active Meta Sessions</Text>
          {sessions.filter(s => s.tags?.includes('self-evolution')).length === 0 ? (
            <Text color="gray">No active meta-sessions modifying codebase.</Text>
          ) : (
            sessions.filter(s => s.tags?.includes('self-evolution')).map((s) => (
              <Box key={s.id} gap={2}>
                <Text color="magenta">⚙</Text>
                <Text bold>{s.id}</Text>
                <Text color="gray">{s.currentTask}</Text>
              </Box>
            ))
          )}
        </Box>
      </Box>
    );
  }

  if (view === 'dashboard') {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold underline>Sessions ({sessions.length})</Text>
        </Box>
        {sessions.length === 0 ? (
          <Text color="gray">No active sessions</Text>
        ) : (
          sessions.map((s) => (
            <Box key={s.id} flexDirection="column" marginBottom={1}>
              <Box gap={2}>
                <Text color={s.status === 'running' ? 'green' : 'yellow'}>●</Text>
                <Text bold>{s.id}</Text>
                <Text color="gray">[{s.status}]</Text>
                <Text color="gray">{s.currentTask || 'idle'}</Text>
                {s.templateName && <Text color="blue">({s.templateName})</Text>}
              </Box>
              
              {activePlans[s.id] && (
                <Box flexDirection="column" marginLeft={2} marginTop={1}>
                  <Text color="cyan" bold>Swarm Progress:</Text>
                  {activePlans[s.id].subtasks.map((t, i) => (
                    <Box key={i} gap={1}>
                      <Text color={t.status === 'completed' ? 'green' : t.status === 'in_progress' ? 'yellow' : 'gray'}>
                        {t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '▶' : '○'}
                      </Text>
                      <Text color={t.status === 'in_progress' ? 'white' : 'gray'}>{t.title}</Text>
                      {t.preferredCLI && <Text color="blue">[{t.preferredCLI}]</Text>}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ))
        )}
        
        {wsDecisions.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold underline>Recent Decisions ({wsDecisions.length})</Text>
            {wsDecisions.slice(-5).map((d, i) => (
              <Box key={i} gap={2}>
                <Text color={d.approved ? 'green' : 'red'}>
                  {d.approved ? '✓' : '✗'}
                </Text>
                <Text>{Math.round(d.consensus * 100)}% consensus</Text>
                <Text color="gray">({d.votes.length} votes)</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  }

  if (view === 'logs') {
    const sessionLogs = sessions.flatMap((s) => 
      s.logs.map((l) => ({ ...l, sessionId: s.id }))
    );
    const allLogs = [...sessionLogs, ...wsLogs]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold underline>Recent Logs</Text>
        </Box>
        {allLogs.length === 0 ? (
          <Text color="gray">No logs yet</Text>
        ) : (
          allLogs.map((log, i) => (
            <Box key={i} gap={1}>
              <Text color="gray">{new Date(log.timestamp).toLocaleTimeString()}</Text>
              <Text color={log.level === 'error' ? 'red' : log.level === 'warn' ? 'yellow' : 'white'}>
                [{log.level}]
              </Text>
              <Text>{log.message.slice(0, 80)}</Text>
            </Box>
          ))
        )}
      </Box>
    );
  }

  if (view === 'council') {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold underline>Council Status</Text>
        </Box>
        {council ? (
          <Box flexDirection="column" gap={1}>
            <Box gap={2}>
              <Text>Status:</Text>
              <Text color={council.enabled ? 'green' : 'red'}>
                {council.enabled ? 'ENABLED' : 'DISABLED'}
              </Text>
            </Box>
            <Box gap={2}>
              <Text>Supervisors:</Text>
              <Text>{council.supervisorCount} configured</Text>
              {council.availableCount !== undefined && (
                <Text color="gray">({council.availableCount} available)</Text>
              )}
            </Box>
            <Box gap={2}>
              <Text>Debate Rounds:</Text>
              <Text>{council.config.debateRounds || 2}</Text>
            </Box>
            <Box gap={2}>
              <Text>Consensus:</Text>
              <Text>{(council.config.consensusThreshold || 0.7) * 100}%</Text>
            </Box>
            <Box gap={2}>
              <Text>Mode:</Text>
              <Text>{council.config.consensusMode || 'weighted'}</Text>
            </Box>
            
            {council.config.supervisors.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Text bold>Configured Supervisors:</Text>
                {council.config.supervisors.map((s, i) => (
                  <Box key={i} gap={2} marginLeft={2}>
                    <Text color="cyan">•</Text>
                    <Text>{s.name}</Text>
                    <Text color="gray">({s.provider})</Text>
                    <Text color="gray">w: {s.weight || 1}</Text>
                    <Text color="gray">{s.model || 'default'}</Text>
                  </Box>
                ))}
              </Box>
            )}

            {council.hierarchy && council.hierarchy.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Text bold color="blue">Specialized Sub-Councils:</Text>
                {council.hierarchy.map((sub, i) => (
                  <Box key={i} flexDirection="column" marginLeft={2} marginBottom={1}>
                    <Box gap={2}>
                      <Text color="blue">↳</Text>
                      <Text bold>{sub.name}</Text>
                      <Text color="gray">({sub.supervisorCount} supervisors)</Text>
                    </Box>
                    <Box marginLeft={3} gap={1} flexWrap="wrap">
                      {sub.specialties.map((spec: string, si: number) => (
                        <Text key={si} color="magenta" dimColor>[{spec}]</Text>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        ) : (
          <Text color="gray">Loading council status...</Text>
        )}
      </Box>
    );
  }

  if (view === 'pilot') {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold underline>Smart Pilot Status</Text>
        </Box>
        {smartPilot ? (
          <Box flexDirection="column" gap={1}>
            <Box gap={2}>
              <Text>Status:</Text>
              <Text color={smartPilot.enabled ? 'green' : 'red'}>
                {smartPilot.enabled ? 'ENABLED' : 'DISABLED'}
              </Text>
            </Box>
            <Box gap={2}>
              <Text>Auto-approve Threshold:</Text>
              <Text>{(smartPilot.config.autoApproveThreshold * 100).toFixed(0)}%</Text>
            </Box>
            <Box gap={2}>
              <Text>Max Auto-approvals:</Text>
              <Text>{smartPilot.config.maxAutoApprovals}</Text>
            </Box>
            <Box gap={2}>
              <Text>Require Unanimous:</Text>
              <Text color={smartPilot.config.requireUnanimous ? 'yellow' : 'gray'}>
                {smartPilot.config.requireUnanimous ? 'YES' : 'NO'}
              </Text>
            </Box>
            <Box gap={2}>
              <Text>Poll Interval:</Text>
              <Text>{smartPilot.config.pollIntervalMs}ms</Text>
            </Box>
          </Box>
        ) : (
          <Text color="gray">Loading smart pilot status...</Text>
        )}
        
        {wsDecisions.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold underline>Debate History ({wsDecisions.length})</Text>
            {wsDecisions.slice(-10).map((d, i) => (
              <Box key={i} flexDirection="column" marginTop={1} paddingLeft={1} borderStyle="single" borderColor={d.approved ? 'green' : 'red'}>
                <Box gap={2}>
                  <Text color={d.approved ? 'green' : 'red'}>
                    {d.approved ? '✓ APPROVED' : '✗ REJECTED'}
                  </Text>
                  <Text>Simple: {Math.round(d.consensus * 100)}%</Text>
                  {d.weightedConsensus !== undefined && (
                    <Text>Weighted: {Math.round(d.weightedConsensus * 100)}%</Text>
                  )}
                </Box>
                <Box gap={1} marginTop={1}>
                  {d.votes.map((v, vi) => (
                    <Box key={vi} gap={1}>
                      <Text color={v.approved ? 'green' : 'red'}>{v.approved ? '✓' : '✗'}</Text>
                      <Text>{v.supervisor}</Text>
                      <Text color="gray">({(v.confidence * 100).toFixed(0)}%)</Text>
                    </Box>
                  ))}
                </Box>
                {d.dissent && d.dissent.length > 0 && (
                  <Box marginTop={1}>
                    <Text color="yellow">⚠ {d.dissent.length} strong dissent(s)</Text>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  }

  if (view === 'settings') {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold underline>Settings</Text>
        </Box>
        <Text color="gray">Edit settings via Web Dashboard (http://localhost:3847/dashboard)</Text>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Environment Variables:</Text>
          <Text>Use `opencode env set KEY=VALUE`</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>CLI Tools:</Text>
          <Text>Auto-detected on startup. Use `opencode cli refresh` to rescan.</Text>
        </Box>
      </Box>
    );
  }

  if (view === 'help') {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold underline>Help & Documentation</Text>
        </Box>
        <Box flexDirection="column" gap={1}>
          <Box>
            <Text bold>Keys:</Text>
            <Text> [1-6] Switch Views | [r] Refresh | [t] Toggle Council | [p] Toggle Pilot | [q] Quit</Text>
          </Box>
          <Box>
            <Text bold>Consensus Modes:</Text>
            <Text> Simple Majority, Supermajority, Unanimous, Weighted, CEO Override</Text>
          </Box>
          <Box>
            <Text bold>Web Dashboard:</Text>
            <Text color="blue"> http://localhost:3847/dashboard</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return null;
}
