// components/FlowDiagram.tsx
import React from 'react'

interface Step {
  num: number
  label: string
  desc: string
  highlight?: boolean
  icon?: string
}

const defaultSteps: Step[] = [
  { num: 1, label: 'Fetch DNA', desc: '获取 Hero Prompt', icon: '🧬' },
  { num: 2, label: 'Agent Reason', desc: 'LLM 推理', icon: '🧠' },
  { num: 3, label: 'TianJie Audit', desc: '天劫审查', highlight: true, icon: '⚖️' },
  { num: 4, label: 'Execute', desc: '执行工具', icon: '⚡' },
]

interface FlowDiagramProps {
  steps?: Step[]
  currentStep?: number
}

export function FlowDiagram({ steps = defaultSteps, currentStep }: FlowDiagramProps) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h2 className="font-bold mb-3 flex items-center gap-2 text-lg">
        <span>🏗️</span> 架构流程
      </h2>
      
      <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
        {steps.map((step, index) => (
          <React.Fragment key={step.num}>
            <StepBadge
              num={step.num}
              label={step.label}
              desc={step.desc}
              highlight={step.highlight}
              icon={step.icon}
              active={currentStep === step.num}
            />
            {index < steps.length - 1 && <Arrow active={currentStep === step.num + 1} />}
          </React.Fragment>
        ))}
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>L1: 禁止词 / 空参数 / 重复检测</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            <span>L2: 深度语义检查（30% 采样）</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface StepBadgeProps {
  num: number
  label: string
  desc: string
  highlight?: boolean
  icon?: string
  active?: boolean
}

function StepBadge({ num, label, desc, highlight = false, icon, active = false }: StepBadgeProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
        active
          ? 'bg-blue-600 border border-blue-400 scale-105'
          : highlight
          ? 'bg-blue-900/30 border border-blue-700'
          : 'bg-gray-900 border border-gray-700'
      }`}
    >
      <span
        className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
          active
            ? 'bg-white text-blue-600'
            : highlight
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300'
        }`}
      >
        {num}
      </span>
      <div>
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-sm">{icon}</span>}
          <span className={`font-medium ${active ? 'text-white' : ''}`}>{label}</span>
        </div>
        <div className="text-gray-500 text-xs">{desc}</div>
      </div>
    </div>
  )
}

function Arrow({ active = false }: { active?: boolean }) {
  return (
    <span className={`text-lg ${active ? 'text-blue-400' : 'text-gray-600'}`}>
      →
    </span>
  )
}
