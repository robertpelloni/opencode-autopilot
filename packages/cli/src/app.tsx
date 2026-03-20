import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Dashboard } from './components/Dashboard.js';
import { useApi } from './hooks/useApi.js';
import { useWebSocket } from './hooks/useWebSocket.js';

export function App() {
  const { exit } = useApp();
  const [view, setView] = useState<'dashboard' | 'logs' | 'council' | 'pilot' | 'settings' | 'help' | 'evolve'>('dashboard');
  const { sessions, council, smartPilot, activePlans, refresh, toggleCouncil, toggleSmartPilot, evolveSystem, optimizeWeights } = useApi();
  const ws = useWebSocket({ autoReconnect: true });

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    }
    if (input === '1') setView('dashboard');
    if (input === '2') setView('logs');
    if (input === '3') setView('council');
    if (input === '4') setView('pilot');
    if (input === '5') setView('settings');
    if (input === '6') setView('help');
    if (input === '7') setView('evolve');
    if (input === 'r') refresh();
    if (input === 't') toggleCouncil();
    if (input === 'p') toggleSmartPilot();
    if (view === 'evolve' && input === 'o') optimizeWeights();
    if (view === 'evolve' && input === 'e') {
      evolveSystem('Self-improve: write a new test for the SelfEvolutionService to ensure it loads correctly');
    }
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
        <Text> </Text>
        <Text color={view === 'settings' ? 'green' : 'gray'}>[5] Settings</Text>
        <Text> </Text>
        <Text color={view === 'help' ? 'green' : 'gray'}>[6] Help</Text>
        <Text> </Text>
        <Text color={view === 'evolve' ? 'magenta' : 'gray'}>[7] Evolve</Text>
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
        activePlans={activePlans}
        view={view}
        wsLogs={ws.logs}
        wsDecisions={ws.decisions}
      />
    </Box>
  );
}
