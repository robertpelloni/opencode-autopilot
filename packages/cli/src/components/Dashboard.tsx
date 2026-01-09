import React from 'react';
import { Box, Text } from 'ink';
import type { Session, CouncilConfig, CouncilDecision, LogEntry } from '@opencode-autopilot/shared';

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
  council: { enabled: boolean; supervisorCount: number; availableCount?: number; config: CouncilConfig } | null;
  smartPilot: SmartPilotStatus | null;
  view: 'dashboard' | 'logs' | 'council' | 'pilot';
  wsLogs?: LogEntry[];
  wsDecisions?: CouncilDecision[];
}

export function Dashboard({ sessions, council, smartPilot, view, wsLogs = [], wsDecisions = [] }: DashboardProps) {
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

  return null;
}
