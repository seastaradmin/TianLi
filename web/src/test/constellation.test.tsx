import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ConstellationView } from '../components/constellation/ConstellationView'

describe('ConstellationView', () => {
  it('renders hero stars and destiny cores', () => {
    const onSelectNode = vi.fn()

    render(
      <ConstellationView
        heroes={[
          {
            heroId: 'builder/forge',
            displayName: 'Forge',
            description: 'Builds features',
            tags: ['frontend'],
            tools: ['Read', 'Write'],
            linkedSkills: ['deep-agents-orchestration'],
            color: '#f59e0b',
            x: 0.2,
            y: 0.3,
            status: 'running',
            load: 1,
            queueDepth: 1,
            currentTaskId: 'task-1',
            currentTaskIds: ['task-1'],
            source: 'local',
          },
        ]}
        tasks={[
          {
            taskId: 'task-1',
            title: 'Implement constellation dispatch',
            status: 'judgment_pending',
            pinnedHeroIds: [],
            selectedHeroIds: ['builder/forge'],
            primaryHeroId: 'builder/forge',
            consultHeroIds: [],
            candidateHeroIds: ['builder/forge'],
            maxFanout: 1,
            dispatchMode: 'hybrid',
            collaborationMode: 'primary_consult',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            reasoning: 'Forge matches implementation work.',
            verdictRound: 1,
            judgmentNote: '',
            verdictStatus: null,
            deliverySummary: 'Forge delivered the primary plan.',
            deliveryDetails: [],
            skillDispatches: [
              {
                taskId: 'task-1',
                heroId: 'builder/forge',
                role: 'primary',
                skillId: 'ui-design-review',
                status: 'applied',
                executionStatus: 'completed',
                contribution: 'Visual review completed.',
              },
            ],
            completedAt: new Date().toISOString(),
            history: [],
            verdictHistory: [],
          },
        ]}
        flows={[
          {
            id: 'flow-1',
            taskId: 'task-1',
            source: 'task-1',
            target: 'builder/forge',
            heroId: 'builder/forge',
            status: 'running',
            phase: 'running',
            label: 'Forge',
            role: 'primary',
            round: 1,
            animated: true,
            createdAt: new Date().toISOString(),
          },
        ]}
        language="en"
        selectedNodeId="builder/forge"
        onSelectNode={onSelectNode}
      />
    )

    expect(screen.getByLabelText('Destiny galaxy')).toBeInTheDocument()
    expect(screen.getByText('Round 2 · Destiny Core')).toBeInTheDocument()
    expect(screen.getByText('Forge')).toBeInTheDocument()
    expect(screen.getByText(/Implement constellation dispat/i)).toBeInTheDocument()
    expect(screen.getByText(/Running · 1 skill/i)).toBeInTheDocument()
    expect(screen.getByTitle('ui-design-review')).toBeInTheDocument()
  })
})
