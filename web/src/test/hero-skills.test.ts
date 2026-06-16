import { describe, expect, it } from 'vitest'

import type { TaskState } from '../types'
import { collectHeroSkillIds, countHeroSkills } from '../utils/heroSkills'

describe('heroSkills utilities', () => {
  it('counts linked hero skills even before a task dispatch happens', () => {
    const hero = {
      heroId: 'skill/corey/seo-audit',
      linkedSkills: ['seo-audit', 'serp-analysis'],
    }

    expect(countHeroSkills(hero, [])).toBe(2)
    expect(collectHeroSkillIds(hero, [])).toEqual(['seo-audit', 'serp-analysis'])
  })

  it('merges linked skills with applied task skills without duplicates', () => {
    const hero = {
      heroId: 'builder/forge',
      linkedSkills: ['ui-design-review'],
    }
    const tasks = [
      {
        skillDispatches: [
          { heroId: 'builder/forge', skillId: 'browser-devtools-cli', status: 'applied' },
          { heroId: 'builder/forge', skillId: 'ui-design-review', status: 'applied' },
          { heroId: 'builder/forge', skillId: 'unused-skill', status: 'skipped' },
        ],
      },
    ] as unknown as TaskState[]

    expect(collectHeroSkillIds(hero, tasks)).toEqual(['ui-design-review', 'browser-devtools-cli'])
  })
})
