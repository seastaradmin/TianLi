import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Activity, 
  Shield, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  Server,
  Cpu,
  Download,
  RefreshCw
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { fetchMetrics, fetchSessions, fetchHealth, fetchChartData, exportReport, type MetricsResponse, type SessionResponse, type HealthResponse } from '../utils/api';

const COLORS = ['#6366F1', '#8B5CF6', '#22C55E', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#84CC16'];

const DashboardWithCharts: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [requestVolumeData, setRequestVolumeData] = useState<any[]>([]);
  const [auditPassRateData, setAuditPassRateData] = useState<any[]>([]);
  const [toolDistributionData, setToolDistributionData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  const fetchData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    
    try {
      const [metricsData, sessionsData, healthData, volumeData, passRateData] = await Promise.all([
        fetchMetrics(selectedTimeRange),
        fetchSessions(10),
        fetchHealth(),
        fetchChartData('requests', selectedTimeRange),
        fetchChartData('pass-rates', selectedTimeRange),
      ]);
      
      setMetrics(metricsData);
      setSessions(sessionsData);
      setHealth(healthData);
      setRequestVolumeData(volumeData);
      setAuditPassRateData(passRateData);
      
      // Calculate tool distribution from sessions
      const toolCounts: Record<string, number> = {};
      sessionsData.forEach(session => {
        Object.entries(session.tool_calls.by_tool).forEach(([tool, count]) => {
          toolCounts[tool] = (toolCounts[tool] || 0) + count;
        });
      });
      
      setToolDistributionData(
        Object.entries(toolCounts).map(([name, value]) => ({ name, value }))
      );
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedTimeRange]);

  const handleRefresh = () => {
    fetchData(false);
  };

  const handleExport = async () => {
    const blob = await exportReport(selectedTimeRange);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tianli-report-${selectedTimeRange}-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-primary-500" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">TianLi Harness</h1>
                <p className="text-xs text-gray-500">Constitutional AI Agent Governance</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value as '24h' | '7d' | '30d')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
              
              <button
                onClick={handleExport}
                className="flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Sessions"
            value={metrics?.totalSessions || 0}
            icon={Activity}
            trend="+12.5%"
            trendUp={true}
            color="primary"
          />
          <StatCard
            title="Total Requests"
            value={metrics?.totalRequests || 0}
            icon={Zap}
            trend="+8.2%"
            trendUp={true}
            color="secondary"
          />
          <StatCard
            title="L1 Pass Rate"
            value={`${((metrics?.l1PassRate || 0) * 100).toFixed(1)}%`}
            icon={Shield}
            trend="+2.1%"
            trendUp={true}
            color="success"
          />
          <StatCard
            title="L2 Pass Rate"
            value={`${((metrics?.l2PassRate || 0) * 100).toFixed(1)}%`}
            icon={CheckCircle2}
            trend="+0.5%"
            trendUp={true}
            color="success"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Early Exit Rate"
            value={`${((metrics?.earlyExitRate || 0) * 100).toFixed(1)}%`}
            icon={AlertCircle}
            trend="-1.2%"
            trendUp={true}
            color="warning"
          />
          <StatCard
            title="Avg Latency"
            value={`${metrics?.avgLatencyMs || 0}ms`}
            icon={Clock}
            trend="-15ms"
            trendUp={true}
            color="secondary"
          />
          <StatCard
            title="Violations"
            value={metrics?.totalViolations || 0}
            icon={AlertCircle}
            trend="-5"
            trendUp={true}
            color="error"
          />
          <StatCard
            title="Evolution Patches"
            value={metrics?.evolutionPatches || 0}
            icon={TrendingUp}
            trend="+3"
            trendUp={true}
            color="primary"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ChartCard
            title="Request Volume Over Time"
            description="Total requests processed per hour"
            icon={BarChart3}
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={requestVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" stroke="#64748B" fontSize={12} />
                  <YAxis stroke="#64748B" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#6366F1"
                    strokeWidth={2}
                    dot={{ fill: '#6366F1', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Requests"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          
          <ChartCard
            title="Audit Pass Rates"
            description="L1 vs L2 pass rates comparison"
            icon={TrendingUp}
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={auditPassRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" stroke="#64748B" fontSize={12} />
                  <YAxis stroke="#64748B" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="l1" fill="#8B5CF6" name="L1 Pass Rate %" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="l2" fill="#22C55E" name="L2 Pass Rate %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Tool Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Tool Usage Distribution</h2>
            <p className="text-sm text-gray-500 mt-1">Breakdown of tool calls across all sessions</p>
          </div>
          <div className="p-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={toolDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {toolDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Recent Sessions</h2>
              <p className="text-sm text-gray-500 mt-1">Latest agent execution sessions</p>
            </div>
            <button className="text-sm text-primary-500 hover:text-primary-600 font-medium">
              View All →
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Session ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    L1 Pass
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    L2 Pass
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Early Exits
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sessions.map((session) => (
                  <tr key={session.session_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-sm text-primary-600 bg-primary-50 px-2 py-1 rounded">
                        {session.session_id}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {session.duration_seconds.toFixed(1)}s
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {session.total_requests}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <PassRateBadge rate={session.l1_pass_rate} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <PassRateBadge rate={session.l2_pass_rate} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {session.early_exits}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
            <p className="text-sm text-gray-500 mt-1">Real-time system metrics</p>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <HealthCard
              icon={Server}
              title="Executor Health"
              status={health?.executor.status || 'healthy'}
              details="All platforms operational"
              metrics={Object.entries(health?.executor.platforms || {}).map(([platform, active]) => ({
                label: platform.charAt(0).toUpperCase() + platform.slice(1),
                value: active ? '✓ Active' : '○ Offline',
              }))}
            />
            
            <HealthCard
              icon={Cpu}
              title="Resource Usage"
              status={health?.resources.status || 'healthy'}
              details="Within normal limits"
              metrics={[
                { label: 'CPU', value: `${health?.resources.cpu_percent || 0}%` },
                { label: 'Memory', value: `${Math.round((health?.resources.memory_mb || 0) / 1024 * 10) / 10}GB` },
                { label: 'Disk', value: `${health?.resources.disk_percent || 0}%` },
              ]}
            />
            
            <HealthCard
              icon={Shield}
              title="Audit Engine"
              status={health?.audit.status || 'healthy'}
              details="Rules up to date"
              metrics={[
                { label: 'Active Rules', value: `${health?.audit.active_rules || 0}` },
                { label: 'L2 Sample Rate', value: `${((health?.audit.l2_sample_rate || 0) * 100).toFixed(0)}%` },
                { label: 'Last Update', value: formatTimeAgo(health?.audit.last_update || '') },
              ]}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

// Helper function
function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) {
    return 'Just now';
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}

// Sub-components (same as before)
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend: string;
  trendUp: boolean;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, trend, trendUp, color }) => {
  const colorClasses = {
    primary: 'bg-primary-500',
    secondary: 'bg-secondary-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          <div className={`flex items-center mt-2 text-sm ${trendUp ? 'text-success-600' : 'text-error-600'}`}>
            <TrendingUp className={`h-4 w-4 mr-1 ${!trendUp && 'rotate-180'}`} />
            <span>{trend}</span>
          </div>
        </div>
        <div className={`${colorClasses[color]} p-3 rounded-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
};

interface ChartCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, description, icon: Icon, children }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-3 mb-4">
        <Icon className="h-5 w-5 text-gray-400" />
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
};

interface StatusBadgeProps {
  status: 'completed' | 'running' | 'early_exit';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const badges = {
    completed: 'bg-success-100 text-success-800',
    running: 'bg-primary-100 text-primary-800',
    early_exit: 'bg-warning-100 text-warning-800',
  };

  const labels = {
    completed: 'Completed',
    running: 'Running',
    early_exit: 'Early Exit',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[status]}`}>
      {labels[status]}
    </span>
  );
};

interface PassRateBadgeProps {
  rate: number;
}

const PassRateBadge: React.FC<PassRateBadgeProps> = ({ rate }) => {
  const percentage = (rate * 100).toFixed(0);
  const color = rate >= 0.9 ? 'text-success-600' : rate >= 0.7 ? 'text-warning-600' : 'text-error-600';
  
  return (
    <span className={`text-sm font-medium ${color}`}>
      {percentage}%
    </span>
  );
};

interface HealthCardProps {
  icon: React.ElementType;
  title: string;
  status: 'healthy' | 'warning' | 'error';
  details: string;
  metrics: Array<{ label: string; value: string }>;
}

const HealthCard: React.FC<HealthCardProps> = ({ icon: Icon, title, status, details, metrics }) => {
  const statusColors = {
    healthy: 'text-success-600 bg-success-50',
    warning: 'text-warning-600 bg-warning-50',
    error: 'text-error-600 bg-error-50',
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center space-x-3 mb-3">
        <Icon className="h-5 w-5 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${statusColors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </div>
      <p className="text-sm text-gray-600 mb-3">{details}</p>
      <div className="space-y-2">
        {metrics.map((metric, index) => (
          <div key={index} className="flex justify-between text-sm">
            <span className="text-gray-500">{metric.label}</span>
            <span className="font-medium text-gray-900">{metric.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardWithCharts;
