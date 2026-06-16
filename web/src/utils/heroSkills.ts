import type { HeroState, TaskState } from '../types'

export function collectHeroSkillIds(hero: Pick<HeroState, 'heroId' | 'linkedSkills'>, tasks: TaskState[]) {
  const skillIds = new Set(hero.linkedSkills ?? [])

  for (const task of tasks) {
    for (const skill of task.skillDispatches ?? []) {
      if (skill.heroId === hero.heroId && skill.status === 'applied') {
        skillIds.add(skill.skillId)
      }
    }
  }

  return Array.from(skillIds)
}

export function countHeroSkills(hero: Pick<HeroState, 'heroId' | 'linkedSkills'>, tasks: TaskState[]) {
  return collectHeroSkillIds(hero, tasks).length
}
