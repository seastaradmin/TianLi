import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { DestinyConsole } from '../components/DestinyConsole'

describe('DestinyConsole', () => {
  it('collapses into a compact dock and can be reopened', () => {
    render(
      <DestinyConsole
        language="zh"
        taskInput=""
        pinnedHeroInput=""
        isSubmitting={false}
        statusSummary={null}
        onTaskInputChange={() => undefined}
        onPinnedHeroInputChange={() => undefined}
        onIssueDestiny={() => undefined}
        onRefreshSkills={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '收起天命模式' }))

    expect(screen.getByText('天命模式已收纳')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '展开天命模式' }))

    expect(screen.getByRole('button', { name: '收起天命模式' })).toBeInTheDocument()
    expect(screen.getByLabelText('输入新的天命')).toBeInTheDocument()
  })
})
