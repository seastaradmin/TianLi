/**
 * API utilities for TianLi Dashboard
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export interface MetricsResponse {
  totalSessions: number;
  totalRequests: number;
  l1PassRate: number;
  l2PassRate: number;
  earlyExitRate: number;
  avgLatencyMs: number;
  totalViolations: number;
  evolutionPatches: number;
  timeRange: '24h' | '7d' | '30d';
}

export interface SessionResponse {
  session_id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  total_requests: number;
  successful_completions: number;
  early_exits: number;
  l1_pass_rate: number;
  l2_pass_rate: number;
  avg_l2_score: number;
  tool_calls: {
    total: number;
    by_tool: Record<string, number>;
  };
  status: 'completed' | 'running' | 'early_exit';
  evolution_patches: number;
}

export interface HealthResponse {
  executor: {
    status: 'healthy' | 'warning' | 'error';
    platforms: Record<string, boolean>;
  };
  resources: {
    status: 'healthy' | 'warning' | 'error';
    cpu_percent: number;
    memory_mb: number;
    disk_percent: number;
  };
  audit: {
    status: 'healthy' | 'warning' | 'error';
    active_rules: number;
    l2_sample_rate: number;
    last_update: string;
  };
}

export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export async function fetchMetrics(timeRange: '24h' | '7d' | '30d' = '24h'): Promise<MetricsResponse> {
  try {
    const response = await fetch(apiUrl(`/api/metrics?range=${timeRange}`));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch metrics:', error);
    // Return mock data for development
    return {
      totalSessions: 156,
      totalRequests: 2847,
      l1PassRate: 0.892,
      l2PassRate: 0.967,
      earlyExitRate: 0.043,
      avgLatencyMs: 234,
      totalViolations: 23,
      evolutionPatches: 12,
      timeRange,
    };
  }
}

export async function fetchSessions(limit: number = 10): Promise<SessionResponse[]> {
  try {
    const response = await fetch(apiUrl(`/api/sessions?limit=${limit}`));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    // Return mock data for development
    return [
      {
        session_id: 'session-001',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        duration_seconds: 45.2,
        total_requests: 10,
        successful_completions: 9,
        early_exits: 1,
        l1_pass_rate: 0.9,
        l2_pass_rate: 1.0,
        avg_l2_score: 0.92,
        tool_calls: {
          total: 15,
          by_tool: { Read: 8, Write: 4, Bash: 3 },
        },
        status: 'completed',
        evolution_patches: 1,
      },
      {
        session_id: 'session-002',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        duration_seconds: 32.8,
        total_requests: 8,
        successful_completions: 8,
        early_exits: 0,
        l1_pass_rate: 1.0,
        l2_pass_rate: 1.0,
        avg_l2_score: 0.95,
        tool_calls: {
          total: 12,
          by_tool: { Read: 6, Edit: 4, Glob: 2 },
        },
        status: 'completed',
        evolution_patches: 0,
      },
    ];
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  try {
    const response = await fetch(apiUrl('/api/health'));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch health:', error);
    // Return mock data for development
    return {
      executor: {
        status: 'healthy',
        platforms: {
          openclaw: true,
          local: true,
          cursor: false,
          'claude-code': false,
          opencode: false,
        },
      },
      resources: {
        status: 'healthy',
        cpu_percent: 23,
        memory_mb: 1228,
        disk_percent: 45,
      },
      audit: {
        status: 'healthy',
        active_rules: 15,
        l2_sample_rate: 0.3,
        last_update: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    };
  }
}

export async function fetchChartData(
  metric: string,
  timeRange: '24h' | '7d' | '30d' = '24h',
): Promise<ChartDataPoint[]> {
  try {
    const response = await fetch(apiUrl(`/api/charts/${metric}?range=${timeRange}`));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch chart data:', error);
    // Return mock data for development
    const now = Date.now();
    const points: ChartDataPoint[] = [];
    const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30;
    
    for (let i = hours - 1; i >= 0; i--) {
      const timestamp = new Date(now - i * 60 * 60 * 1000).toISOString();
      points.push({
        timestamp,
        value: Math.floor(Math.random() * 100) + 50,
        label: timeRange === '24h' ? `${i}h ago` : `${i}d ago`,
      });
    }
    
    return points;
  }
}

export async function exportReport(timeRange: '24h' | '7d' | '30d' = '24h'): Promise<Blob> {
  try {
    const response = await fetch(apiUrl(`/api/reports/export?range=${timeRange}`));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    console.error('Failed to export report:', error);
    // Return mock PDF for development
    return new Blob(['Mock Report'], { type: 'application/pdf' });
  }
}
