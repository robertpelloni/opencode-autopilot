import { useState, useCallback } from 'react';
import type { Session, CouncilConfig, ApiResponse, TaskPlan } from '@borg-orchestrator/shared';

const API_BASE = process.env.AUTOPILOT_API || 'http://localhost:3847';

interface SmartPilotStatus {
  enabled: boolean;
  config: {
    pollIntervalMs: number;
    autoApproveThreshold: number;
    requireUnanimous: boolean;
    maxAutoApprovals: number;
  };
}

export function useApi() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [council, setCouncil] = useState<{ enabled: boolean; supervisorCount: number; availableCount?: number; config: CouncilConfig } | null>(null);
  const [smartPilot, setSmartPilot] = useState<SmartPilotStatus | null>(null);
  const [activePlans, setActivePlans] = useState<Record<string, TaskPlan>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`);
      const data: ApiResponse<Session[]> = await res.json();
      if (data.success && data.data) {
        setSessions(data.data);
      }
    } catch (e) {
      setError('Failed to fetch sessions');
    }
  }, []);

  const fetchCouncil = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/council/status`);
      const data: ApiResponse<{ enabled: boolean; supervisorCount: number; availableCount?: number; config: CouncilConfig }> = await res.json();
      if (data.success && data.data) {
        setCouncil(data.data);
      }
    } catch (e) {
      setError('Failed to fetch council status');
    }
  }, []);

  const fetchSmartPilot = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/smart-pilot/status`);
      const data = await res.json();
      setSmartPilot(data);
    } catch (e) {
      setError('Failed to fetch smart pilot status');
    }
  }, []);

  const fetchActivePlans = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/smart-pilot/active-plans`);
      const data = await res.json();
      if (data.success) {
        setActivePlans(data.plans);
      }
    } catch (e) {
      setError('Failed to fetch active plans');
    }
  }, []);

  const refresh = useCallback(() => {
    fetchSessions();
    fetchCouncil();
    fetchSmartPilot();
    fetchActivePlans();
  }, [fetchSessions, fetchCouncil, fetchSmartPilot, fetchActivePlans]);

  const startSession = useCallback(async (id: string) => {
    const res = await fetch(`${API_BASE}/api/sessions/${id}/start`, { method: 'POST' });
    const data: ApiResponse<Session> = await res.json();
    if (data.success) refresh();
    return data;
  }, [refresh]);

  const stopSession = useCallback(async (id: string) => {
    const res = await fetch(`${API_BASE}/api/sessions/${id}/stop`, { method: 'POST' });
    const data: ApiResponse<Session> = await res.json();
    if (data.success) refresh();
    return data;
  }, [refresh]);

  const approveSession = useCallback(async (id: string) => {
    const res = await fetch(`${API_BASE}/api/sessions/${id}/approve`, { method: 'POST' });
    const data: ApiResponse<Session> = await res.json();
    if (data.success) refresh();
    return data;
  }, [refresh]);

  const toggleCouncil = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/council/toggle`, { method: 'POST' });
    const data: ApiResponse<{ enabled: boolean }> = await res.json();
    if (data.success) fetchCouncil();
    return data;
  }, [fetchCouncil]);

  const toggleSmartPilot = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/smart-pilot/toggle`, { method: 'POST' });
    const data = await res.json();
    if (data.success) fetchSmartPilot();
    return data;
  }, [fetchSmartPilot]);

  const evolveSystem = useCallback(async (description: string) => {
    const res = await fetch(`${API_BASE}/api/system/evolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    });
    const data = await res.json();
    if (data.success) refresh();
    return data;
  }, [refresh]);

  const optimizeWeights = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/system/optimize-weights`, { method: 'POST' });
    const data = await res.json();
    if (data.success) fetchCouncil();
    return data;
  }, [fetchCouncil]);

  const fetchSystemDiagram = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/visual/system`);
      const data = await res.json();
      return data.mermaid;
    } catch (e) {
      return '';
    }
  }, []);

  const fetchSwarmDiagram = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/visual/swarm/${sessionId}`);
      const data = await res.json();
      return data.mermaid;
    } catch (e) {
      return '';
    }
  }, []);

  return {
    sessions,
    council,
    smartPilot,
    activePlans,
    error,
    refresh,
    startSession,
    stopSession,
    approveSession,
    toggleCouncil,
    toggleSmartPilot,
    evolveSystem,
    optimizeWeights,
    fetchSystemDiagram,
    fetchSwarmDiagram,
  };
}
