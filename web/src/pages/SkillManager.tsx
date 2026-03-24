import React, { useState, useEffect } from 'react';
import { Puzzle, Download, Trash2, Search, Filter, ExternalLink, Package } from 'lucide-react';

interface Skill {
  name: string;
  description: string;
  installed: boolean;
  installs?: number;
  source?: string;
  category?: string;
}

const SkillManager: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'installed' | 'available'>('all');

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      // TODO: 从后端 API 获取
      // const response = await fetch('http://localhost:8000/api/skills');
      // const data = await response.json();
      
      // Mock 数据 - 已安装的 skills
      const mockSkills: Skill[] = [
        {
          name: 'pptx',
          description: '创建和编辑 PowerPoint 演示文稿',
          installed: true,
          installs: 44000,
          source: 'anthropics/skills',
          category: '文档'
        },
        {
          name: 'find-skills',
          description: '搜索和安装 ClawHub 技能',
          installed: true,
          installs: 15000,
          source: 'vercel-labs/agent-skills',
          category: '工具'
        },
        {
          name: 'database-design',
          description: '数据库设计和最佳实践',
          installed: true,
          installs: 173,
          source: 'skillcreatorai/ai-agent-skills',
          category: '开发'
        },
        {
          name: 'mysql-best-practices',
          description: 'MySQL 最佳实践指南',
          installed: true,
          installs: 890,
          source: 'mindrally/skills',
          category: '开发'
        },
        {
          name: 'ui-ux-pro-max-skill',
          description: '专业 UI/UX 设计（161 条推理规则，67 种 UI 样式）',
          installed: true,
          installs: 49000,
          source: 'nextlevelbuilder/ui-ux-pro-max-skill',
          category: '设计'
        },
        {
          name: 'e2e-testing-patterns',
          description: '端到端测试模式和最佳实践',
          installed: true,
          installs: 8200,
          source: 'wshobson/agents',
          category: '测试'
        },
        {
          name: 'web-search-pro',
          description: '专业网页搜索和研究',
          installed: false,
          installs: 5600,
          source: 'Zjianru/web-search-pro',
          category: '研究'
        },
        {
          name: 'code-review',
          description: '代码审查和最佳实践',
          installed: false,
          installs: 960,
          source: 'skillcreatorai/ai-agent-skills',
          category: '开发'
        }
      ];
      
      setSkills(mockSkills);
    } catch (error) {
      console.error('获取技能列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const installSkill = async (skillName: string) => {
    try {
      // TODO: 调用后端 API 安装技能
      // await fetch(`http://localhost:8000/api/skills/${skillName}/install`, { method: 'POST' });
      
      alert(`正在安装技能：${skillName}\n\n命令：npx skills add ${skillName} -g -y`);
      
      // 更新状态
      setSkills(skills.map(s => 
        s.name === skillName ? { ...s, installed: true } : s
      ));
    } catch (error) {
      console.error('安装技能失败:', error);
      alert('安装失败：' + error);
    }
  };

  const uninstallSkill = async (skillName: string) => {
    try {
      if (!confirm(`确定要卸载技能 "${skillName}" 吗？`)) {
        return;
      }
      
      // TODO: 调用后端 API 卸载技能
      // await fetch(`http://localhost:8000/api/skills/${skillName}/uninstall`, { method: 'POST' });
      
      alert(`正在卸载技能：${skillName}`);
      
      // 更新状态
      setSkills(skills.map(s => 
        s.name === skillName ? { ...s, installed: false } : s
      ));
    } catch (error) {
      console.error('卸载技能失败:', error);
      alert('卸载失败：' + error);
    }
  };

  const filteredSkills = skills.filter(skill => {
    const categoryMatch = 
      filterCategory === 'all' ||
      (filterCategory === 'installed' && skill.installed) ||
      (filterCategory === 'available' && !skill.installed);
    
    const searchMatch = searchTerm === '' || 
      skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return categoryMatch && searchMatch;
  });

  const stats = {
    total: skills.length,
    installed: skills.filter(s => s.installed).length,
    available: skills.filter(s => !skill.installed).length,
    totalInstalls: skills.reduce((sum, s) => sum + (s.installs || 0), 0)
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">技能管理</h1>
        <p className="text-gray-600">管理天理系统的技能库</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">总技能数</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Puzzle className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">已安装</p>
              <p className="text-2xl font-bold text-green-600">{stats.installed}</p>
            </div>
            <Download className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">可安装</p>
              <p className="text-2xl font-bold text-blue-600">{stats.available}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">总安装量</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalInstalls.toLocaleString()}</p>
            </div>
            <ExternalLink className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索技能..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as any)}
                className="border border-gray-300 rounded text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">全部技能</option>
                <option value="installed">已安装</option>
                <option value="available">可安装</option>
              </select>
            </div>
          </div>
        </div>

        {/* 技能列表 */}
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600">加载中...</p>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Puzzle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>暂无技能</p>
            </div>
          ) : (
            filteredSkills.map((skill) => (
              <div key={skill.name} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{skill.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        skill.installed
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {skill.installed ? '已安装' : '可安装'}
                      </span>
                      {skill.category && (
                        <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                          {skill.category}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">{skill.description}</p>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <Download className="w-3 h-3 mr-1" />
                        {skill.installs?.toLocaleString()} 次安装
                      </span>
                      {skill.source && (
                        <span className="flex items-center">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          {skill.source}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {skill.installed ? (
                      <button
                        onClick={() => uninstallSkill(skill.name)}
                        className="flex items-center px-3 py-2 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        卸载
                      </button>
                    ) : (
                      <button
                        onClick={() => installSkill(skill.name)}
                        className="flex items-center px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        安装
                      </button>
                    )}
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

export default SkillManager;
