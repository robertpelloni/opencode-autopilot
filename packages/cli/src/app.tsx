import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Dashboard } from './components/Dashboard.js';
import { useApi } from './hooks/useApi.js';
import { useWebSocket } from './hooks/useWebSocket.js';

export function App() {
  const { exit } = useApp();
  const [view, setView] = useState<'dashboard' | 'logs' | 'council' | 'pilot'>('dashboard');
  const { sessions, council, smartPilot, refresh, toggleCouncil, toggleSmartPilot } = useApi();
  const ws = useWebSocket({ autoReconnect: true });

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    }
    if (input === '1') setView('dashboard');
    if (input === '2') setView('logs');
    if (input === '3') setView('council');
    if (input === '4') setView('pilot');
    if (input === 'r') refresh();
    if (input === 't') toggleCouncil();
    if (input === 'p') toggleSmartPilot();
  });

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const wsStatusColor = ws.isConnected ? 'green' : ws.status === 'connecting' ? 'yellow' : 'red';
  const pilotColor = smartPilot?.enabled ? 'green' : 'gray';

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">opencode-autopilot</Text>
        <Text> │ </Text>
        <Text color={view === 'dashboard' ? 'green' : 'gray'}>[1] Dashboard</Text>
        <Text> </Text>
        <Text color={view === 'logs' ? 'green' : 'gray'}>[2] Logs</Text>
        <Text> </Text>
        <Text color={view === 'council' ? 'green' : 'gray'}>[3] Council</Text>
        <Text> </Text>
        <Text color={view === 'pilot' ? 'green' : 'gray'}>[4] Pilot</Text>
        <Text> │ </Text>
        <Text color="gray">[r] Refresh [t] Toggle Council [p] Toggle Pilot [q] Quit</Text>
        <Text> │ </Text>
        <Text color={wsStatusColor}>●</Text>
        <Text color="gray"> WS </Text>
        <Text color={pilotColor}>●</Text>
        <Text color="gray"> Pilot</Text>
      </Box>
      
      <Dashboard 
        sessions={sessions} 
        council={council}
        smartPilot={smartPilot}
        view={view}
        wsLogs={ws.logs}
        wsDecisions={ws.decisions}
      />
    </Box>
  );
}
