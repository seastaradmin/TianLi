import React, { useState, useEffect } from 'react';
import { Users, Activity, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface SubAgent {
  id: string;
  name: string;
  hero_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  started_at?: string;
  completed_at?: string;
  result?: string;
  error?: string;
}

interface TaskExecution {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  overall_progress: number;
  sub_agents: SubAgent[];
  started_at: string;
  completed_at?: string;
}

const SubAgentsVisualization: React.FC = () => {
  const [tasks, setTasks] = useState<TaskExecution[]>([]);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
    
    // 每 5 秒刷新一次
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = async () => {
    try {
      // TODO: 从后端 API 获取
      // const response = await fetch('http://localhost:8000/api/tasks/active');
      // const data = await response.json();
      
      // Mock 数据
      const mockTasks: TaskExecution[] = [
        {
          task_id: 'ppt-task-001',
          status: 'completed',
          overall_progress: 100,
          started_at: new Date(Date.now() - 3600000).toISOString(),
          completed_at: new Date(Date.now() - 3594000).toISOString(),
          sub_agents: [
            {
              id: '1',
              name: 'PM Hero',
              hero_id: 'pm-hero',
              status: 'completed',
              progress: 100,
              started_at: new Date(Date.now() - 3600000).toISOString(),
              completed_at: new Date(Date.now() - 3598000).toISOString(),
              result: '生成 PPT 大纲'
            },
            {
              id: '2',
              name: 'UI-UX Hero',
              hero_id: 'ui-ux-hero',
              status: 'completed',
              progress: 100,
              started_at: new Date(Date.now() - 3598000).toISOString(),
              completed_at: new Date(Date.now() - 3596000).toISOString(),
              result: '设计 PPT 模板'
            },
            {
              id: '3',
              name: 'PPT Creator',
              hero_id: 'ppt-creator-hero',
              status: 'completed',
              progress: 100,
              started_at: new Date(Date.now() - 3596000).toISOString(),
              completed_at: new Date(Date.now() - 3594000).toISOString(),
              result: '生成 tianli_presentation.pptx (33KB)'
            }
          ]
        },
        {
          task_id: 'code-task-001',
          status: 'running',
          overall_progress: 60,
          started_at: new Date(Date.now() - 1800000).toISOString(),
          sub_agents: [
            {
              id: '1',
              name: 'Backend Hero',
              hero_id: 'backend-hero',
              status: 'completed',
              progress: 100,
              started_at: new Date(Date.now() - 1800000).toISOString(),
              completed_at: new Date(Date.now() - 1740000).toISOString(),
              result: '实现 API 端点'
            },
            {
              id: '2',
              name: 'Frontend Hero',
              hero_id: 'frontend-hero',
              status: 'running',
              progress: 60,
              started_at: new Date(Date.now() - 1740000).toISOString()
            },
            {
              id: '3',
              name: 'QA Hero',
              hero_id: 'qa-hero',
              status: 'pending',
              progress: 0
            }
          ]
        }
      ];
      
      setTasks(mockTasks);
    } catch (error) {
      console.error('获取任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'running':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'running':
        return 'bg-blue-100 text-blue-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sub-agents 可视化</h1>
        <p className="text-gray-600">查看并行执行的 Heroes 状态和进度</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">活跃任务</p>
              <p className="text-2xl font-bold text-gray-900">
                {tasks.filter(t => t.status === 'running').length}
              </p>
            </div>
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sub-agents</p>
              <p className="text-2xl font-bold text-gray-900">
                {tasks.reduce((sum, t) => sum + t.sub_agents.length, 0)}
              </p>
            </div>
            <Users className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">已完成</p>
              <p className="text-2xl font-bold text-green-600">
                {tasks.filter(t => t.status === 'completed').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">运行中</p>
              <p className="text-2xl font-bold text-blue-600">
                {tasks.reduce((sum, t) => 
                  sum + t.sub_agents.filter(a => a.status === 'running').length, 0
                )}
              </p>
            </div>
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>暂无活跃任务</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.task_id} className="bg-white rounded-lg shadow">
              <div
                className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setSelectedTask(selectedTask === task.task_id ? null : task.task_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(task.status)}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{task.task_id}</h3>
                      <p className="text-sm text-gray-600">
                        开始于 {new Date(task.started_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {task.overall_progress}%
                      </div>
                      <div className="w-32 h-2 bg-gray-200 rounded-full mt-1">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            task.status === 'completed' ? 'bg-green-500' :
                            task.status === 'failed' ? 'bg-red-500' :
                            'bg-blue-500'
                          }`}
                          style={{ width: `${task.overall_progress}%` }}
                        />
                      </div>
                    </div>
                    
                    <span className={`px-3 py-1 text-sm rounded ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sub-agents 详情 */}
              {(selectedTask === task.task_id || task.status === 'running') && (
                <div className="p-4 space-y-3">
                  <h4 className="font-semibold text-gray-900 mb-2">Sub-agents ({task.sub_agents.length})</h4>
                  
                  {task.sub_agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        {getStatusIcon(agent.status)}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{agent.name}</span>
                            <span className="text-xs text-gray-500">({agent.hero_id})</span>
                            <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(agent.status)}`}>
                              {agent.status}
                            </span>
                          </div>
                          
                          {agent.result && (
                            <p className="text-sm text-gray-600 mt-1">{agent.result}</p>
                          )}
                          {agent.error && (
                            <p className="text-sm text-red-600 mt-1">{agent.error}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">{agent.progress}%</div>
                        <div className="w-24 h-2 bg-gray-200 rounded-full mt-1">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              agent.status === 'completed' ? 'bg-green-500' :
                              agent.status === 'failed' ? 'bg-red-500' :
                              'bg-blue-500'
                            }`}
                            style={{ width: `${agent.progress}%` }}
                          />
                        </div>
                        
                        {agent.started_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(agent.started_at).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SubAgentsVisualization;
