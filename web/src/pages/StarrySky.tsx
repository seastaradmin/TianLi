/**
 * 独立星空页面 - 纯净版
 * 移除所有管理界面元素，只保留星空 + 对话框 + 产物抽屉
 */

import { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'

import { DeliverableDrawer, type DeliverableItem } from '../components/starry/DeliverableDrawer'
import { StarScene } from '../components/starry/StarScene'

import type { HeroState } from '../types'

// Mock Hero 数据
const HEROES: HeroState[] = [
  {
    heroId: 'product-hero',
    displayName: 'ProductHero',
    displayNameZh: '产品专家',
    status: 'idle',
    type: 'analysis',
    tags: ['product', 'prd', 'strategy'],
    capabilities: ['product_design', 'market_analysis'],
    tools: ['write', 'research'],
  },
  {
    heroId: 'code-hero',
    displayName: 'CodeHero',
    displayNameZh: '代码专家',
    status: 'running',
    type: 'coding',
    tags: ['code', 'bug', 'feature'],
    capabilities: ['coding', 'debugging', 'review'],
    tools: ['read', 'edit', 'bash'],
  },
  {
    heroId: 'design-hero',
    displayName: 'DesignHero',
    displayNameZh: '设计专家',
    status: 'idle',
    type: 'design',
    tags: ['ui', 'ux', 'design'],
    capabilities: ['ui_design', 'figma'],
    tools: ['write', 'research'],
  },
  {
    heroId: 'data-hero',
    displayName: 'DataHero',
    displayNameZh: '数据专家',
    status: 'consulting',
    type: 'data',
    tags: ['data', 'analysis', 'chart'],
    capabilities: ['data_analysis', 'visualization'],
    tools: ['read', 'bash'],
  },
  {
    heroId: 'writer-hero',
    displayName: 'WriterHero',
    displayNameZh: '写作专家',
    status: 'idle',
    type: 'writing',
    tags: ['writing', 'content', 'copy'],
    capabilities: ['creative_writing', 'technical_writing'],
    tools: ['write'],
  },
  {
    heroId: 'ml-hero',
    displayName: 'MLHero',
    displayNameZh: 'AI 专家',
    status: 'idle',
    type: 'coding',
    tags: ['ml', 'ai', 'model'],
    capabilities: ['machine_learning', 'deep_learning'],
    tools: ['bash', 'write'],
  },
]

// Mock 产物数据
const MOCK_DELIVERABLES: DeliverableItem[] = [
  {
    id: 'prd-v1',
    fileName: '产品需求文档_v1.md',
    fileType: 'md',
    sizeBytes: 24576,
    providerHeroId: 'product-hero',
    providerHeroName: 'ProductHero',
    downloadUrl: '/api/deliverables/download?path=prd_v1.md',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'analysis-v1',
    fileName: '市场分析报告.xlsx',
    fileType: 'xlsx',
    sizeBytes: 1228800,
    providerHeroId: 'data-hero',
    providerHeroName: 'DataHero',
    downloadUrl: '/api/deliverables/download?path=analysis_v1.xlsx',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'code-v1',
    fileName: 'main.py',
    fileType: 'py',
    sizeBytes: 8192,
    providerHeroId: 'code-hero',
    providerHeroName: 'CodeHero',
    downloadUrl: '/api/deliverables/download?path=main.py',
    createdAt: new Date().toISOString(),
  },
]

function StarrySkyApp() {
  const [inputValue, setInputValue] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([])
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // 隐藏加载动画
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
      document.getElementById('loading')?.classList.add('hidden')
    }, 1000)
    return () => clearTimeout(timer)
  }, [])
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    
    console.log('提交任务:', inputValue)
    
    // MVP 演示：3 秒后显示产物
    setTimeout(() => {
      setDeliverables(MOCK_DELIVERABLES)
      setDrawerOpen(true)
    }, 3000)
    
    setInputValue('')
  }
  
  const handleHeroClick = (heroId: string) => {
    setSelectedHeroId(heroId === selectedHeroId ? null : heroId)
  }
  
  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#000010',
      }}
    >
      {/* 星空场景 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
        }}
      >
        <StarScene
          heroes={HEROES}
          selectedHeroId={selectedHeroId}
          onHeroClick={handleHeroClick}
        />
      </div>
      
      {/* 中央对话框 */}
      <div
        style={{
          position: 'absolute',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(700px, 90vw)',
          zIndex: 10,
        }}
      >
        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              overflow: 'hidden',
              boxShadow: '0 8px 64px rgba(0, 0, 0, 0.5), 0 0 40px rgba(74, 144, 217, 0.1)',
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="告诉我你想做什么..."
              style={{
                flex: 1,
                padding: '20px 24px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '18px',
                outline: 'none',
                fontWeight: '300',
              }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              style={{
                padding: '20px 32px',
                backgroundColor: inputValue.trim() ? 'rgba(74, 144, 217, 0.9)' : 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#ffffff',
                fontWeight: '500',
                fontSize: '16px',
                cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              发送
            </button>
          </div>
        </form>
        
        {/* 底部状态栏 */}
        <div
          style={{
            marginTop: '16px',
            textAlign: 'center',
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.4)',
            fontWeight: '300',
            letterSpacing: '0.5px',
          }}
        >
          {HEROES.length} 个 Hero 在线 |{' '}
          <span style={{ color: 'rgba(80, 227, 194, 0.8)' }}>
            {HEROES.filter((h) => h.status !== 'idle').length} 个任务进行中
          </span>
        </div>
      </div>
      
      {/* 产物抽屉 */}
      <DeliverableDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        deliverables={deliverables}
        taskTitle="演示任务"
      />
    </div>
  )
}

// 挂载应用
const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<StarrySkyApp />)
}
