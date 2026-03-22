import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls, QuadraticBezierLine } from '@react-three/drei'
import * as THREE from 'three'

import { formatHeroCountLabel, formatRoundLabel, formatSkillCountLabel, formatStatusLabel, resolveHeroDisplayName, t } from '../../i18n'
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
  label?: string
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
  idle: '#8394b6',
  issued: '#f0abfc',
  routing: '#62d4ff',
  consulting: '#b292ff',
  running: '#f4b85e',
  synthesizing: '#fb7185',
  judgment_pending: '#f7de88',
  accepted: '#42d7ac',
  rejected: '#fb7185',
  completed: '#42d7ac',
  early_exit: '#ff8a65',
  recovering: '#ff8a65',
  failed: '#ff6b7b',
  error: '#ff6b7b',
}

const OUTER_HERO_RADIUS = 1820
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

  const gradient = context.createRadialGradient(128, 128, 4, 128, 128, 128)
  gradient.addColorStop(0, innerColor)
  gradient.addColorStop(0.18 * falloff, innerColor)
  gradient.addColorStop(0.52, outerColor)
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

  context.clearRect(0, 0, 256, 256)
  context.fillStyle = gradient
  context.fillRect(0, 0, 256, 256)

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
    const radius = 280 + spread * 260
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius * 0.74
    const y = (depthNoise - 0.5) * 180 + Math.sin(angle * 2) * 36
    return [x, y, z]
  }

  const totalRemote = Math.max(total, 1)
  const angle = (index / totalRemote) * Math.PI * 2 + spread * 0.48
  const radius = OUTER_HERO_RADIUS + spread * 320
  return [
    Math.cos(angle) * radius,
    (depthNoise - 0.5) * 320 + (hero.y - 0.5) * 120,
    Math.sin(angle) * radius * 0.82,
  ]
}

function buildRegionCenter(owner: string, groupIndex: number): [number, number, number] {
  const spiralIndex = groupIndex + 1
  const angle = spiralIndex * (Math.PI * (3 - Math.sqrt(5))) + hash01(`${owner}:angle`) * 0.62
  const radius = 920 + Math.sqrt(spiralIndex) * 380 + (groupIndex % 3) * 70
  const x = Math.cos(angle) * radius
  const z = Math.sin(angle) * radius * 0.84
  const y = (hash01(`${owner}:height`) - 0.5) * 280 + Math.sin(angle * 1.4) * 52
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
  const clusterRadius = clamp(96 + Math.sqrt(groupSize) * 18, 96, 210)
  const angle = order * goldenAngle + spread * 1.1
  const radius = Math.min(clusterRadius + Math.sqrt(order) * 36 + spread * 34, clusterRadius + 220)
  return [
    center[0] + Math.cos(angle) * radius,
    center[1] + (depthNoise - 0.5) * 150 + Math.sin(angle * 1.5) * 18 + (hero.y - 0.5) * 60,
    center[2] + Math.sin(angle) * radius * 0.82,
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
    const orbitRadius = 120 + hash01(`${task.taskId}:task-radius`) * 170

    return [
      anchor[0] * 0.36 + Math.cos(orbitAngle) * orbitRadius,
      180 + hash01(`${task.taskId}:task-height`) * 120 + Math.abs(anchor[1]) * 0.12,
      anchor[2] * 0.36 + Math.sin(orbitAngle) * orbitRadius,
    ]
  }

  const safeTotal = Math.max(total, 1)
  const angle = (index / safeTotal) * Math.PI * 1.8 - Math.PI / 2
  const radius = 200 + (index % 3) * 110
  return [Math.cos(angle) * radius, 150 + (index % 2) * 72, Math.sin(angle) * radius * 0.68]
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
      color: '#f7df92',
      dimmed: !isRelated,
      labelZh: '天理主星域',
      labelEn: 'TianLi Core',
      count: heroIds.length,
      representativeHeroId: heroIds[0],
      navVisible: true,
      focusDistance: 560,
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
      color: ordered[0]?.hero.color || '#7dd3fc',
      dimmed: !isRelated,
      labelZh: labels.zh,
      labelEn: labels.en,
      count: group.length,
      representativeHeroId: ordered[0]?.hero.heroId ?? heroIds[0],
      navVisible: true,
      focusDistance: clamp(620 + group.length * 18, 620, 1120),
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
    const statusColor = STATUS_COLORS[hero.status] || hero.color || '#74e0ff'
    const active = hero.currentTaskIds.length > 0 || hero.status !== 'idle'
    heroModels.push({
      hero,
      position,
      size: 18 + hero.load * 5.2,
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
      const statusColor = STATUS_COLORS[hero.status] || hero.color || '#74e0ff'
      const active = hero.currentTaskIds.length > 0 || hero.status !== 'idle'
      heroModels.push({
        hero,
        position,
        size: 13 + hero.load * 4.2,
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
    const statusColor = STATUS_COLORS[task.status] || '#f7df92'
    return {
      task,
      position: buildTaskPosition(task, index, tasks.length, heroPositionMap),
      size: 24 + Math.min(3, task.selectedHeroIds.length) * 3,
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

      const color = STATUS_COLORS[flow.status] || '#74e0ff'
      const lift = flow.role === 'consult' ? 160 : 230
      const mid: [number, number, number] = [
        (start[0] + end[0]) * 0.5,
        Math.max(start[1], end[1]) + lift,
        (start[2] + end[2]) * 0.5 + (flow.role === 'consult' ? 80 : 0),
      ]
      const isRelated =
        !selectedNodeId ||
        flow.taskId === selectedNodeId ||
        flow.heroId === selectedNodeId ||
        flow.source === selectedNodeId ||
        flow.target === selectedNodeId
      const label = flow.role === 'consult' ? undefined : flow.label

      return {
        flow,
        start,
        end,
        mid,
        color,
        dimmed: !isRelated,
        label,
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

  scene.tasks.forEach((task) => evaluateCandidate(task.task.taskId, task.position, clamp(42 + task.size * 0.82, 52, 96)))
  scene.heroes.forEach((hero) => evaluateCandidate(hero.hero.heroId, hero.position, clamp(38 + hero.size * 1.24, 46, 86)))

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

function HeroStar({
  model,
  language,
  hovered,
  glowTexture,
  onSelect,
  onHover,
}: {
  model: SceneHeroModel
  language: Language
  hovered: boolean
  glowTexture: THREE.Texture
  onSelect: (nodeId: string, event: ThreeEvent<MouseEvent>) => void
  onHover: (nodeId: string | null) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const orbitRef = useRef<THREE.Mesh>(null)
  const baseY = model.position[1]
  const labelVisible = model.selected || hovered || (model.active && model.hero.source === 'local')
  const skillOrbitVisible = model.skillIds.length > 0 && (model.selected || hovered || (model.active && model.hero.source === 'local'))
  const opacity = model.dimmed ? 0.18 : 1
  const haloOpacity = model.selected ? 0.96 : hovered || model.active ? 0.78 : 0.4

  useFrame(({ clock }, delta) => {
    if (groupRef.current) {
      groupRef.current.position.y = baseY + Math.sin(clock.elapsedTime * 0.55 + model.size) * 5
      groupRef.current.rotation.y += delta * 0.12
    }

    if (orbitRef.current) {
      orbitRef.current.rotation.z += delta * 0.22
    }
  })

  return (
    <group
      ref={groupRef}
      position={model.position}
    >
      <mesh
        onClick={(event) => {
          event.stopPropagation()
          onSelect(model.hero.heroId, event)
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          onHover(model.hero.heroId)
        }}
        onPointerOut={() => onHover(null)}
      >
        <sphereGeometry args={[model.size * 3.15, 20, 20]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <sprite scale={[model.size * 9.2, model.size * 9.2, 1]}>
        <spriteMaterial
          map={glowTexture}
          color={model.statusColor}
          opacity={haloOpacity * opacity}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      {skillOrbitVisible && (
        <mesh ref={orbitRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[model.size * 1.85, model.size * 1.98, 72]} />
          <meshBasicMaterial
            color={model.statusColor}
            transparent
            opacity={(model.selected ? 0.64 : 0.22) * opacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {skillOrbitVisible && model.skillIds.slice(0, 2).map((skillId, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(model.skillIds.slice(0, 2).length, 1) - Math.PI / 2
        const radius = model.size * 2.26
        return (
          <mesh key={skillId} position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}>
            <sphereGeometry args={[1.6, 12, 12]} />
            <meshBasicMaterial color={model.statusColor} transparent opacity={0.72 * opacity} />
          </mesh>
        )
      })}

      <mesh scale={model.selected ? 1.18 : hovered ? 1.1 : 1}>
        <sphereGeometry args={[model.size, 28, 28]} />
        <meshStandardMaterial
          color={model.hero.color}
          emissive={model.statusColor}
          emissiveIntensity={model.selected ? 2.8 : model.active ? 1.92 : 1.26}
          roughness={0.14}
          metalness={0.03}
          transparent
          opacity={opacity}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[Math.max(model.size * 0.28, 3.2), 20, 20]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={(model.selected ? 0.94 : 0.76) * opacity} />
      </mesh>

      {labelVisible && (
        <Html center distanceFactor={12} position={[0, model.size * 2.55, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`cosmic-label ${model.selected ? 'cosmic-label-selected' : ''}`}>
            <strong>{resolveHeroDisplayName(model.hero, language)}</strong>
            <span>
              {formatStatusLabel(model.hero.status, language)}
              {model.skillIds.length > 0 ? ` · ${formatSkillCountLabel(model.skillIds.length, language)}` : ''}
            </span>
          </div>
        </Html>
      )}
    </group>
  )
}

const MemoHeroStar = memo(HeroStar)

function DestinyCore({
  model,
  language,
  glowTexture,
  hovered,
  onSelect,
  onHover,
}: {
  model: SceneTaskModel
  language: Language
  glowTexture: THREE.Texture
  hovered: boolean
  onSelect: (nodeId: string, event: ThreeEvent<MouseEvent>) => void
  onHover: (nodeId: string | null) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const baseY = model.position[1]
  const shortTitle = model.task.title.length > 34 ? `${model.task.title.slice(0, 34)}…` : model.task.title
  const opacity = model.dimmed ? 0.22 : 1
  const labelVisible = model.selected || hovered

  useFrame(({ clock }, delta) => {
    if (groupRef.current) {
      groupRef.current.position.y = baseY + Math.sin(clock.elapsedTime * 0.42 + model.size) * 6
    }

    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.18
    }
  })

  return (
    <group
      ref={groupRef}
      position={model.position}
    >
      <mesh
        onClick={(event) => {
          event.stopPropagation()
          onSelect(model.task.taskId, event)
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          onHover(model.task.taskId)
        }}
        onPointerOut={() => onHover(null)}
      >
        <sphereGeometry args={[model.size * 2.35, 18, 18]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <sprite scale={[model.size * 8.4, model.size * 8.4, 1]}>
        <spriteMaterial
          map={glowTexture}
          color={model.statusColor}
          opacity={(model.selected ? 0.92 : hovered ? 0.78 : 0.58) * opacity}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[model.size * 1.38, model.size * 1.5, 96]} />
        <meshBasicMaterial
          color={model.statusColor}
          transparent
          opacity={(model.selected ? 0.84 : 0.42) * opacity}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[model.size, 30, 30]} />
        <meshStandardMaterial
          color={model.statusColor}
          emissive={model.statusColor}
          emissiveIntensity={model.selected ? 3.2 : 2.28}
          transparent
          opacity={opacity}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[Math.max(model.size * 0.26, 3.8), 20, 20]} />
        <meshBasicMaterial color="#fff8eb" transparent opacity={0.86 * opacity} />
      </mesh>

      {labelVisible && (
        <Html center distanceFactor={10} position={[0, model.size * 2.2, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`cosmic-label cosmic-label-task ${model.selected ? 'cosmic-label-selected' : ''}`}>
            <strong>{shortTitle}</strong>
            <span>{`${formatRoundLabel(model.task.verdictRound + 1, language)} · ${t(language, 'destiny_core')}`}</span>
          </div>
        </Html>
      )}
    </group>
  )
}

const MemoDestinyCore = memo(DestinyCore)

function NebulaClouds({ texture }: { texture: THREE.Texture }) {
  const clouds = useMemo(
    () => [
      { position: [-1320, 260, -920] as [number, number, number], scale: 1540, color: '#66cfff', opacity: 0.08 },
      { position: [1360, -180, -1380] as [number, number, number], scale: 1660, color: '#b88cff', opacity: 0.06 },
      { position: [980, 80, 1180] as [number, number, number], scale: 1320, color: '#ffd78a', opacity: 0.05 },
    ],
    [],
  )

  return (
    <group>
      {clouds.map((cloud, index) => (
        <sprite key={`${cloud.color}-${index}`} position={cloud.position} scale={[cloud.scale, cloud.scale, 1]}>
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

function DeepSpaceDust() {
  const { positions, colors } = useMemo(() => {
    const count = 2400
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const radius = 1800 + Math.random() * 3800
      const height = (Math.random() - 0.5) * 1900
      positions[index * 3] = Math.cos(angle) * radius
      positions[index * 3 + 1] = height
      positions[index * 3 + 2] = Math.sin(angle) * radius * mix(0.48, 0.96, Math.random())

      const tint = Math.random()
      colors[index * 3] = mix(0.74, 0.98, tint)
      colors[index * 3 + 1] = mix(0.78, 0.98, Math.random())
      colors[index * 3 + 2] = mix(0.84, 1, 1 - tint * 0.6)
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
        size={1.55}
        sizeAttenuation
        transparent
        opacity={0.18}
        depthWrite={false}
        vertexColors
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function GalacticBand({ texture }: { texture: THREE.Texture }) {
  const bands = useMemo(
    () => [
      {
        position: [-420, 80, -2100] as [number, number, number],
        scale: [6200, 1480, 1] as [number, number, number],
        color: '#b8d7ff',
        opacity: 0.075,
      },
      {
        position: [620, -120, 1800] as [number, number, number],
        scale: [5400, 1120, 1] as [number, number, number],
        color: '#ffe4a8',
        opacity: 0.055,
      },
    ],
    [],
  )

  return (
    <group rotation={[0.16, -0.24, -0.34]}>
      {bands.map((band, index) => (
        <sprite key={`${band.color}-${index}`} position={band.position} scale={band.scale}>
          <spriteMaterial
            map={texture}
            color={band.color}
            opacity={band.opacity}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  )
}

function ConstellationLines({ model }: { model: SceneConstellationModel }) {
  return (
    <Line
      points={model.points}
      color={model.color}
      transparent
      opacity={model.dimmed ? 0.04 : 0.14}
      lineWidth={model.dimmed ? 0.7 : 1.2}
      depthWrite={false}
      dashed={false}
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
    <Html center position={[model.center[0], model.center[1] - 46, model.center[2]]} distanceFactor={44} style={{ pointerEvents: 'none' }}>
      <div className={`cosmic-region-label ${active ? 'cosmic-region-label-active' : ''}`}>
        <strong>{resolveRegionLabel(model, language)}</strong>
        <span>{formatHeroCountLabel(model.count, language)}</span>
      </div>
    </Html>
  )
}

function FlowArc({ model }: { model: SceneFlowModel }) {
  const labelPosition: [number, number, number] = [
    mix(model.start[0], model.end[0], 0.5),
    model.mid[1] * 0.88,
    mix(model.start[2], model.end[2], 0.5),
  ]

  return (
    <group>
      <QuadraticBezierLine
        start={model.start}
        mid={model.mid}
        end={model.end}
        color={model.color}
        lineWidth={model.flow.role === 'consult' ? 1.4 : 2.8}
        transparent
        opacity={model.dimmed ? 0.06 : model.flow.role === 'consult' ? 0.26 : 0.7}
        depthWrite={false}
      />

      {model.label && !model.dimmed && (
        <Html center position={labelPosition} distanceFactor={20} style={{ pointerEvents: 'none' }}>
          <div className="cosmic-flow-label">{model.label}</div>
        </Html>
      )}
    </group>
  )
}

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
    const desiredCamera = desiredTarget.clone().add(new THREE.Vector3(0, Math.max(220, focusTarget.distance * 0.24), focusTarget.distance))
    desiredTargetRef.current = desiredTarget
    desiredCameraRef.current = desiredCamera
  }, [focusTarget])

  useFrame(() => {
    const controls = controlsRef.current
    const desiredTarget = desiredTargetRef.current
    const desiredCamera = desiredCameraRef.current
    if (!controls || !desiredTarget || !desiredCamera) {
      return
    }

    controls.target.lerp(desiredTarget, 0.12)
    camera.position.lerp(desiredCamera, 0.1)
    controls.update()

    if (controls.target.distanceTo(desiredTarget) < 1.8 && camera.position.distanceTo(desiredCamera) < 2.4) {
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

function CosmicStage({
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

  const heroGlowTexture = useMemo(
    () => buildGlowTexture('rgba(255, 255, 255, 1)', 'rgba(182, 233, 255, 0.24)', 1.1),
    [],
  )
  const taskGlowTexture = useMemo(
    () => buildGlowTexture('rgba(255, 252, 235, 1)', 'rgba(255, 233, 170, 0.24)', 1.28),
    [],
  )
  const cloudTexture = useMemo(
    () => buildGlowTexture('rgba(255, 255, 255, 0.92)', 'rgba(255, 255, 255, 0)', 1.46),
    [],
  )
  const bandTexture = useMemo(
    () => buildGlowTexture('rgba(255, 255, 255, 0.96)', 'rgba(255, 255, 255, 0)', 2.1),
    [],
  )
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
      <RegionNavigation
        regions={navigationRegions}
        language={language}
        activeRegionId={activeRegionId}
        onFocusRegion={handleFocusRegion}
      />

      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 280, 1260], fov: 48, near: 0.1, far: 10000 }}
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
        <fogExp2 attach="fog" args={['#07101d', 0.0003]} />
        <ambientLight intensity={0.52} />
        <pointLight position={[0, 240, 0]} intensity={2.1} color="#c8e8ff" distance={3600} />
        <pointLight position={[760, 420, -420]} intensity={1.24} color="#ffe0a6" distance={3000} />

        <mesh scale={[-1, 1, 1]}>
          <sphereGeometry args={[6200, 48, 48]} />
          <meshBasicMaterial color="#07101d" side={THREE.BackSide} />
        </mesh>

        <DeepSpaceDust />
        <GalacticBand texture={bandTexture} />
        <NebulaClouds texture={cloudTexture} />

        {scene.constellations.map((constellation) => (
          <React.Fragment key={constellation.id}>
            <ConstellationLines model={constellation} />
            <RegionLabel model={constellation} language={language} active={activeRegionId === constellation.id} />
          </React.Fragment>
        ))}

        {scene.flows.map((flow) => (
          <FlowArc key={flow.flow.id} model={flow} />
        ))}

        {scene.tasks.map((task) => (
          <MemoDestinyCore
            key={task.task.taskId}
            model={task}
            language={language}
            glowTexture={taskGlowTexture}
            hovered={hoveredId === task.task.taskId}
            onSelect={(nodeId, event) => onSelectNode(nodeId, extractAnchor(event))}
            onHover={setHoveredId}
          />
        ))}

        {scene.heroes.map((hero) => (
          <MemoHeroStar
            key={hero.hero.heroId}
            model={hero}
            language={language}
            hovered={hoveredId === hero.hero.heroId}
            glowTexture={heroGlowTexture}
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
          dampingFactor={0.1}
          panSpeed={1.28}
          zoomSpeed={1.06}
          minDistance={320}
          maxDistance={4200}
          minPolarAngle={0.35}
          maxPolarAngle={Math.PI - 0.42}
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

  return <CosmicStage {...props} />
}
