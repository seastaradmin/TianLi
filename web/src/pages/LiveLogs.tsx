import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Play, Pause, Trash2, Download, Search, Filter } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  task_id?: string;
  hero_id?: string;
  stage?: string;
}

const LiveLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'warning' | 'error' | 'success'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 模拟实时日志（稍后替换为 WebSocket 或 SSE）
    const mockLogs: LogEntry[] = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        level: 'info',
        message: '任务开始：生成产品宣讲 PPT',
        task_id: 'ppt-task-001',
        hero_id: 'ppt-creator-hero',
        stage: 'init'
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 1000).toISOString(),
        level: 'success',
        message: 'Hero 选择完成：ppt-creator-hero (分数：8.15)',
        task_id: 'ppt-task-001',
        hero_id: 'ppt-creator-hero',
        stage: 'dispatch'
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 2000).toISOString(),
        level: 'info',
        message: '调用 LLM (Doubao-Seed-2.0-Code)',
        task_id: 'ppt-task-001',
        stage: 'llm'
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 3000).toISOString(),
        level: 'success',
        message: 'L1 审计通过 (无违规)',
        task_id: 'ppt-task-001',
        stage: 'audit_l1'
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 4000).toISOString(),
        level: 'success',
        message: 'L2 审计通过 (分数：0.92)',
        task_id: 'ppt-task-001',
        stage: 'audit_l2'
      },
      {
        id: '6',
        timestamp: new Date(Date.now() - 5000).toISOString(),
        level: 'info',
        message: '生成 PPT 文件：tianli_presentation.pptx',
        task_id: 'ppt-task-001',
        stage: 'generation'
      },
      {
        id: '7',
        timestamp: new Date(Date.now() - 6000).toISOString(),
        level: 'success',
        message: '任务完成 (耗时：1.18s)',
        task_id: 'ppt-task-001',
        stage: 'complete'
      }
    ];

    setLogs(mockLogs);
  }, []);

  useEffect(() => {
    if (autoScroll && !isPaused) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isPaused]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info':
        return 'text-blue-600 bg-blue-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'success':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const filteredLogs = logs.filter(log => {
    const levelMatch = filterLevel === 'all' || log.level === filterLevel;
    const searchMatch = searchTerm === '' || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.task_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.hero_id?.toLowerCase().includes(searchTerm.toLowerCase());
    return levelMatch && searchMatch;
  });

  const exportLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${new Date(log.timestamp).toLocaleTimeString()}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tianli-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    if (confirm('确定要清空所有日志吗？')) {
      setLogs([]);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">实时日志</h1>
        <p className="text-gray-600">查看天理系统任务执行的实时日志流</p>
      </div>

      {/* 控制栏 */}
      <div className="bg-white rounded-lg shadow mb-4">
        <div className="p-4 flex items-center justify-between flex-wrap gap-4">
          {/* 左侧控制 */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors ${
                isPaused 
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
              {isPaused ? '继续' : '暂停'}
            </button>
            
            <button
              onClick={clearLogs}
              className="flex items-center px-3 py-2 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              清空
            </button>
            
            <button
              onClick={exportLogs}
              className="flex items-center px-3 py-2 rounded text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              导出
            </button>
          </div>

          {/* 搜索框 */}
          <div className="flex items-center space-x-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索日志..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 筛选器 */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as any)}
              className="border border-gray-300 rounded text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部级别</option>
              <option value="info">信息</option>
              <option value="success">成功</option>
              <option value="warning">警告</option>
              <option value="error">错误</option>
            </select>
            
            <label className="flex items-center space-x-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <span>自动滚动</span>
            </label>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
          <span>共 {filteredLogs.length} 条日志 {filterLevel !== 'all' && `(筛选：${filterLevel})`}</span>
          <span>{isPaused ? '⏸️ 已暂停' : '🔴 实时'}</span>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 bg-gray-900 text-white flex items-center">
          <Terminal className="w-5 h-5 mr-2" />
          <span className="font-mono text-sm">实时日志流</span>
        </div>
        
        <div className="h-96 overflow-y-auto font-mono text-sm bg-gray-50">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Terminal className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>暂无日志</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`px-4 py-2 border-b border-gray-200 hover:bg-white transition-colors ${getLevelColor(log.level)}`}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  
                  <span className="text-xs font-bold uppercase w-16">
                    [{log.level}]
                  </span>
                  
                  <span className="flex-1 break-all">{log.message}</span>
                  
                  {log.task_id && (
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {log.task_id}
                    </span>
                  )}
                </div>
                
                {(log.hero_id || log.stage) && (
                  <div className="ml-32 mt-1 text-xs text-gray-500">
                    {log.hero_id && <span>Hero: {log.hero_id}</span>}
                    {log.hero_id && log.stage && <span> • </span>}
                    {log.stage && <span>阶段：{log.stage}</span>}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

export default LiveLogs;
