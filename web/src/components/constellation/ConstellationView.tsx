import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

import {
  formatHeroCountLabel,
  formatRoundLabel,
  formatSkillCountLabel,
  formatStatusLabel,
  resolveHeroDisplayName,
  t,
} from '../../i18n'
import type { FlowState, HeroState, Language, TaskState, UiAnchor } from '../../types'

interface ConstellationViewProps {
  heroes: HeroState[]
  tasks: TaskState[]
  flows: FlowState[]
  language: Language
  selectedNodeId: string | null
  onSelectNode: (nodeId: string | null, anchor?: { x: number; y: number } | null) => void
}

interface SceneHeroModel {
  hero: HeroState
  position: [number, number, number]
  size: number
  statusColor: string
  selected: boolean
  dimmed: boolean
  active: boolean
  skillIds: string[]
}

interface SceneTaskModel {
  task: TaskState
  position: [number, number, number]
  size: number
  statusColor: string
  selected: boolean
  dimmed: boolean
}

interface SceneFlowModel {
  flow: FlowState
  start: [number, number, number]
  end: [number, number, number]
  mid: [number, number, number]
  color: string
  dimmed: boolean
  pulseOffset: number
  pulseSpeed: number
}

interface SceneConstellationModel {
  id: string
  heroIds: string[]
  points: [number, number, number][]
  center: [number, number, number]
  color: string
  dimmed: boolean
  labelZh: string
  labelEn: string
  count: number
  representativeHeroId: string
  navVisible: boolean
  focusDistance: number
}

interface SceneModel {
  heroes: SceneHeroModel[]
  tasks: SceneTaskModel[]
  flows: SceneFlowModel[]
  constellations: SceneConstellationModel[]
}

interface FocusTarget {
  id: string
  center: [number, number, number]
  distance: number
}

type ControlsHandle = {
  target: THREE.Vector3
  object: THREE.Camera
  update: () => void
}

const STATUS_COLORS: Record<string, string> = {
  idle: '#b8d9de',
  issued: '#c7d9f8',
  routing: '#8cdfe2',
  consulting: '#d2cef2',
  running: '#9ddedd',
  synthesizing: '#c8d4f0',
  judgment_pending: '#d7dde8',
  accepted: '#7fd7d4',
  rejected: '#d4c7de',
  completed: '#72d5cf',
  early_exit: '#b7d6d6',
  recovering: '#b7d6d6',
  failed: '#d9cdda',
  error: '#d9cdda',
}

const OUTER_HERO_RADIUS = 1720
const TEST_MODE =
  import.meta.env.MODE === 'test' || (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent))

function hash01(input: string) {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function mix(a: number, b: number, amount: number) {
  return a + (b - a) * amount
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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

function ownerToRegionLabels(owner: string) {
  const base = humanizeOwner(owner)
  return {
    zh: `${base} 星域`,
    en: `${base} Reach`,
  }
}

function resolveRegionLabel(region: SceneConstellationModel, language: Language) {
  return language === 'zh' ? region.labelZh : region.labelEn
}

function getHeroOwner(heroId: string) {
  const parts = heroId.split('/')
  if (parts[0] !== 'skill') {
    return null
  }
  return parts[1] || 'skills'
}

function averagePoints(points: [number, number, number][]) {
  if (points.length === 0) {
    return [0, 0, 0] as [number, number, number]
  }

  const summed = points.reduce(
    (accumulator, point) => [accumulator[0] + point[0], accumulator[1] + point[1], accumulator[2] + point[2]],
    [0, 0, 0] as [number, number, number],
  )

  return [summed[0] / points.length, summed[1] / points.length, summed[2] / points.length] as [number, number, number]
}

function buildGlowTexture(innerColor: string, outerColor: string, falloff = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) {
    return new THREE.Texture()
  }

  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 128)
  gradient.addColorStop(0, innerColor)
  gradient.addColorStop(0.16 * falloff, innerColor)
  gradient.addColorStop(0.58, outerColor)
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

  context.clearRect(0, 0, 256, 256)
  context.fillStyle = gradient
  context.fillRect(0, 0, 256, 256)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function buildIndentedNodeTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) {
    return new THREE.Texture()
  }

  const center = 128
  const radius = 88
  context.clearRect(0, 0, 256, 256)

  const outerGlow = context.createRadialGradient(center, center, radius * 0.65, center, center, radius * 1.32)
  outerGlow.addColorStop(0, 'rgba(255, 255, 255, 0)')
  outerGlow.addColorStop(0.75, 'rgba(0, 206, 209, 0.06)')
  outerGlow.addColorStop(1, 'rgba(0, 206, 209, 0)')
  context.fillStyle = outerGlow
  context.fillRect(0, 0, 256, 256)

  context.save()
  context.beginPath()
  context.arc(center, center, radius, 0, Math.PI * 2)
  context.closePath()
  context.clip()

  const baseGradient = context.createLinearGradient(center - radius, center - radius, center + radius, center + radius)
  baseGradient.addColorStop(0, '#ffffff')
  baseGradient.addColorStop(0.38, '#f6fbfd')
  baseGradient.addColorStop(1, '#e8eef1')
  context.fillStyle = baseGradient
  context.fillRect(center - radius, center - radius, radius * 2, radius * 2)

  const topLight = context.createRadialGradient(center - 28, center - 34, 10, center - 28, center - 34, radius * 1.2)
  topLight.addColorStop(0, 'rgba(255, 255, 255, 0.98)')
  topLight.addColorStop(0.48, 'rgba(255, 255, 255, 0.58)')
  topLight.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = topLight
  context.fillRect(center - radius, center - radius, radius * 2, radius * 2)

  const innerShadow = context.createRadialGradient(center + 18, center + 22, radius * 0.22, center + 18, center + 22, radius * 1.06)
  innerShadow.addColorStop(0, 'rgba(180, 197, 205, 0)')
  innerShadow.addColorStop(0.6, 'rgba(182, 197, 205, 0.08)')
  innerShadow.addColorStop(1, 'rgba(132, 151, 164, 0.34)')
  context.fillStyle = innerShadow
  context.fillRect(center - radius, center - radius, radius * 2, radius * 2)

  const innerWell = context.createRadialGradient(center, center + 10, radius * 0.12, center, center + 10, radius * 0.88)
  innerWell.addColorStop(0, 'rgba(255, 255, 255, 0)')
  innerWell.addColorStop(0.52, 'rgba(238, 244, 247, 0.1)')
  innerWell.addColorStop(1, 'rgba(182, 194, 201, 0.38)')
  context.fillStyle = innerWell
  context.fillRect(center - radius, center - radius, radius * 2, radius * 2)

  context.restore()

  context.beginPath()
  context.arc(center, center, radius, 0, Math.PI * 2)
  context.strokeStyle = 'rgba(255, 255, 255, 0.92)'
  context.lineWidth = 3
  context.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function buildSkillMap(tasks: TaskState[]) {
  const heroSkillMap = new Map<string, string[]>()

  for (const task of tasks) {
    for (const skill of task.skillDispatches ?? []) {
      if (skill.status !== 'applied') {
        continue
      }

      const existing = heroSkillMap.get(skill.heroId) ?? []
      if (!existing.includes(skill.skillId)) {
        existing.push(skill.skillId)
      }
      heroSkillMap.set(skill.heroId, existing)
    }
  }

  return heroSkillMap
}

function taskRelatesToSelection(task: TaskState, selectedNodeId: string | null) {
  if (!selectedNodeId) {
    return true
  }
  return task.taskId === selectedNodeId || task.selectedHeroIds.includes(selectedNodeId)
}

function heroRelatesToSelection(hero: HeroState, tasks: TaskState[], selectedNodeId: string | null) {
  if (!selectedNodeId) {
    return true
  }
  if (hero.heroId === selectedNodeId) {
    return true
  }
  return tasks.some((task) => task.taskId === selectedNodeId && task.selectedHeroIds.includes(hero.heroId))
}

function buildHeroPosition(hero: HeroState, index: number, total: number): [number, number, number] {
  const spread = hash01(hero.heroId)
  const depthNoise = hash01(`${hero.heroId}:depth`)

  if (hero.source === 'local') {
    const totalLocal = Math.max(total, 1)
    const angle = (index / totalLocal) * Math.PI * 2 + spread * 0.5 - Math.PI / 2
    const radius = 260 + spread * 220
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius * 0.76
    const y = (depthNoise - 0.5) * 140 + Math.sin(angle * 2) * 28
    return [x, y, z]
  }

  const totalRemote = Math.max(total, 1)
  const angle = (index / totalRemote) * Math.PI * 2 + spread * 0.48
  const radius = OUTER_HERO_RADIUS + spread * 240
  return [
    Math.cos(angle) * radius,
    (depthNoise - 0.5) * 220 + (hero.y - 0.5) * 88,
    Math.sin(angle) * radius * 0.84,
  ]
}

function buildRegionCenter(owner: string, groupIndex: number): [number, number, number] {
  const spiralIndex = groupIndex + 1
  const angle = spiralIndex * (Math.PI * (3 - Math.sqrt(5))) + hash01(`${owner}:angle`) * 0.62
  const radius = 880 + Math.sqrt(spiralIndex) * 320 + (groupIndex % 3) * 64
  const x = Math.cos(angle) * radius
  const z = Math.sin(angle) * radius * 0.88
  const y = (hash01(`${owner}:height`) - 0.5) * 220 + Math.sin(angle * 1.4) * 40
  return [x, y, z]
}

function buildClusteredRemotePosition(
  hero: HeroState,
  center: [number, number, number],
  memberIndex: number,
  groupSize: number,
): [number, number, number] {
  const spread = hash01(hero.heroId)
  const depthNoise = hash01(`${hero.heroId}:depth`)
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const order = memberIndex + 1
  const clusterRadius = clamp(88 + Math.sqrt(groupSize) * 16, 88, 194)
  const angle = order * goldenAngle + spread * 1.1
  const radius = Math.min(clusterRadius + Math.sqrt(order) * 34 + spread * 28, clusterRadius + 190)
  return [
    center[0] + Math.cos(angle) * radius,
    center[1] + (depthNoise - 0.5) * 116 + Math.sin(angle * 1.5) * 16 + (hero.y - 0.5) * 54,
    center[2] + Math.sin(angle) * radius * 0.84,
  ]
}

function buildTaskPosition(
  task: TaskState,
  index: number,
  total: number,
  heroPositions: Map<string, [number, number, number]>,
): [number, number, number] {
  const selectedHeroPositions = task.selectedHeroIds
    .map((heroId) => heroPositions.get(heroId))
    .filter((entry): entry is [number, number, number] => Boolean(entry))

  if (selectedHeroPositions.length > 0) {
    const average = selectedHeroPositions.reduce(
      (accumulator, position) => [
        accumulator[0] + position[0],
        accumulator[1] + position[1],
        accumulator[2] + position[2],
      ],
      [0, 0, 0] as [number, number, number],
    )
    const divisor = selectedHeroPositions.length
    const anchor: [number, number, number] = [average[0] / divisor, average[1] / divisor, average[2] / divisor]
    const orbitAngle = hash01(`${task.taskId}:task-angle`) * Math.PI * 2
    const orbitRadius = 116 + hash01(`${task.taskId}:task-radius`) * 132

    return [
      anchor[0] * 0.34 + Math.cos(orbitAngle) * orbitRadius,
      160 + hash01(`${task.taskId}:task-height`) * 72 + Math.abs(anchor[1]) * 0.08,
      anchor[2] * 0.34 + Math.sin(orbitAngle) * orbitRadius,
    ]
  }

  const safeTotal = Math.max(total, 1)
  const angle = (index / safeTotal) * Math.PI * 1.8 - Math.PI / 2
  const radius = 180 + (index % 3) * 96
  return [Math.cos(angle) * radius, 122 + (index % 2) * 52, Math.sin(angle) * radius * 0.7]
}

function buildConstellationModels(heroModels: SceneHeroModel[], tasks: TaskState[], selectedNodeId: string | null) {
  const constellations: SceneConstellationModel[] = []

  const localHeroes = heroModels.filter((hero) => hero.hero.source === 'local')
  if (localHeroes.length >= 3) {
    const points = [...localHeroes]
      .sort((left, right) => Math.atan2(left.position[2], left.position[0]) - Math.atan2(right.position[2], right.position[0]))
      .map((hero) => hero.position)
    const heroIds = localHeroes.map((hero) => hero.hero.heroId)
    const isRelated =
      !selectedNodeId ||
      heroIds.includes(selectedNodeId) ||
      tasks.some((task) => task.taskId === selectedNodeId && task.selectedHeroIds.some((heroId) => heroIds.includes(heroId)))
    constellations.push({
      id: 'constellation-local',
      heroIds,
      points,
      center: averagePoints(points),
      color: '#d9e4e9',
      dimmed: !isRelated,
      labelZh: '天理主星域',
      labelEn: 'TianLi Core',
      count: heroIds.length,
      representativeHeroId: heroIds[0],
      navVisible: true,
      focusDistance: 520,
    })
  }

  const remoteGroups = new Map<string, SceneHeroModel[]>()
  for (const hero of heroModels) {
    const owner = getHeroOwner(hero.hero.heroId)
    if (!owner) {
      continue
    }
    const bucket = remoteGroups.get(owner) ?? []
    bucket.push(hero)
    remoteGroups.set(owner, bucket)
  }

  const topOwners = [...remoteGroups.entries()]
    .filter(([, group]) => group.length >= 4)
    .sort((left, right) => right[1].length - left[1].length)
    .slice(0, 8)

  for (const [owner, group] of topOwners) {
    const center = averagePoints(group.map((hero) => hero.position))
    const ordered = [...group]
      .sort(
        (left, right) =>
          Math.atan2(left.position[2] - center[2], left.position[0] - center[0]) -
          Math.atan2(right.position[2] - center[2], right.position[0] - center[0]),
      )
      .slice(0, Math.min(group.length, 7))
    const heroIds = ordered.map((hero) => hero.hero.heroId)
    const isRelated =
      !selectedNodeId ||
      heroIds.includes(selectedNodeId) ||
      tasks.some((task) => task.taskId === selectedNodeId && task.selectedHeroIds.some((heroId) => heroIds.includes(heroId)))
    const labels = ownerToRegionLabels(owner)
    constellations.push({
      id: `constellation-${owner}`,
      heroIds,
      points: ordered.map((hero) => hero.position),
      center,
      color: '#dfe7ea',
      dimmed: !isRelated,
      labelZh: labels.zh,
      labelEn: labels.en,
      count: group.length,
      representativeHeroId: ordered[0]?.hero.heroId ?? heroIds[0],
      navVisible: true,
      focusDistance: clamp(560 + group.length * 18, 560, 980),
    })
  }

  return constellations
}

function buildSceneModel(heroes: HeroState[], tasks: TaskState[], flows: FlowState[], selectedNodeId: string | null): SceneModel {
  const heroSkillMap = buildSkillMap(tasks)
  const localHeroes = heroes.filter((hero) => hero.source === 'local')
  const remoteHeroes = heroes.filter((hero) => hero.source !== 'local')

  const heroModels: SceneHeroModel[] = []
  localHeroes.forEach((hero, index) => {
    const position = buildHeroPosition(hero, index, localHeroes.length)
    const skillIds = heroSkillMap.get(hero.heroId) ?? []
    const statusColor = STATUS_COLORS[hero.status] || '#8edddd'
    const active = hero.currentTaskIds.length > 0 || hero.status !== 'idle'
    heroModels.push({
      hero,
      position,
      size: 18 + hero.load * 4.4,
      statusColor,
      selected: hero.heroId === selectedNodeId,
      dimmed: !heroRelatesToSelection(hero, tasks, selectedNodeId),
      active,
      skillIds,
    })
  })

  const remoteGroups = new Map<string, HeroState[]>()
  for (const hero of remoteHeroes) {
    const owner = getHeroOwner(hero.heroId) ?? 'skills'
    const group = remoteGroups.get(owner) ?? []
    group.push(hero)
    remoteGroups.set(owner, group)
  }

  const orderedRemoteGroups = [...remoteGroups.entries()].sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
  orderedRemoteGroups.forEach(([owner, group], groupIndex) => {
    const regionCenter = buildRegionCenter(owner, groupIndex)
    group.forEach((hero, memberIndex) => {
      const position = buildClusteredRemotePosition(hero, regionCenter, memberIndex, group.length)
      const skillIds = heroSkillMap.get(hero.heroId) ?? []
      const statusColor = STATUS_COLORS[hero.status] || '#8edddd'
      const active = hero.currentTaskIds.length > 0 || hero.status !== 'idle'
      heroModels.push({
        hero,
        position,
        size: 13 + hero.load * 3.8,
        statusColor,
        selected: hero.heroId === selectedNodeId,
        dimmed: !heroRelatesToSelection(hero, tasks, selectedNodeId),
        active,
        skillIds,
      })
    })
  })

  const heroPositionMap = new Map(heroModels.map((hero) => [hero.hero.heroId, hero.position]))

  const taskModels = tasks.map((task, index) => {
    const statusColor = STATUS_COLORS[task.status] || '#c8dbe4'
    return {
      task,
      position: buildTaskPosition(task, index, tasks.length, heroPositionMap),
      size: 26 + Math.min(3, task.selectedHeroIds.length) * 3,
      statusColor,
      selected: task.taskId === selectedNodeId,
      dimmed: !taskRelatesToSelection(task, selectedNodeId),
    } satisfies SceneTaskModel
  })

  const taskPositionMap = new Map(taskModels.map((task) => [task.task.taskId, task.position]))

  const flowModels = flows
    .map((flow) => {
      const start = taskPositionMap.get(flow.taskId)
      const end = heroPositionMap.get(flow.heroId)
      if (!start || !end) {
        return null
      }

      const lift = flow.role === 'consult' ? 112 : 148
      const mid: [number, number, number] = [
        (start[0] + end[0]) * 0.5 + (hash01(`${flow.id}:x`) - 0.5) * 80,
        Math.max(start[1], end[1]) + lift,
        (start[2] + end[2]) * 0.5 + (flow.role === 'consult' ? 54 : 18),
      ]
      const isRelated =
        !selectedNodeId ||
        flow.taskId === selectedNodeId ||
        flow.heroId === selectedNodeId ||
        flow.source === selectedNodeId ||
        flow.target === selectedNodeId

      return {
        flow,
        start,
        end,
        mid,
        color: '#d9dee2',
        dimmed: !isRelated,
        pulseOffset: hash01(`${flow.id}:offset`),
        pulseSpeed: mix(0.08, 0.24, hash01(`${flow.id}:speed`)),
      } satisfies SceneFlowModel
    })
    .filter((entry): entry is SceneFlowModel => entry !== null)

  const constellations = buildConstellationModels(heroModels, tasks, selectedNodeId)

  return {
    heroes: heroModels,
    tasks: taskModels,
    flows: flowModels,
    constellations,
  }
}

function extractAnchor(event: ThreeEvent<MouseEvent>) {
  return {
    x: event.nativeEvent.clientX,
    y: event.nativeEvent.clientY,
  }
}

function extractAnchorFromMiss(event: unknown): UiAnchor | null {
  const maybeNative = event as { clientX?: number; clientY?: number; nativeEvent?: { clientX?: number; clientY?: number } }
  const clientX = maybeNative.clientX ?? maybeNative.nativeEvent?.clientX
  const clientY = maybeNative.clientY ?? maybeNative.nativeEvent?.clientY
  if (typeof clientX !== 'number' || typeof clientY !== 'number') {
    return null
  }
  return { x: clientX, y: clientY }
}

function findMagneticSelection(anchor: UiAnchor, camera: THREE.Camera | null, canvas: HTMLCanvasElement | null, scene: SceneModel) {
  if (!camera || !canvas) {
    return null
  }

  const bounds = canvas.getBoundingClientRect()
  let bestMatch: { nodeId: string; anchor: UiAnchor; distance: number } | null = null

  const evaluateCandidate = (nodeId: string, position: [number, number, number], threshold: number) => {
    const projected = new THREE.Vector3(position[0], position[1], position[2]).project(camera)
    if (projected.z < -1 || projected.z > 1) {
      return
    }

    const projectedAnchor = {
      x: bounds.left + (projected.x * 0.5 + 0.5) * bounds.width,
      y: bounds.top + (-projected.y * 0.5 + 0.5) * bounds.height,
    }
    const distance = Math.hypot(anchor.x - projectedAnchor.x, anchor.y - projectedAnchor.y)
    if (distance > threshold) {
      return
    }

    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = { nodeId, anchor: projectedAnchor, distance }
    }
  }

  scene.tasks.forEach((task) => evaluateCandidate(task.task.taskId, task.position, clamp(38 + task.size * 0.72, 48, 88)))
  scene.heroes.forEach((hero) => evaluateCandidate(hero.hero.heroId, hero.position, clamp(36 + hero.size * 0.94, 44, 80)))

  return bestMatch
}

function StarfieldFallback({ heroes, tasks, language, onSelectNode }: ConstellationViewProps) {
  const heroSkillMap = buildSkillMap(tasks)
  const fallbackAnchor = { x: 220, y: 180 }

  return (
    <section className="celestial-stage celestial-stage-fallback" aria-label={t(language, 'galaxy_stage')}>
      <div className="celestial-stage-fallback-copy">
        {tasks.map((task) => (
          <button
            key={task.taskId}
            type="button"
            className="celestial-stage-fallback-task"
            onClick={() => onSelectNode(task.taskId, fallbackAnchor)}
          >
            <span>{`${formatRoundLabel(task.verdictRound + 1, language)} · ${t(language, 'destiny_core')}`}</span>
            <strong>{task.title}</strong>
          </button>
        ))}

        {heroes.map((hero) => {
          const skillIds = heroSkillMap.get(hero.heroId) ?? []
          return (
            <button
              key={hero.heroId}
              type="button"
              className="celestial-stage-fallback-hero"
              onClick={() => onSelectNode(hero.heroId, fallbackAnchor)}
            >
              <strong>{resolveHeroDisplayName(hero, language)}</strong>
              <span>
                {formatStatusLabel(hero.status, language)}
                {skillIds.length > 0 ? ` · ${formatSkillCountLabel(skillIds.length, language)}` : ''}
              </span>
              {skillIds.map((skillId) => (
                <small key={skillId} title={skillId}>
                  {skillId}
                </small>
              ))}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function sampleQuadraticBezier(
  start: [number, number, number],
  mid: [number, number, number],
  end: [number, number, number],
  count = 42,
) {
  const points: [number, number, number][] = []
  for (let index = 0; index <= count; index += 1) {
    const progress = index / count
    points.push(pointOnQuadraticBezier(start, mid, end, progress))
  }
  return points
}

function pointOnQuadraticBezier(
  start: [number, number, number],
  mid: [number, number, number],
  end: [number, number, number],
  progress: number,
): [number, number, number] {
  const inverse = 1 - progress
  const x = inverse * inverse * start[0] + 2 * inverse * progress * mid[0] + progress * progress * end[0]
  const y = inverse * inverse * start[1] + 2 * inverse * progress * mid[1] + progress * progress * end[1]
  const z = inverse * inverse * start[2] + 2 * inverse * progress * mid[2] + progress * progress * end[2]
  return [x, y, z]
}

function BrightNode({
  nodeId,
  position,
  size,
  accentColor,
  dimmed,
  selected,
  hovered,
  active,
  title,
  subtitle,
  labelClassName,
  nodeTexture,
  glowTexture,
  coreTexture,
  onSelect,
  onHover,
}: {
  nodeId: string
  position: [number, number, number]
  size: number
  accentColor: string
  dimmed: boolean
  selected: boolean
  hovered: boolean
  active: boolean
  title: string
  subtitle: string
  labelClassName?: string
  nodeTexture: THREE.Texture
  glowTexture: THREE.Texture
  coreTexture: THREE.Texture
  onSelect: (nodeId: string, event: ThreeEvent<MouseEvent>) => void
  onHover: (nodeId: string | null) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const floatRef = useRef<THREE.Group>(null)
  const showLabel = selected || hovered
  const opacity = dimmed ? 0.24 : 1
  const glowOpacity = selected ? 0.54 : hovered ? 0.72 : active ? 0.36 : 0.22
  const targetScale = selected ? 1.08 : hovered ? 1.1 : 1

  useFrame(({ clock }, delta) => {
    if (groupRef.current) {
      const nextScale = THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, hovered ? 12 : 9, delta)
      groupRef.current.scale.setScalar(nextScale)
    }

    if (floatRef.current) {
      floatRef.current.position.y = Math.sin(clock.elapsedTime * 0.52 + size) * 5
      floatRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.18 + size) * 0.028
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <group ref={floatRef}>
        <mesh
          onClick={(event) => {
            event.stopPropagation()
            onSelect(nodeId, event)
          }}
          onPointerOver={(event) => {
            event.stopPropagation()
            onHover(nodeId)
          }}
          onPointerOut={() => onHover(null)}
        >
          <planeGeometry args={[size * 4.2, size * 4.2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <sprite scale={[size * 6.4, size * 6.4, 1]} position={[0, 0, -1]}>
          <spriteMaterial
            map={glowTexture}
            color="#00ced1"
            opacity={glowOpacity * opacity}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>

        <sprite scale={[size * 3.08, size * 3.08, 1]}>
          <spriteMaterial map={nodeTexture} color="#ffffff" transparent opacity={0.98 * opacity} depthWrite={false} />
        </sprite>

        <sprite scale={[size * 1.2, size * 1.2, 1]}>
          <spriteMaterial
            map={coreTexture}
            color={accentColor}
            transparent
            opacity={(selected ? 0.88 : hovered ? 0.78 : 0.56) * opacity}
            depthWrite={false}
          />
        </sprite>

        <sprite scale={[size * 1.66, size * 1.66, 1]} position={[0, 0, 0.4]}>
          <spriteMaterial
            map={glowTexture}
            color={accentColor}
            transparent
            opacity={(selected ? 0.2 : hovered ? 0.16 : 0.08) * opacity}
            depthWrite={false}
          />
        </sprite>

        <Html center distanceFactor={11} position={[0, -size * 1.92, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`cosmic-label ${labelClassName ?? ''} ${showLabel ? 'cosmic-label-visible' : ''} ${selected ? 'cosmic-label-selected' : ''}`}>
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
        </Html>
      </group>
    </group>
  )
}

const MemoBrightNode = memo(BrightNode)

function NebulaClouds({ texture }: { texture: THREE.Texture }) {
  const clouds = useMemo(
    () => [
      { position: [-960, 180, -620] as [number, number, number], scale: [1900, 1280, 1] as [number, number, number], color: '#e0ffff', opacity: 0.18 },
      { position: [920, -80, -940] as [number, number, number], scale: [1780, 1220, 1] as [number, number, number], color: '#e6e6fa', opacity: 0.18 },
      { position: [520, 120, 820] as [number, number, number], scale: [1460, 1020, 1] as [number, number, number], color: '#efffff', opacity: 0.12 },
    ],
    [],
  )

  return (
    <group>
      {clouds.map((cloud, index) => (
        <sprite key={`${cloud.color}-${index}`} position={cloud.position} scale={cloud.scale}>
          <spriteMaterial
            map={texture}
            color={cloud.color}
            opacity={cloud.opacity}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  )
}

function AtmosphereDust() {
  const { positions, colors } = useMemo(() => {
    const count = 1200
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const radius = 600 + Math.random() * 3400
      const height = (Math.random() - 0.5) * 1400
      positions[index * 3] = Math.cos(angle) * radius
      positions[index * 3 + 1] = height
      positions[index * 3 + 2] = Math.sin(angle) * radius * mix(0.52, 0.96, Math.random())

      const tint = Math.random()
      colors[index * 3] = mix(0.84, 0.98, tint)
      colors[index * 3 + 1] = mix(0.9, 1, Math.random())
      colors[index * 3 + 2] = mix(0.9, 1, 1 - tint * 0.34)
    }

    return { positions, colors }
  }, [])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={1.5}
        sizeAttenuation
        transparent
        opacity={0.22}
        depthWrite={false}
        vertexColors
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function ConstellationLines({ model }: { model: SceneConstellationModel }) {
  if (model.points.length < 2) {
    return null
  }

  return (
    <Line
      points={model.points}
      color={model.color}
      transparent
      opacity={model.dimmed ? 0.1 : 0.24}
      lineWidth={0.6}
      depthWrite={false}
      dashed
      dashSize={14}
      gapSize={12}
    />
  )
}

function RegionLabel({
  model,
  language,
  active,
}: {
  model: SceneConstellationModel
  language: Language
  active: boolean
}) {
  return (
    <Html center position={[model.center[0], model.center[1] - 36, model.center[2]]} distanceFactor={42} style={{ pointerEvents: 'none' }}>
      <div className={`cosmic-region-label ${active ? 'cosmic-region-label-active' : ''}`}>
        <strong>{resolveRegionLabel(model, language)}</strong>
        <span>{formatHeroCountLabel(model.count, language)}</span>
      </div>
    </Html>
  )
}

function FlowArc({ model, pulseTexture }: { model: SceneFlowModel; pulseTexture: THREE.Texture }) {
  const points = useMemo(() => sampleQuadraticBezier(model.start, model.mid, model.end), [model.end, model.mid, model.start])
  const pulseRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Sprite>(null)
  const opacity = model.dimmed ? 0.12 : 0.88

  useFrame(({ clock }) => {
    const progress = (clock.elapsedTime * model.pulseSpeed + model.pulseOffset) % 1
    const point = pointOnQuadraticBezier(model.start, model.mid, model.end, progress)

    if (pulseRef.current) {
      pulseRef.current.position.set(point[0], point[1], point[2])
    }

    if (glowRef.current) {
      glowRef.current.position.set(point[0], point[1], point[2] - 0.6)
    }
  })

  return (
    <group>
      <Line
        points={points}
        color={model.color}
        transparent
        opacity={opacity}
        lineWidth={model.flow.role === 'consult' ? 0.86 : 1.02}
        depthWrite={false}
        dashed
        dashSize={12}
        gapSize={10}
      />

      <sprite ref={glowRef} scale={[24, 24, 1]}>
        <spriteMaterial
          map={pulseTexture}
          color="#40e0d0"
          transparent
          opacity={(model.dimmed ? 0.14 : 0.42) * (model.flow.role === 'consult' ? 0.72 : 1)}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      <mesh ref={pulseRef}>
        <sphereGeometry args={[model.flow.role === 'consult' ? 4.2 : 5.4, 20, 20]} />
        <meshBasicMaterial color="#40e0d0" transparent opacity={model.dimmed ? 0.28 : 0.96} />
      </mesh>
    </group>
  )
}

const MemoFlowArc = memo(FlowArc)

function CameraNavigator({
  controlsRef,
  focusTarget,
}: {
  controlsRef: React.MutableRefObject<ControlsHandle | null>
  focusTarget: FocusTarget | null
}) {
  const camera = useThree((state) => state.camera)
  const desiredTargetRef = useRef<THREE.Vector3 | null>(null)
  const desiredCameraRef = useRef<THREE.Vector3 | null>(null)

  useEffect(() => {
    if (!focusTarget) {
      return
    }
    const desiredTarget = new THREE.Vector3(...focusTarget.center)
    const desiredCamera = desiredTarget.clone().add(new THREE.Vector3(0, Math.max(220, focusTarget.distance * 0.18), focusTarget.distance))
    desiredTargetRef.current = desiredTarget
    desiredCameraRef.current = desiredCamera
  }, [focusTarget])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    const desiredTarget = desiredTargetRef.current
    const desiredCamera = desiredCameraRef.current
    if (!controls || !desiredTarget || !desiredCamera) {
      return
    }

    controls.target.lerp(desiredTarget, THREE.MathUtils.clamp(delta * 3.2, 0.05, 0.16))
    camera.position.lerp(desiredCamera, THREE.MathUtils.clamp(delta * 3, 0.05, 0.14))
    controls.update()

    if (controls.target.distanceTo(desiredTarget) < 1.6 && camera.position.distanceTo(desiredCamera) < 2.1) {
      desiredTargetRef.current = null
      desiredCameraRef.current = null
    }
  })

  return null
}

function RegionNavigation({
  regions,
  language,
  activeRegionId,
  onFocusRegion,
}: {
  regions: SceneConstellationModel[]
  language: Language
  activeRegionId: string | null
  onFocusRegion: (region: SceneConstellationModel) => void
}) {
  if (regions.length === 0) {
    return null
  }

  return (
    <nav className="cosmic-region-nav" aria-label={t(language, 'region_navigation')}>
      <span className="cosmic-region-nav-kicker">{t(language, 'region_navigation')}</span>
      <div className="cosmic-region-nav-list">
        {regions.map((region) => (
          <button
            key={region.id}
            type="button"
            className={`cosmic-region-chip ${activeRegionId === region.id ? 'cosmic-region-chip-active' : ''}`}
            aria-label={t(language, 'jump_to_region', { region: resolveRegionLabel(region, language) })}
            onClick={() => onFocusRegion(region)}
          >
            <strong>{resolveRegionLabel(region, language)}</strong>
            <span>{formatHeroCountLabel(region.count, language)}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

function BrightGalaxyStage({
  heroes,
  tasks,
  flows,
  language,
  selectedNodeId,
  onSelectNode,
}: ConstellationViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedRegionId, setFocusedRegionId] = useState<string | null>(null)
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null)
  const scene = useMemo(() => buildSceneModel(heroes, tasks, flows, selectedNodeId), [heroes, tasks, flows, selectedNodeId])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cameraRef = useRef<THREE.Camera | null>(null)
  const controlsRef = useRef<ControlsHandle | null>(null)
  const gestureRef = useRef<{ start: UiAnchor | null; dragged: boolean }>({ start: null, dragged: false })

  const nodeTexture = useMemo(() => buildIndentedNodeTexture(), [])
  const nodeGlowTexture = useMemo(() => buildGlowTexture('rgba(117, 238, 242, 0.64)', 'rgba(117, 238, 242, 0)', 1.18), [])
  const coreTexture = useMemo(() => buildGlowTexture('rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0)', 1.3), [])
  const cloudTexture = useMemo(() => buildGlowTexture('rgba(255, 255, 255, 0.94)', 'rgba(255, 255, 255, 0)', 1.72), [])
  const pulseTexture = useMemo(() => buildGlowTexture('rgba(64, 224, 208, 0.92)', 'rgba(64, 224, 208, 0)', 1.22), [])
  const navigationRegions = useMemo(() => scene.constellations.filter((region) => region.navVisible), [scene.constellations])
  const activeRegionId =
    scene.constellations.find((region) =>
      selectedNodeId
        ? region.heroIds.includes(selectedNodeId) ||
          tasks.some((task) => task.taskId === selectedNodeId && task.selectedHeroIds.some((heroId) => region.heroIds.includes(heroId)))
        : false,
    )?.id ?? focusedRegionId

  const handleFocusRegion = (region: SceneConstellationModel) => {
    setFocusedRegionId(region.id)
    setFocusTarget({
      id: region.id,
      center: region.center,
      distance: region.focusDistance,
    })
  }

  return (
    <section className="celestial-stage" aria-label={t(language, 'galaxy_stage')}>
      <div className="celestial-stage-aura celestial-stage-aura-cyan" />
      <div className="celestial-stage-aura celestial-stage-aura-lavender" />

      <RegionNavigation
        regions={navigationRegions}
        language={language}
        activeRegionId={activeRegionId}
        onFocusRegion={handleFocusRegion}
      />

      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 180, 1120], fov: 42, near: 0.1, far: 10000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        eventPrefix="client"
        onCreated={(state) => {
          canvasRef.current = state.gl.domElement
          cameraRef.current = state.camera
        }}
        onPointerDown={(event) => {
          gestureRef.current = {
            start: extractAnchorFromMiss(event),
            dragged: false,
          }
        }}
        onPointerMove={(event) => {
          const start = gestureRef.current.start
          const anchor = extractAnchorFromMiss(event)
          if (!start || !anchor) {
            return
          }
          if (Math.hypot(anchor.x - start.x, anchor.y - start.y) > 10) {
            gestureRef.current.dragged = true
          }
        }}
        onPointerUp={() => {
          gestureRef.current.start = null
        }}
        onPointerMissed={(event) => {
          if (gestureRef.current.dragged) {
            gestureRef.current.dragged = false
            onSelectNode(null, null)
            return
          }

          const anchor = extractAnchorFromMiss(event)
          if (!anchor) {
            onSelectNode(null, null)
            return
          }

          const magneticMatch = findMagneticSelection(anchor, cameraRef.current, canvasRef.current, scene)
          gestureRef.current.dragged = false
          if (magneticMatch) {
            onSelectNode(magneticMatch.nodeId, magneticMatch.anchor)
            return
          }

          onSelectNode(null, null)
        }}
      >
        <color attach="background" args={['#f9fbfc']} />
        <fogExp2 attach="fog" args={['#f6fafb', 0.00018]} />
        <ambientLight intensity={1.55} />
        <directionalLight position={[-480, 520, 360]} intensity={1.1} color="#ffffff" />
        <pointLight position={[640, 260, 240]} intensity={1.28} color="#e0ffff" distance={2600} />
        <pointLight position={[-520, 180, -220]} intensity={0.9} color="#e6e6fa" distance={2200} />

        <NebulaClouds texture={cloudTexture} />
        <AtmosphereDust />

        {scene.constellations.map((constellation) => (
          <React.Fragment key={constellation.id}>
            <ConstellationLines model={constellation} />
            <RegionLabel model={constellation} language={language} active={activeRegionId === constellation.id} />
          </React.Fragment>
        ))}

        {scene.flows.map((flow) => (
          <MemoFlowArc key={flow.flow.id} model={flow} pulseTexture={pulseTexture} />
        ))}

        {scene.tasks.map((task) => (
          <MemoBrightNode
            key={task.task.taskId}
            nodeId={task.task.taskId}
            position={task.position}
            size={task.size}
            accentColor={task.statusColor}
            dimmed={task.dimmed}
            selected={task.selected}
            hovered={hoveredId === task.task.taskId}
            active={!task.dimmed}
            title={task.task.title.length > 34 ? `${task.task.title.slice(0, 34)}…` : task.task.title}
            subtitle={`${formatRoundLabel(task.task.verdictRound + 1, language)} · ${t(language, 'destiny_core')}`}
            labelClassName="cosmic-label-task"
            nodeTexture={nodeTexture}
            glowTexture={nodeGlowTexture}
            coreTexture={coreTexture}
            onSelect={(nodeId, event) => onSelectNode(nodeId, extractAnchor(event))}
            onHover={setHoveredId}
          />
        ))}

        {scene.heroes.map((hero) => (
          <MemoBrightNode
            key={hero.hero.heroId}
            nodeId={hero.hero.heroId}
            position={hero.position}
            size={hero.size}
            accentColor={hero.statusColor}
            dimmed={hero.dimmed}
            selected={hero.selected}
            hovered={hoveredId === hero.hero.heroId}
            active={hero.active}
            title={resolveHeroDisplayName(hero.hero, language)}
            subtitle={`${formatStatusLabel(hero.hero.status, language)}${hero.skillIds.length > 0 ? ` · ${formatSkillCountLabel(hero.skillIds.length, language)}` : ''}`}
            nodeTexture={nodeTexture}
            glowTexture={nodeGlowTexture}
            coreTexture={coreTexture}
            onSelect={(nodeId, event) => onSelectNode(nodeId, extractAnchor(event))}
            onHover={setHoveredId}
          />
        ))}

        <OrbitControls
          ref={(instance) => {
            controlsRef.current = instance as unknown as ControlsHandle | null
          }}
          enableZoom
          enablePan
          enableRotate={false}
          enableDamping
          screenSpacePanning
          dampingFactor={0.08}
          panSpeed={1.08}
          zoomSpeed={0.94}
          minDistance={320}
          maxDistance={3600}
          minPolarAngle={0.3}
          maxPolarAngle={Math.PI - 0.3}
          mouseButtons={{
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          touches={{
            ONE: THREE.TOUCH.PAN,
            TWO: THREE.TOUCH.DOLLY_PAN,
          }}
        />
        <CameraNavigator controlsRef={controlsRef} focusTarget={focusTarget} />
      </Canvas>
    </section>
  )
}

export function ConstellationView(props: ConstellationViewProps) {
  if (TEST_MODE) {
    return <StarfieldFallback {...props} />
  }

  return <BrightGalaxyStage {...props} />
}

export const GalaxyStage = ConstellationView
