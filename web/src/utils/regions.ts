import type { HeroState, TaskState } from '../types'

const ACTIVE_TASK_STATUSES = new Set(['issued', 'routing', 'consulting', 'running', 'synthesizing', 'judgment_pending'])

export interface RegionTelemetry {
  id: string
  owner: string
  labelZh: string
  labelEn: string
  heroIds: string[]
  representativeHeroId: string
  totalHeroes: number
  taskCount: number
  activeTaskCount: number
  busyHeroCount: number
  earlyExitCount: number
  recoveringHeroCount: number
  latestTaskId: string | null
  latestTaskTitle: string | null
  latestTaskStatus: string | null
}

function titleCaseSegment(segment: string) {
  if (!segment) {
    return segment
  }
  return segment.charAt(0).toUpperCase() + segment.slice(1)
}

function humanizeOwner(owner: string) {
  return owner
    .split(/[-_]/g)
    .filter(Boolean)
    .map(titleCaseSegment)
    .join(' ')
}

export function ownerToRegionLabels(owner: string) {
  if (owner === 'local') {
    return {
      zh: '天理主星域',
      en: 'TianLi Core',
    }
  }

  const base = humanizeOwner(owner)
  return {
    zh: `${base} 星域`,
    en: `${base} Reach`,
  }
}

export function getHeroOwner(heroId: string) {
  const parts = heroId.split('/')
  if (parts[0] !== 'skill') {
    return null
  }
  return parts[1] || 'skills'
}

function resolveRegionId(owner: string) {
  return owner === 'local' ? 'constellation-local' : `constellation-${owner}`
}

function sortTasksByLatest(left: TaskState, right: TaskState) {
  return right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt)
}

export function buildRegionTelemetry(heroes: HeroState[], tasks: TaskState[]) {
  const groups = new Map<string, HeroState[]>()

  for (const hero of heroes) {
    const owner = hero.source === 'local' ? 'local' : getHeroOwner(hero.heroId) ?? 'skills'
    const bucket = groups.get(owner) ?? []
    bucket.push(hero)
    groups.set(owner, bucket)
  }

  return [...groups.entries()]
    .map(([owner, group]) => {
      const heroIds = group.map((hero) => hero.heroId)
      const relatedTasks = tasks
        .filter((task) => task.selectedHeroIds.some((heroId) => heroIds.includes(heroId)))
        .sort(sortTasksByLatest)
      const latestTask = relatedTasks[0] ?? null
      const labels = ownerToRegionLabels(owner)

      return {
        id: resolveRegionId(owner),
        owner,
        labelZh: labels.zh,
        labelEn: labels.en,
        heroIds,
        representativeHeroId: group[0]?.heroId ?? '',
        totalHeroes: group.length,
        taskCount: relatedTasks.length,
        activeTaskCount: relatedTasks.filter((task) => ACTIVE_TASK_STATUSES.has(task.status)).length,
        busyHeroCount: group.filter((hero) => hero.status !== 'idle' || hero.currentTaskIds.length > 0).length,
        earlyExitCount: relatedTasks.reduce(
          (count, task) =>
            count +
            (task.deliveryDetails ?? []).filter(
              (detail) =>
                (detail.status === 'early_exit' || Boolean(detail.evolutionPatch)) &&
                (!detail.heroId || heroIds.includes(detail.heroId)),
            ).length,
          0,
        ),
        recoveringHeroCount: group.filter((hero) => hero.status === 'recovering').length,
        latestTaskId: latestTask?.taskId ?? null,
        latestTaskTitle: latestTask?.title ?? null,
        latestTaskStatus: latestTask?.status ?? null,
      } satisfies RegionTelemetry
    })
    .sort((left, right) => {
      if (left.owner === 'local') {
        return -1
      }
      if (right.owner === 'local') {
        return 1
      }
      return right.totalHeroes - left.totalHeroes || right.taskCount - left.taskCount || left.owner.localeCompare(right.owner)
    })
}
