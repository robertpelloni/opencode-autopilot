import { useState, useCallback } from 'react';
import type { Session, CouncilConfig, ApiResponse } from '@opencode-autopilot/shared';

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

  const refresh = useCallback(() => {
    fetchSessions();
    fetchCouncil();
    fetchSmartPilot();
  }, [fetchSessions, fetchCouncil, fetchSmartPilot]);

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

  return {
    sessions,
    council,
    smartPilot,
    error,
    refresh,
    startSession,
    stopSession,
    approveSession,
    toggleCouncil,
    toggleSmartPilot,
  };
}
