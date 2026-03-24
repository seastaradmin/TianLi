import type { TaskState } from '../types'

export const ACTIVE_SESSION_STATUSES = new Set<TaskState['status']>([
  'issued',
  'routing',
  'consulting',
  'running',
  'synthesizing',
  'judgment_pending',
])

export function sortTasksByUpdated(tasks: TaskState[]) {
  return [...tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt))
}

export function isActiveSessionTask(task: TaskState) {
  return ACTIVE_SESSION_STATUSES.has(task.status)
}

export function partitionSessionTasks(tasks: TaskState[]) {
  const ordered = sortTasksByUpdated(tasks)
  return {
    activeTasks: ordered.filter(isActiveSessionTask),
    archivedTasks: ordered.filter((task) => !isActiveSessionTask(task)),
  }
}
