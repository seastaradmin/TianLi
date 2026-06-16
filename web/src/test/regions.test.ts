import { describe, expect, it } from 'vitest'

import { buildRegionTelemetry } from '../utils/regions'
import type { HeroState, TaskState } from '../types'

const heroes: HeroState[] = [
  {
    heroId: 'builder/forge',
    displayName: 'Forge',
    description: 'Builds features',
    tags: ['frontend'],
    tools: ['Read'],
    linkedSkills: ['ui-design-review'],
    color: '#f59e0b',
    x: 0.2,
    y: 0.4,
    status: 'running',
    load: 0.7,
    queueDepth: 1,
    currentTaskId: 'task-local',
    currentTaskIds: ['task-local'],
    source: 'local',
  },
  {
    heroId: 'skill/skills.sh/seo-audit',
    displayName: 'SEO Audit',
    description: 'Audits SEO',
    tags: ['seo'],
    tools: ['Read'],
    linkedSkills: ['seo-audit'],
    color: '#60a5fa',
    x: 0.7,
    y: 0.4,
    status: 'recovering',
    load: 0.2,
    queueDepth: 0,
    currentTaskId: null,
    currentTaskIds: [],
    source: 'remote',
  },
]

const tasks: TaskState[] = [
  {
    taskId: 'task-local',
    title: '重做首页星海观测',
    status: 'running',
    pinnedHeroIds: [],
    selectedHeroIds: ['builder/forge'],
    primaryHeroId: 'builder/forge',
    consultHeroIds: [],
    candidateHeroIds: ['builder/forge'],
    maxFanout: 1,
    dispatchMode: 'hybrid',
    collaborationMode: 'primary_consult',
    createdAt: '2026-03-24T03:10:00.000Z',
    updatedAt: '2026-03-24T03:18:00.000Z',
    reasoning: 'Forge handles the local redesign.',
    verdictRound: 0,
    judgmentNote: '',
    verdictStatus: null,
    deliverySummary: '',
    deliveryDetails: [],
    skillDispatches: [],
    completedAt: null,
    history: [],
    verdictHistory: [],
  },
  {
    taskId: 'task-remote',
    title: '校验 SEO skill 路径',
    status: 'accepted',
    pinnedHeroIds: [],
    selectedHeroIds: ['skill/skills.sh/seo-audit'],
    primaryHeroId: 'skill/skills.sh/seo-audit',
    consultHeroIds: [],
    candidateHeroIds: ['skill/skills.sh/seo-audit'],
    maxFanout: 1,
    dispatchMode: 'hybrid',
    collaborationMode: 'primary_consult',
    createdAt: '2026-03-24T03:09:00.000Z',
    updatedAt: '2026-03-24T03:20:00.000Z',
    reasoning: 'Remote skill validates the path.',
    verdictRound: 0,
    judgmentNote: '',
    verdictStatus: 'approved',
    deliverySummary: 'SEO Audit 完成了校验。',
    deliveryDetails: [
      {
        heroId: 'skill/skills.sh/seo-audit',
        role: 'primary',
        status: 'early_exit',
        summary: '命中天劫，并提交了天演补丁。',
        evolutionPatch: 'Refine prompt guardrail',
        skillDispatches: [],
      },
    ],
    skillDispatches: [],
    completedAt: '2026-03-24T03:20:00.000Z',
    history: [],
    verdictHistory: [],
  },
]

describe('buildRegionTelemetry', () => {
  it('builds local and remote region feedback with governance counts', () => {
    const regions = buildRegionTelemetry(heroes, tasks)
    const local = regions.find((region) => region.owner === 'local')
    const remote = regions.find((region) => region.owner === 'skills.sh')

    expect(local).toMatchObject({
      labelZh: '天理主星域',
      totalHeroes: 1,
      activeTaskCount: 1,
      busyHeroCount: 1,
      earlyExitCount: 0,
      latestTaskId: 'task-local',
    })

    expect(remote).toMatchObject({
      labelZh: 'Skills.sh 星域',
      totalHeroes: 1,
      activeTaskCount: 0,
      busyHeroCount: 1,
      earlyExitCount: 1,
      recoveringHeroCount: 1,
      latestTaskId: 'task-remote',
    })
  })
})
