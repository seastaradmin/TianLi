import React, { useState, useEffect } from 'react';
import { MessageSquare, User, Bot, Clock, Search, Filter, Download } from 'lucide-react';

interface Message {
  id: string;
  task_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  hero_id?: string;
  status?: string;
}

interface Conversation {
  task_id: string;
  messages: Message[];
  started_at: string;
  last_message_at: string;
  hero_id?: string;
  status?: string;
}

const ConversationHistory: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'running' | 'failed'>('all');

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      // TODO: 从后端 API 获取
      // const response = await fetch('http://localhost:8000/api/conversations');
      // const data = await response.json();
      
      // Mock 数据
      const mockConversations: Conversation[] = [
        {
          task_id: 'ppt-task-001',
          started_at: new Date(Date.now() - 3600000).toISOString(),
          last_message_at: new Date().toISOString(),
          hero_id: 'ppt-creator-hero',
          status: 'completed',
          messages: [
            {
              id: '1',
              task_id: 'ppt-task-001',
              role: 'user',
              content: '生成产品宣讲 PPT',
              timestamp: new Date(Date.now() - 3600000).toISOString()
            },
            {
              id: '2',
              task_id: 'ppt-task-001',
              role: 'assistant',
              content: '好的，我正在为您生成产品宣讲 PPT。我将使用 ppt-creator-hero 来创建包含 7 页的演示文稿。',
              timestamp: new Date(Date.now() - 3599000).toISOString(),
              hero_id: 'ppt-creator-hero'
            },
            {
              id: '3',
              task_id: 'ppt-task-001',
              role: 'assistant',
              content: '✅ PPT 生成完成！\n\n已生成 7 页幻灯片：\n1. 封面 - TianLi Harness\n2. 问题 - 现有 AI 工具的痛点\n3. 解决方案 - 天理的核心特性\n4. 产品特性\n5. E2E 测试结果\n6. 行动计划\n7. Q&A\n\n文件大小：33KB\n保存位置：generated_ppts/tianli_presentation.pptx',
              timestamp: new Date(Date.now() - 3594000).toISOString(),
              hero_id: 'ppt-creator-hero',
              status: 'completed'
            }
          ]
        },
        {
          task_id: 'code-task-001',
          started_at: new Date(Date.now() - 7200000).toISOString(),
          last_message_at: new Date(Date.now() - 1800000).toISOString(),
          hero_id: 'engineering-hero',
          status: 'running',
          messages: [
            {
              id: '1',
              task_id: 'code-task-001',
              role: 'user',
              content: '实现用户登录功能',
              timestamp: new Date(Date.now() - 7200000).toISOString()
            },
            {
              id: '2',
              task_id: 'code-task-001',
              role: 'assistant',
              content: '好的，我将为您实现用户登录功能。包括：\n1. 登录表单组件\n2. 身份验证逻辑\n3. Token 管理\n4. 错误处理',
              timestamp: new Date(Date.now() - 7199000).toISOString(),
              hero_id: 'engineering-hero'
            }
          ]
        }
      ];
      
      setConversations(mockConversations);
    } catch (error) {
      console.error('获取对话历史失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const statusMatch = filterStatus === 'all' || conv.status === filterStatus;
    const searchMatch = searchTerm === '' || 
      conv.task_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.messages.some(m => m.content.toLowerCase().includes(searchTerm.toLowerCase()));
    return statusMatch && searchMatch;
  });

  const exportConversation = (conv: Conversation) => {
    const text = conv.messages.map(m => 
      `[${new Date(m.timestamp).toLocaleString()}] ${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`
    ).join('\n\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conv.task_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
    <div className="p-6 h-screen flex">
      {/* 左侧：对话列表 */}
      <div className="w-80 border-r border-gray-200 pr-4 flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">对话历史</h1>
          <p className="text-gray-600 text-sm">查看和管理所有对话记录</p>
        </div>

        {/* 搜索和筛选 */}
        <div className="mb-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索对话..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="w-full border border-gray-300 rounded text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">全部状态</option>
            <option value="completed">已完成</option>
            <option value="running">进行中</option>
            <option value="failed">已失败</option>
          </select>
        </div>

        {/* 对话列表 */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600">加载中...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>暂无对话</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.task_id}
                onClick={() => setSelectedConversation(conv.task_id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedConversation === conv.task_id
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-white border-2 border-transparent hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {conv.task_id}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(conv.status || '')}`}>
                    {conv.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  <div className="flex items-center mb-1">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(conv.last_message_at).toLocaleString()}
                  </div>
                  <div>Hero: {conv.hero_id || 'N/A'}</div>
                  <div>消息数：{conv.messages.length}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右侧：对话详情 */}
      <div className="flex-1 pl-4 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {conversations.find(c => c.task_id === selectedConversation)?.task_id}
                </h2>
                <p className="text-sm text-gray-600">
                  {new Date(conversations.find(c => c.task_id === selectedConversation)?.started_at || '').toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => exportConversation(conversations.find(c => c.task_id === selectedConversation)!)}
                className="flex items-center px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                导出对话
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4 space-y-4">
              {conversations
                .find(c => c.task_id === selectedConversation)
                ?.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start space-x-3 ${
                      message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-green-500 text-white'
                    }`}>
                      {message.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    
                    <div className={`flex-1 ${
                      message.role === 'user' ? 'text-right' : ''
                    }`}>
                      <div className={`inline-block p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-900 shadow'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                      
                      <div className={`mt-1 text-xs text-gray-500 ${
                        message.role === 'user' ? 'text-right' : ''
                      }`}>
                        <span>{new Date(message.timestamp).toLocaleString()}</span>
                        {message.hero_id && (
                          <span className="ml-2">• Hero: {message.hero_id}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg">选择左侧的对话查看详情</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationHistory;
