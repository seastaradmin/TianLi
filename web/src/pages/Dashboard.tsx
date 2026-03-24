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
  Cpu
} from 'lucide-react';

interface MetricsData {
  totalSessions: number;
  totalRequests: number;
  l1PassRate: number;
  l2PassRate: number;
  earlyExitRate: number;
  avgLatencyMs: number;
  totalViolations: number;
  evolutionPatches: number;
}

interface SessionData {
  session_id: string;
  start_time: string;
  duration_seconds: number;
  total_requests: number;
  l1_pass_rate: number;
  l2_pass_rate: number;
  early_exits: number;
  status: 'completed' | 'running' | 'early_exit';
}

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  // Mock data - will be replaced with real API calls
  useEffect(() => {
    const fetchMetrics = async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setMetrics({
        totalSessions: 156,
        totalRequests: 2847,
        l1PassRate: 0.892,
        l2PassRate: 0.967,
        earlyExitRate: 0.043,
        avgLatencyMs: 234,
        totalViolations: 23,
        evolutionPatches: 12,
      });
      
      setSessions([
        {
          session_id: 'session-001',
          start_time: new Date().toISOString(),
          duration_seconds: 45.2,
          total_requests: 10,
          l1_pass_rate: 0.9,
          l2_pass_rate: 1.0,
          early_exits: 1,
          status: 'completed',
        },
        {
          session_id: 'session-002',
          start_time: new Date().toISOString(),
          duration_seconds: 32.8,
          total_requests: 8,
          l1_pass_rate: 1.0,
          l2_pass_rate: 1.0,
          early_exits: 0,
          status: 'completed',
        },
        {
          session_id: 'session-003',
          start_time: new Date().toISOString(),
          duration_seconds: 67.5,
          total_requests: 15,
          l1_pass_rate: 0.8,
          l2_pass_rate: 0.9,
          early_exits: 2,
          status: 'early_exit',
        },
      ]);
      
      setLoading(false);
    };
    
    fetchMetrics();
  }, []);

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
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value as '24h' | '7d' | '30d')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
              
              <button className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium">
                Export Report
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
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500 text-sm">Chart placeholder - integrate Recharts/Chart.js</p>
            </div>
          </ChartCard>
          
          <ChartCard
            title="Audit Pass Rates"
            description="L1 vs L2 pass rates comparison"
            icon={TrendingUp}
          >
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500 text-sm">Chart placeholder - integrate Recharts/Chart.js</p>
            </div>
          </ChartCard>
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
              status="healthy"
              details="All platforms operational"
              metrics={[
                { label: 'OpenClaw', value: '✓ Active' },
                { label: 'Local', value: '✓ Active' },
                { label: 'Cursor', value: '○ Offline' },
              ]}
            />
            
            <HealthCard
              icon={Cpu}
              title="Resource Usage"
              status="healthy"
              details="Within normal limits"
              metrics={[
                { label: 'CPU', value: '23%' },
                { label: 'Memory', value: '1.2GB' },
                { label: 'Disk', value: '45%' },
              ]}
            />
            
            <HealthCard
              icon={Shield}
              title="Audit Engine"
              status="healthy"
              details="Rules up to date"
              metrics={[
                { label: 'Active Rules', value: '15' },
                { label: 'L2 Sample Rate', value: '30%' },
                { label: 'Last Update', value: '2h ago' },
              ]}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

// Sub-components

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

export default Dashboard;
