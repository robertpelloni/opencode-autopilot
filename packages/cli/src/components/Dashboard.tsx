import React from 'react';
import { Box, Text } from 'ink';
import type { Session, CouncilConfig, CouncilDecision, LogEntry } from '@opencode-autopilot/shared';

interface DashboardProps {
  sessions: Session[];
  council: { enabled: boolean; supervisorCount: number; availableCount?: number; config: CouncilConfig } | null;
  view: 'dashboard' | 'logs' | 'council';
  wsLogs?: LogEntry[];
  wsDecisions?: CouncilDecision[];
}

export function Dashboard({ sessions, council, view, wsLogs = [], wsDecisions = [] }: DashboardProps) {
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
            <Box key={s.id} gap={2}>
              <Text color={s.status === 'running' ? 'green' : 'yellow'}>●</Text>
              <Text>{s.id}</Text>
              <Text color="gray">{s.status}</Text>
              <Text color="gray">{s.currentTask || 'idle'}</Text>
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
            
            {council.config.supervisors.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Text bold>Configured Supervisors:</Text>
                {council.config.supervisors.map((s, i) => (
                  <Box key={i} gap={2} marginLeft={2}>
                    <Text color="cyan">•</Text>
                    <Text>{s.name}</Text>
                    <Text color="gray">({s.provider})</Text>
                    <Text color="gray">{s.model || 'default'}</Text>
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

  return null;
}
