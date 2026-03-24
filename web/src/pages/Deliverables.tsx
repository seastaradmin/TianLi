import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, Trash2, Calendar, Clock, HardDrive } from 'lucide-react';

interface Deliverable {
  id: string;
  task_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  created_at: string;
  hero_id: string;
}

const Deliverables: React.FC = () => {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pptx' | 'md' | 'other'>('all');

  useEffect(() => {
    fetchDeliverables();
  }, []);

  const fetchDeliverables = async () => {
    try {
      // TODO: 从后端 API 获取
      // const response = await fetch('/api/deliverables');
      // const data = await response.json();
      
      // Mock 数据（稍后替换为真实数据）
      const mockData: Deliverable[] = [
        {
          id: '1',
          task_id: 'ppt-task-001',
          file_name: 'tianli_presentation.pptx',
          file_path: '/generated_ppts/tianli_presentation.pptx',
          file_size: 34212,
          file_type: 'pptx',
          created_at: new Date().toISOString(),
          hero_id: 'ppt-creator-hero'
        }
      ];
      
      setDeliverables(mockData);
    } catch (error) {
      console.error('获取交付物失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pptx':
        return <FileText className="w-5 h-5 text-orange-500" />;
      case 'md':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const filteredDeliverables = filter === 'all' 
    ? deliverables 
    : deliverables.filter(d => d.file_type === filter);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">交付物管理</h1>
        <p className="text-gray-600">查看和管理天理系统生成的所有交付物</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">总交付物</p>
              <p className="text-2xl font-bold text-gray-900">{deliverables.length}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">PPT 文件</p>
              <p className="text-2xl font-bold text-gray-900">
                {deliverables.filter(d => d.file_type === 'pptx').length}
              </p>
            </div>
            <FileText className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">总大小</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatFileSize(deliverables.reduce((sum, d) => sum + d.file_size, 0))}
              </p>
            </div>
            <HardDrive className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">今日生成</p>
              <p className="text-2xl font-bold text-gray-900">
                {deliverables.filter(d => {
                  const today = new Date().toDateString();
                  return new Date(d.created_at).toDateString() === today;
                }).length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">交付物列表</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded text-sm ${
                  filter === 'all' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setFilter('pptx')}
                className={`px-3 py-1 rounded text-sm ${
                  filter === 'pptx' 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                PPT
              </button>
              <button
                onClick={() => setFilter('md')}
                className={`px-3 py-1 rounded text-sm ${
                  filter === 'md' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                文档
              </button>
            </div>
          </div>
        </div>

        {/* 交付物列表 */}
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600">加载中...</p>
            </div>
          ) : filteredDeliverables.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>暂无交付物</p>
            </div>
          ) : (
            filteredDeliverables.map((deliverable) => (
              <div key={deliverable.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex-shrink-0">
                      {getFileIcon(deliverable.file_type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {deliverable.file_name}
                        </p>
                        <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                          {deliverable.file_type.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(deliverable.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(deliverable.created_at).toLocaleTimeString()}
                        </span>
                        <span className="flex items-center">
                          <HardDrive className="w-3 h-3 mr-1" />
                          {formatFileSize(deliverable.file_size)}
                        </span>
                      </div>
                      
                      <p className="text-xs text-gray-400 mt-1">
                        任务 ID: {deliverable.task_id} • Hero: {deliverable.hero_id}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      className="p-2 text-gray-600 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                      title="预览"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    
                    <button
                      className="p-2 text-gray-600 hover:text-green-500 hover:bg-green-50 rounded transition-colors"
                      title="下载"
                      onClick={() => {
                        // TODO: 实现下载
                        alert(`下载：${deliverable.file_name}`);
                      }}
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    
                    <button
                      className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Deliverables;
