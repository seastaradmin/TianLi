/**
 * 星空首页 - MVP
 * 
 * 功能：
 * - NASA 真实星空背景
 * - Hero 星球展示
 * - 中央对话框
 * - 产物抽屉
 */

import { useState } from 'react'

import { DeliverableDrawer, type DeliverableItem } from './DeliverableDrawer'
import { StarScene } from './StarScene'

import type { HeroState } from '../types'

// Mock 数据 - 后续替换为真实 API
const MOCK_HEROES: HeroState[] = [
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
]

export function StarryHomePage() {
  const [inputValue, setInputValue] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([])
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null)
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    
    console.log('提交任务:', inputValue)
    // TODO: 调用后端 API 提交任务
    
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
        backgroundColor: '#050510',
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
          heroes={MOCK_HEROES}
          selectedHeroId={selectedHeroId}
          onHeroClick={handleHeroClick}
        />
      </div>
      
      {/* 中央对话框 */}
      <div
        style={{
          position: 'absolute',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(600px, 90vw)',
          zIndex: 10,
        }}
      >
        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: 'flex',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="告诉我你想做什么..."
              style={{
                flex: 1,
                padding: '16px 20px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '16px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              style={{
                padding: '16px 24px',
                backgroundColor: inputValue.trim() ? '#4a90d9' : 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#ffffff',
                fontWeight: '600',
                cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s',
              }}
            >
              发送
            </button>
          </div>
        </form>
        
        {/* 底部状态栏 */}
        <div
          style={{
            marginTop: '12px',
            textAlign: 'center',
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          {MOCK_HEROES.length} 个 Hero 在线 |{' '}
          {MOCK_HEROES.filter((h) => h.status !== 'idle').length} 个任务进行中
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
