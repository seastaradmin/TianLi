/**
 * 极致简洁星空页面
 * 只有星空，其他元素最小化
 */

import { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'

import { DeliverableDrawer, type DeliverableItem } from '../components/starry/DeliverableDrawer'
import { StarScene } from '../components/starry/StarScene'

import type { HeroState } from '../types'

const HEROES: HeroState[] = [
  { heroId: 'product-hero', displayName: 'ProductHero', displayNameZh: '产品专家', status: 'idle', type: 'analysis', tags: [], capabilities: [], tools: [] },
  { heroId: 'code-hero', displayName: 'CodeHero', displayNameZh: '代码专家', status: 'running', type: 'coding', tags: [], capabilities: [], tools: [] },
  { heroId: 'design-hero', displayName: 'DesignHero', displayNameZh: '设计专家', status: 'idle', type: 'design', tags: [], capabilities: [], tools: [] },
  { heroId: 'data-hero', displayName: 'DataHero', displayNameZh: '数据专家', status: 'consulting', type: 'data', tags: [], capabilities: [], tools: [] },
  { heroId: 'writer-hero', displayName: 'WriterHero', displayNameZh: '写作专家', status: 'idle', type: 'writing', tags: [], capabilities: [], tools: [] },
]

const MOCK_DELIVERABLES: DeliverableItem[] = [
  { id: '1', fileName: '产品需求文档.md', fileType: 'md', sizeBytes: 24576, providerHeroId: 'product-hero', providerHeroName: 'ProductHero', createdAt: new Date().toISOString() },
  { id: '2', fileName: '市场分析报告.xlsx', fileType: 'xlsx', sizeBytes: 1228800, providerHeroId: 'data-hero', providerHeroName: 'DataHero', createdAt: new Date().toISOString() },
]

function PureStarrySkyApp() {
  const [inputValue, setInputValue] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
      document.getElementById('loading')?.classList.add('hidden')
    }, 500)
    return () => clearTimeout(timer)
  }, [])
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    setTimeout(() => {
      setDeliverables(MOCK_DELIVERABLES)
      setDrawerOpen(true)
    }, 2000)
    setInputValue('')
  }
  
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 全屏星空 */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <StarScene heroes={HEROES} selectedHeroId={null} onHeroClick={() => {}} />
      </div>
      
      {/* 极简输入框 - 底部 */}
      <form
        onSubmit={handleSubmit}
        style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(500px, 80vw)',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: '999px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
          }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="输入任务..."
            style={{
              flex: 1,
              padding: '12px 20px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            style={{
              padding: '12px 24px',
              backgroundColor: inputValue.trim() ? '#4a90d9' : 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '14px',
              cursor: inputValue.trim() ? 'pointer' : 'default',
            }}
          >
            →
          </button>
        </div>
      </form>
      
      {/* 产物抽屉 */}
      <DeliverableDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} deliverables={MOCK_DELIVERABLES} />
    </div>
  )
}

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<PureStarrySkyApp />)
}
