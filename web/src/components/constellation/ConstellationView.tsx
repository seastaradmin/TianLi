import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls, useTexture } from '@react-three/drei'
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
import { buildRegionTelemetry, getHeroOwner } from '../../utils/regions'
import { isActiveSessionTask } from '../../utils/tasks'

interface ConstellationViewProps {
  heroes: HeroState[]
  tasks: TaskState[]
  flows: FlowState[]
  language: Language
  selectedNodeId: string | null
  autoFocusTarget?: { nodeId: string; token: number } | null
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
  active: boolean
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
  activeTaskCount: number
  busyHeroCount: number
  earlyExitCount: number
  latestTaskId: string | null
  latestTaskTitle: string | null
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

interface PlanetSurfaceProfile {
  id: string
  texturePath: string
  atmosphereColor: string
  haloColor: string
  surfaceTint: string
  ringColor?: string
  ringTilt?: number
  roughness: number
  metalness: number
}

const STATUS_COLORS: Record<string, string> = {
  idle: '#6a8db8',
  issued: '#88a8ff',
  routing: '#59c8ff',
  consulting: '#9e90ff',
  running: '#4fe0c8',
  synthesizing: '#8fbdf8',
  judgment_pending: '#f0c26c',
  accepted: '#7be1bd',
  rejected: '#ff88ab',
  completed: '#63ded5',
  early_exit: '#7da5b7',
  recovering: '#7da5b7',
  failed: '#af84a7',
  error: '#ff6e8d',
}

const OUTER_HERO_RADIUS = 2120
const TEST_MODE =
  import.meta.env.MODE === 'test' || (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent))
const PLANET_SURFACE_LIBRARY: PlanetSurfaceProfile[] = [
  {
    id: 'earth',
    texturePath: '/textures/nasa/earth-b.jpg',
    atmosphereColor: '#7fd3ff',
    haloColor: '#b3e7ff',
    surfaceTint: '#f6fbff',
    roughness: 0.9,
    metalness: 0.02,
  },
  {
    id: 'mars',
    texturePath: '/textures/nasa/mars.jpg',
    atmosphereColor: '#ffb58a',
    haloColor: '#ff8b68',
    surfaceTint: '#fff7f2',
    roughness: 0.94,
    metalness: 0.01,
  },
  {
    id: 'jupiter',
    texturePath: '/textures/nasa/jupiter.jpg',
    atmosphereColor: '#ffd5b2',
    haloColor: '#eec79c',
    surfaceTint: '#fff7eb',
    roughness: 0.98,
    metalness: 0.01,
  },
  {
    id: 'io',
    texturePath: '/textures/nasa/io-b.jpg',
    atmosphereColor: '#f6d97e',
    haloColor: '#ffeaa5',
    surfaceTint: '#fffdf3',
    roughness: 0.96,
    metalness: 0.01,
  },
  {
    id: 'saturn',
    texturePath: '/textures/nasa/saturn.jpg',
    atmosphereColor: '#ffe0b3',
    haloColor: '#f3ddaa',
    surfaceTint: '#fff9ef',
    ringColor: '#e8d8a9',
    ringTilt: 0.42,
    roughness: 0.95,
    metalness: 0.01,
  },
  {
    id: 'titan',
    texturePath: '/textures/nasa/titan.jpg',
    atmosphereColor: '#ffb357',
    haloColor: '#ff8a2a',
    surfaceTint: '#fff7ea',
    roughness: 0.96,
    metalness: 0.01,
  },
  {
    id: 'enceladus',
    texturePath: '/textures/nasa/enceladus.jpg',
    atmosphereColor: '#d6e7ff',
    haloColor: '#eef6ff',
    surfaceTint: '#f8fbff',
    roughness: 1,
    metalness: 0.01,
  },
]

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

function seededRandom(seedInput: string) {
  let seed = Math.max(1, Math.floor(hash01(seedInput) * 2147483646))
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function mixColor(left: string, right: string, amount: number) {
  const color = new THREE.Color(left).lerp(new THREE.Color(right), amount)
  return `#${color.getHexString()}`
}

function colorToRgba(colorValue: string, alpha: number) {
  const color = new THREE.Color(colorValue)
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`
}

function blackbodyColor(tempK: number) {
  const temperature = Math.max(1000, tempK) / 100
  let red: number
  let green: number
  let blue: number

  if (temperature <= 66) {
    red = 255
    green = 99.4708025861 * Math.log(temperature) - 161.1195681661
    blue = temperature <= 19 ? 0 : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307
  } else {
    red = 329.698727446 * Math.pow(temperature - 60, -0.1332047592)
    green = 288.1221695283 * Math.pow(temperature - 60, -0.0755148492)
    blue = 255
  }

  return new THREE.Color(
    clamp(red, 0, 255) / 255,
    clamp(green, 0, 255) / 255,
    clamp(blue, 0, 255) / 255,
  )
}

function sampleStarTemperature(value: number) {
  if (value < 0.003) {
    return 30000 + value * 5_000_000
  }
  if (value < 0.01) {
    return 10000 + value * 1_000_000
  }
  if (value < 0.04) {
    return 7500 + value * 60_000
  }
  if (value < 0.11) {
    return 6000 + value * 15_000
  }
  if (value < 0.23) {
    return 5200 + value * 5000
  }
  if (value < 0.5) {
    return 3700 + value * 3000
  }
  return 2400 + value * 2600
}

function buildCelestialStarfieldData(
  seedKey: string,
  count: number,
  options: {
    minRadius: number
    maxRadius: number
    band?: boolean
    bandSpread?: number
    brightnessRange?: [number, number]
  },
) {
  const random = seededRandom(seedKey)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const galacticRotation = new THREE.Euler(-0.88, 0.42, 0.28)
  const [minBrightness, maxBrightness] = options.brightnessRange ?? [0.18, 0.82]

  for (let index = 0; index < count; index += 1) {
    const radius = mix(options.minRadius, options.maxRadius, random())
    const direction = new THREE.Vector3()

    if (options.band) {
      const longitude = random() * Math.PI * 2
      const latitude = (random() > 0.5 ? 1 : -1) * Math.pow(random(), 2.3) * (options.bandSpread ?? 0.22)
      const cosLatitude = Math.cos(latitude)
      direction.set(Math.cos(longitude) * cosLatitude, Math.sin(latitude), Math.sin(longitude) * cosLatitude)
      direction.applyEuler(galacticRotation)
    } else {
      const theta = random() * Math.PI * 2
      const phi = Math.acos(2 * random() - 1)
      direction.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta))
    }

    const temperature = sampleStarTemperature(random())
    const color = blackbodyColor(temperature)
    const brightness = mix(minBrightness, maxBrightness, 1 - Math.pow(random(), options.band ? 1.8 : 2.6))
    color.multiplyScalar(brightness)
    if (options.band) {
      color.lerp(new THREE.Color('#ffe3b7'), 0.06)
    }

    positions[index * 3] = direction.x * radius
    positions[index * 3 + 1] = direction.y * radius
    positions[index * 3 + 2] = direction.z * radius

    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
  }

  return { positions, colors }
}

function buildMilkyWayTexture(seedKey: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) {
    return new THREE.Texture()
  }

  const random = seededRandom(seedKey)
  context.clearRect(0, 0, canvas.width, canvas.height)

  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  background.addColorStop(0, 'rgba(255,255,255,0)')
  background.addColorStop(0.5, 'rgba(255,255,255,0.02)')
  background.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)

  for (let index = 0; index < 28; index += 1) {
    const x = canvas.width * mix(0.06, 0.94, index / 27)
    const y = canvas.height * (0.46 + Math.sin(index * 0.44) * 0.06 + (random() - 0.5) * 0.04)
    const radiusX = 90 + random() * 180
    const radiusY = 24 + random() * 52
    const core = context.createRadialGradient(x, y, 2, x, y, radiusX)
    core.addColorStop(0, colorToRgba(mixColor('#fff1d1', '#dce8ff', random() * 0.45), 0.24 + random() * 0.14))
    core.addColorStop(0.38, colorToRgba(mixColor('#ffe2a8', '#a7c7ff', random() * 0.55), 0.12 + random() * 0.08))
    core.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = core
    context.beginPath()
    context.ellipse(x, y, radiusX, radiusY, random() * 0.1 - 0.05, 0, Math.PI * 2)
    context.fill()
  }

  context.globalCompositeOperation = 'destination-out'
  for (let laneIndex = 0; laneIndex < 3; laneIndex += 1) {
    context.beginPath()
    context.moveTo(0, canvas.height * (0.46 + laneIndex * 0.03))
    for (let step = 0; step <= 16; step += 1) {
      const progress = step / 16
      const x = progress * canvas.width
      const y =
        canvas.height * (0.46 + laneIndex * 0.03) +
        Math.sin(progress * Math.PI * 3.8 + laneIndex * 0.7) * 16 +
        (random() - 0.5) * 12
      context.lineTo(x, y)
    }
    context.strokeStyle = `rgba(0, 0, 0, ${laneIndex === 1 ? 0.26 : 0.14})`
    context.lineWidth = laneIndex === 1 ? 18 : 10
    context.stroke()
  }
  context.globalCompositeOperation = 'source-over'

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function buildOrbitalPoints(radiusX: number, radiusY: number, count = 96) {
  const points: [number, number, number][] = []
  for (let index = 0; index <= count; index += 1) {
    const angle = (index / count) * Math.PI * 2
    points.push([Math.cos(angle) * radiusX, Math.sin(angle) * radiusY, 0])
  }
  return points
}

function resolvePlanetSurfaceProfile(heroId: string) {
  const index = Math.floor(hash01(`${heroId}:planet-profile`) * PLANET_SURFACE_LIBRARY.length) % PLANET_SURFACE_LIBRARY.length
  return PLANET_SURFACE_LIBRARY[index] ?? PLANET_SURFACE_LIBRARY[0]
}

function resolveRegionLabel(region: SceneConstellationModel, language: Language) {
  return language === 'zh' ? region.labelZh : region.labelEn
}

function formatRegionFeedback(region: SceneConstellationModel, language: Language) {
  if (region.activeTaskCount === 0 && region.busyHeroCount === 0 && region.earlyExitCount === 0) {
    return t(language, 'region_feedback_quiet')
  }

  const base =
    language === 'zh'
      ? `${region.activeTaskCount} 天命 · ${region.busyHeroCount} 出征`
      : `${region.activeTaskCount} destin${region.activeTaskCount === 1 ? 'y' : 'ies'} · ${region.busyHeroCount} active`

  if (region.earlyExitCount === 0) {
    return base
  }

  return language === 'zh' ? `${base} · ${region.earlyExitCount} 天劫` : `${base} · ${region.earlyExitCount} early exits`
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
  const radius = 1080 + Math.sqrt(spiralIndex) * 360 + (groupIndex % 3) * 86
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
  const telemetryById = new Map(buildRegionTelemetry(heroModels.map((hero) => hero.hero), tasks).map((entry) => [entry.id, entry]))

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
    const localTelemetry = telemetryById.get('constellation-local')
    constellations.push({
      id: 'constellation-local',
      heroIds,
      points,
      center: averagePoints(points),
      color: '#44618e',
      dimmed: !isRelated,
      labelZh: localTelemetry?.labelZh ?? '天理主星域',
      labelEn: localTelemetry?.labelEn ?? 'TianLi Core',
      count: heroIds.length,
      activeTaskCount: localTelemetry?.activeTaskCount ?? 0,
      busyHeroCount: localTelemetry?.busyHeroCount ?? 0,
      earlyExitCount: localTelemetry?.earlyExitCount ?? 0,
      latestTaskId: localTelemetry?.latestTaskId ?? null,
      latestTaskTitle: localTelemetry?.latestTaskTitle ?? null,
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
    const regionTelemetry = telemetryById.get(`constellation-${owner}`)
    constellations.push({
      id: `constellation-${owner}`,
      heroIds,
      points: ordered.map((hero) => hero.position),
      center,
      color: '#38567f',
      dimmed: !isRelated,
      labelZh: regionTelemetry?.labelZh ?? owner,
      labelEn: regionTelemetry?.labelEn ?? owner,
      count: group.length,
      activeTaskCount: regionTelemetry?.activeTaskCount ?? 0,
      busyHeroCount: regionTelemetry?.busyHeroCount ?? 0,
      earlyExitCount: regionTelemetry?.earlyExitCount ?? 0,
      latestTaskId: regionTelemetry?.latestTaskId ?? null,
      latestTaskTitle: regionTelemetry?.latestTaskTitle ?? null,
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
    const skillIds = Array.from(new Set([...(hero.linkedSkills ?? []), ...(heroSkillMap.get(hero.heroId) ?? [])]))
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
      const skillIds = Array.from(new Set([...(hero.linkedSkills ?? []), ...(heroSkillMap.get(hero.heroId) ?? [])]))
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
  const visibleTasks = tasks.filter(isActiveSessionTask)

  const taskModels = visibleTasks.map((task, index) => {
    const statusColor = STATUS_COLORS[task.status] || '#c8dbe4'
    return {
      task,
      position: buildTaskPosition(task, index, visibleTasks.length, heroPositionMap),
      size: 26 + Math.min(3, task.selectedHeroIds.length) * 3,
      statusColor,
      selected: task.taskId === selectedNodeId,
      dimmed: !taskRelatesToSelection(task, selectedNodeId),
      active: true,
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
        color: flow.role === 'consult' ? '#5e89c7' : '#6fd8df',
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

  return bestMatch
}

function StarfieldFallback({ tasks, language, onSelectNode }: ConstellationViewProps) {
  const fallbackAnchor = { x: 220, y: 180 }
  const activeTasks = tasks.filter(isActiveSessionTask)

  return (
    <section className="celestial-stage celestial-stage-fallback" aria-label={t(language, 'galaxy_stage')}>
      <div className="celestial-stage-fallback-copy">
        {activeTasks.map((task) => (
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

function HeroPlanetNode({
  nodeId,
  position,
  size,
  accentColor,
  planetProfile,
  dimmed,
  selected,
  hovered,
  active,
  title,
  subtitle,
  labelClassName,
  glowTexture,
  onSelect,
  onHover,
}: {
  nodeId: string
  position: [number, number, number]
  size: number
  accentColor: string
  planetProfile: PlanetSurfaceProfile
  dimmed: boolean
  selected: boolean
  hovered: boolean
  active: boolean
  title: string
  subtitle: string
  labelClassName?: string
  glowTexture: THREE.Texture
  onSelect: (nodeId: string, event: ThreeEvent<MouseEvent>) => void
  onHover: (nodeId: string | null) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const planetRef = useRef<THREE.Mesh>(null)
  const atmosphereRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const showLabel = selected || hovered
  const opacity = dimmed ? 0.22 : 1
  const glowOpacity = selected ? 0.3 : hovered ? 0.24 : active ? 0.14 : 0.08
  const targetScale = selected ? 1.1 : hovered ? 1.14 : 1
  const planetTexture = useTexture(planetProfile.texturePath)

  useEffect(() => {
    planetTexture.colorSpace = THREE.SRGBColorSpace
    planetTexture.wrapS = THREE.RepeatWrapping
    planetTexture.wrapT = THREE.ClampToEdgeWrapping
    planetTexture.needsUpdate = true
  }, [planetTexture])

  useFrame(({ clock }, delta) => {
    if (groupRef.current) {
      const nextScale = THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, hovered ? 11 : 8, delta)
      groupRef.current.scale.setScalar(nextScale)
      groupRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.34 + size * 0.06) * 5
    }

    if (planetRef.current) {
      planetRef.current.rotation.y += delta * 0.18
      planetRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.12 + size) * 0.05
    }

    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y -= delta * 0.08
    }

    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.04
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {planetProfile.ringColor ? (
        <mesh ref={ringRef} rotation={[Math.PI / 2.65, 0, planetProfile.ringTilt ?? 0]}>
          <ringGeometry args={[size * 1.34, size * 1.9, 96]} />
          <meshBasicMaterial
            color={planetProfile.ringColor}
            transparent
            opacity={(selected ? 0.44 : hovered ? 0.34 : 0.22) * opacity}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ) : null}

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
        <sphereGeometry args={[size * 1.02, 36, 36]} />
        <meshPhysicalMaterial
          map={planetTexture}
          color={planetProfile.surfaceTint}
          roughness={planetProfile.roughness}
          metalness={planetProfile.metalness}
          clearcoat={0.1}
          clearcoatRoughness={0.8}
          emissive={mixColor(accentColor, planetProfile.haloColor, 0.28)}
          emissiveIntensity={(selected ? 0.16 : hovered ? 0.1 : active ? 0.07 : 0.03) * opacity}
          transparent
          opacity={opacity}
        />
      </mesh>

      <mesh ref={planetRef}>
        <sphereGeometry args={[size * 0.96, 42, 42]} />
        <meshPhysicalMaterial
          map={planetTexture}
          color={planetProfile.surfaceTint}
          roughness={Math.min(1, planetProfile.roughness + 0.02)}
          metalness={planetProfile.metalness}
          clearcoat={0.06}
          clearcoatRoughness={0.86}
          emissive={mixColor(accentColor, planetProfile.haloColor, 0.16)}
          emissiveIntensity={(selected ? 0.12 : hovered ? 0.08 : active ? 0.04 : 0.015) * opacity}
          transparent
          opacity={opacity}
        />
      </mesh>

      <mesh ref={atmosphereRef} scale={1.08}>
        <sphereGeometry args={[size * 0.98, 32, 32]} />
        <meshBasicMaterial
          color={planetProfile.atmosphereColor}
          transparent
          opacity={(selected ? 0.18 : hovered ? 0.14 : 0.08) * opacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <sprite scale={[size * 4.8, size * 4.8, 1]} position={[0, 0, -2.5]}>
        <spriteMaterial
          map={glowTexture}
          color={mixColor(planetProfile.haloColor, accentColor, 0.28)}
          transparent
          opacity={glowOpacity * opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      <Html center distanceFactor={11} position={[0, -size * 2.05, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`cosmic-label ${labelClassName ?? ''} ${showLabel ? 'cosmic-label-visible' : ''} ${selected ? 'cosmic-label-selected' : ''}`}>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </Html>
    </group>
  )
}

const MemoHeroPlanetNode = memo(HeroPlanetNode)

function DestinyFluxNode({
  nodeId,
  position,
  size,
  accentColor,
  active,
  dimmed,
  selected,
  hovered,
  title,
  subtitle,
  labelClassName,
  glowTexture,
  pulseTexture,
  onSelect,
  onHover,
}: {
  nodeId: string
  position: [number, number, number]
  size: number
  accentColor: string
  active: boolean
  dimmed: boolean
  selected: boolean
  hovered: boolean
  title: string
  subtitle: string
  labelClassName?: string
  glowTexture: THREE.Texture
  pulseTexture: THREE.Texture
  onSelect: (nodeId: string, event: ThreeEvent<MouseEvent>) => void
  onHover: (nodeId: string | null) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const orbitRefA = useRef<THREE.Group>(null)
  const orbitRefB = useRef<THREE.Group>(null)
  const cometRef = useRef<THREE.Sprite>(null)
  const shellRef = useRef<THREE.Mesh>(null)
  const showLabel = selected || hovered
  const opacity = dimmed ? 0.18 : 1
  const targetScale = selected ? 1.08 : hovered ? 1.12 : 1
  const orbitPoints = useMemo(() => buildOrbitalPoints(size * 1.86, size * 1.12), [size])
  const ignition = active ? 1 : 0.55

  useFrame(({ clock }, delta) => {
    if (groupRef.current) {
      const nextScale = THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, hovered ? 12 : 9, delta)
      groupRef.current.scale.setScalar(nextScale)
      groupRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.54 + size) * 7
    }

    if (orbitRefA.current) {
      orbitRefA.current.rotation.z += delta * 0.36
    }

    if (orbitRefB.current) {
      orbitRefB.current.rotation.z -= delta * 0.28
      orbitRefB.current.rotation.x = Math.PI / 2.9
    }

    if (shellRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * (active ? 2.1 : 1.2) + size * 0.08) * (active ? 0.12 : 0.06)
      shellRef.current.scale.setScalar(pulse)
    }

    if (cometRef.current) {
      const angle = clock.elapsedTime * (active ? 1.36 : 0.72)
      cometRef.current.position.set(Math.cos(angle) * size * 1.86, Math.sin(angle) * size * 1.12, 0.8)
    }
  })

  return (
    <group ref={groupRef} position={position}>
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
        <sphereGeometry args={[size * 0.82, 28, 28]} />
        <meshStandardMaterial
          color={mixColor(accentColor, '#ffffff', 0.24)}
          emissive={accentColor}
          emissiveIntensity={(selected ? 1.95 : hovered ? 1.48 : active ? 1.2 : 0.82) * opacity}
          roughness={0.28}
          metalness={0.04}
          transparent
          opacity={opacity}
        />
      </mesh>

      <mesh ref={shellRef} scale={1.08}>
        <sphereGeometry args={[size * 1.08, 24, 24]} />
        <meshBasicMaterial
          color={mixColor(accentColor, '#dfffff', 0.14)}
          transparent
          opacity={(selected ? 0.24 : hovered ? 0.18 : 0.12) * opacity * ignition}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <sprite scale={[size * 6.4, size * 6.4, 1]} position={[0, 0, -2]}>
        <spriteMaterial
          map={glowTexture}
          color={accentColor}
          transparent
          opacity={(selected ? 0.46 : hovered ? 0.36 : active ? 0.28 : 0.18) * opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      <group ref={orbitRefA}>
        <Line points={orbitPoints} color={mixColor(accentColor, '#dff5ff', 0.18)} transparent opacity={(selected ? 0.94 : active ? 0.72 : 0.5) * opacity} lineWidth={1.2} depthWrite={false} />
      </group>

      <group ref={orbitRefB}>
        <Line points={orbitPoints} color={mixColor(accentColor, '#7ee7ff', 0.1)} transparent opacity={(selected ? 0.52 : active ? 0.34 : 0.22) * opacity} lineWidth={0.8} depthWrite={false} dashed dashSize={9} gapSize={6} />
      </group>

      <sprite ref={cometRef} scale={[size * 1.22, size * 1.22, 1]} position={[size * 1.86, 0, 0.8]}>
        <spriteMaterial
          map={pulseTexture}
          color={mixColor(accentColor, '#eafcff', 0.12)}
          transparent
          opacity={(selected ? 0.92 : hovered ? 0.76 : active ? 0.66 : 0.42) * opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      <Html center distanceFactor={11} position={[0, -size * 2.28, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`cosmic-label ${labelClassName ?? ''} ${showLabel ? 'cosmic-label-visible' : ''} ${selected ? 'cosmic-label-selected' : ''}`}>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </Html>
    </group>
  )
}

const MemoDestinyFluxNode = memo(DestinyFluxNode)

function DeepSpaceBackdrop() {
  const brightField = useMemo(
    () => buildCelestialStarfieldData('bright-field', 220, { minRadius: 3200, maxRadius: 6800, brightnessRange: [0.74, 1] }),
    [],
  )
  const stellarField = useMemo(
    () => buildCelestialStarfieldData('stellar-field', 2600, { minRadius: 4200, maxRadius: 10800, brightnessRange: [0.12, 0.56] }),
    [],
  )
  const milkyWayStars = useMemo(
    () =>
      buildCelestialStarfieldData('milky-way-stars', 3000, {
        minRadius: 5600,
        maxRadius: 11800,
        band: true,
        bandSpread: 0.19,
        brightnessRange: [0.16, 0.64],
      }),
    [],
  )
  const deepField = useMemo(
    () =>
      buildCelestialStarfieldData('deep-field', 1800, {
        minRadius: 9000,
        maxRadius: 14500,
        band: true,
        bandSpread: 0.34,
        brightnessRange: [0.05, 0.18],
      }),
    [],
  )
  const milkyWayTexture = useMemo(() => buildMilkyWayTexture('milky-way-band'), [])
  const brightFieldRef = useRef<THREE.PointsMaterial>(null)
  const stellarFieldRef = useRef<THREE.PointsMaterial>(null)
  const milkyWayFieldRef = useRef<THREE.PointsMaterial>(null)
  const deepFieldRef = useRef<THREE.PointsMaterial>(null)
  const milkyWayBandRef = useRef<THREE.Group>(null)
  const camera = useThree((state) => state.camera)

  useFrame(({ clock }) => {
    const zoomFactor = clamp((camera.position.length() - 1500) / 5200, 0, 1)

    if (brightFieldRef.current) {
      brightFieldRef.current.opacity = mix(0.72, 0.92, zoomFactor)
      brightFieldRef.current.size = mix(2.2, 2.8, zoomFactor)
    }

    if (stellarFieldRef.current) {
      stellarFieldRef.current.opacity = mix(0.18, 0.28, zoomFactor)
      stellarFieldRef.current.size = mix(0.8, 1.18, zoomFactor)
    }

    if (milkyWayFieldRef.current) {
      milkyWayFieldRef.current.opacity = mix(0.16, 0.34, zoomFactor)
      milkyWayFieldRef.current.size = mix(0.86, 1.28, zoomFactor)
    }

    if (deepFieldRef.current) {
      deepFieldRef.current.opacity = mix(0.02, 0.08, zoomFactor)
      deepFieldRef.current.size = mix(0.42, 0.66, zoomFactor)
    }

    if (milkyWayBandRef.current) {
      milkyWayBandRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.012) * 0.03
      milkyWayBandRef.current.children.forEach((child, index) => {
        const sprite = child as THREE.Sprite
        const material = sprite.material as THREE.SpriteMaterial
        material.opacity = mix(index === 0 ? 0.05 : 0.025, index === 0 ? 0.12 : 0.06, zoomFactor)
      })
    }
  })

  return (
    <group>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[brightField.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[brightField.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={brightFieldRef}
          size={2.2}
          sizeAttenuation
          transparent
          opacity={0.72}
          depthWrite={false}
          vertexColors
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stellarField.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[stellarField.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={stellarFieldRef}
          size={0.8}
          sizeAttenuation
          transparent
          opacity={0.18}
          depthWrite={false}
          vertexColors
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[milkyWayStars.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[milkyWayStars.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={milkyWayFieldRef}
          size={0.86}
          sizeAttenuation
          transparent
          opacity={0.16}
          depthWrite={false}
          vertexColors
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[deepField.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[deepField.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={deepFieldRef}
          size={0.42}
          sizeAttenuation
          transparent
          opacity={0.02}
          depthWrite={false}
          vertexColors
          blending={THREE.AdditiveBlending}
        />
      </points>

      <group ref={milkyWayBandRef} rotation={[-0.88, 0.42, 0.28]}>
        <sprite position={[0, 0, -7600]} scale={[12000, 2200, 1]}>
          <spriteMaterial map={milkyWayTexture} color="#f0e4c9" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
        <sprite position={[360, 120, -9200]} scale={[14000, 2400, 1]}>
          <spriteMaterial map={milkyWayTexture} color="#a9c0ff" transparent opacity={0.025} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
    </group>
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
        <span className="cosmic-region-label-feedback">{formatRegionFeedback(model, language)}</span>
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
      desiredTargetRef.current = null
      desiredCameraRef.current = null
      return
    }

    const controls = controlsRef.current
    const desiredTarget = new THREE.Vector3(...focusTarget.center)
    const anchorTarget = controls?.target?.clone() ?? new THREE.Vector3()
    const offset = camera.position.clone().sub(anchorTarget)
    if (offset.lengthSq() < 0.001) {
      offset.set(0, 0.22, 1)
    }
    offset.normalize().multiplyScalar(focusTarget.distance)
    offset.y += Math.max(160, focusTarget.distance * 0.16)
    const desiredCamera = desiredTarget.clone().add(offset)
    desiredTargetRef.current = desiredTarget
    desiredCameraRef.current = desiredCamera
  }, [camera, controlsRef, focusTarget])

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
            <span className="cosmic-region-chip-feedback">{formatRegionFeedback(region, language)}</span>
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
  autoFocusTarget,
  onSelectNode,
}: ConstellationViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedRegionId, setFocusedRegionId] = useState<string | null>(null)
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null)
  const handledAutoFocusTokenRef = useRef<number | null>(null)
  const scene = useMemo(() => buildSceneModel(heroes, tasks, flows, selectedNodeId), [heroes, tasks, flows, selectedNodeId])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cameraRef = useRef<THREE.Camera | null>(null)
  const controlsRef = useRef<ControlsHandle | null>(null)
  const gestureRef = useRef<{ start: UiAnchor | null; dragged: boolean }>({ start: null, dragged: false })

  const nodeGlowTexture = useMemo(() => buildGlowTexture('rgba(142, 207, 255, 0.38)', 'rgba(142, 207, 255, 0)', 1.18), [])
  const pulseTexture = useMemo(() => buildGlowTexture('rgba(64, 224, 208, 0.92)', 'rgba(64, 224, 208, 0)', 1.22), [])
  const navigationRegions = useMemo(() => scene.constellations.filter((region) => region.navVisible), [scene.constellations])
  const activeRegionId =
    scene.constellations.find((region) =>
      selectedNodeId
        ? region.heroIds.includes(selectedNodeId) ||
          tasks.some((task) => task.taskId === selectedNodeId && task.selectedHeroIds.some((heroId) => region.heroIds.includes(heroId)))
        : false,
    )?.id ?? focusedRegionId

  useEffect(() => {
    if (!autoFocusTarget || handledAutoFocusTokenRef.current === autoFocusTarget.token) {
      return
    }

    const selectedTaskModel = scene.tasks.find((task) => task.task.taskId === autoFocusTarget.nodeId)
    if (selectedTaskModel) {
      setFocusedRegionId(null)
      setFocusTarget({
        id: selectedTaskModel.task.taskId,
        center: selectedTaskModel.position,
        distance: clamp(500 + selectedTaskModel.size * 5.5, 500, 840),
      })
      handledAutoFocusTokenRef.current = autoFocusTarget.token
      return
    }

    const selectedHeroModel = scene.heroes.find((hero) => hero.hero.heroId === autoFocusTarget.nodeId)
    if (selectedHeroModel) {
      setFocusedRegionId(null)
      setFocusTarget({
        id: selectedHeroModel.hero.heroId,
        center: selectedHeroModel.position,
        distance: clamp(360 + selectedHeroModel.size * 8.5, 360, 720),
      })
      handledAutoFocusTokenRef.current = autoFocusTarget.token
    }
  }, [autoFocusTarget, scene.heroes, scene.tasks])

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
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 180, 1180], fov: 42, near: 0.1, far: 18000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        eventPrefix="client"
        onCreated={(state) => {
          canvasRef.current = state.gl.domElement
          cameraRef.current = state.camera
        }}
        onPointerDown={(event) => {
          setFocusTarget(null)
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
        <color attach="background" args={['#010205']} />
        <fogExp2 attach="fog" args={['#02040a', 0.00009]} />
        <ambientLight intensity={0.22} />
        <directionalLight position={[-520, 420, 720]} intensity={1.15} color="#d9e7ff" />
        <pointLight position={[940, 180, 1160]} intensity={0.74} color="#7fb3ff" distance={5400} />
        <pointLight position={[-760, -160, -760]} intensity={0.38} color="#5fe2d8" distance={4800} />

        <DeepSpaceBackdrop />

        {scene.tasks.map((task) => (
          <MemoDestinyFluxNode
            key={task.task.taskId}
            nodeId={task.task.taskId}
            position={task.position}
            size={task.size}
            accentColor={task.statusColor}
            active={task.active}
            dimmed={task.dimmed}
            selected={task.selected}
            hovered={hoveredId === task.task.taskId}
            title={task.task.title.length > 34 ? `${task.task.title.slice(0, 34)}…` : task.task.title}
            subtitle={`${formatRoundLabel(task.task.verdictRound + 1, language)} · ${t(language, 'destiny_core')}`}
            labelClassName="cosmic-label-task"
            glowTexture={nodeGlowTexture}
            pulseTexture={pulseTexture}
            onSelect={(nodeId, event) => onSelectNode(nodeId, extractAnchor(event))}
            onHover={setHoveredId}
          />
        ))}

        <OrbitControls
          ref={(instance) => {
            controlsRef.current = instance as unknown as ControlsHandle | null
          }}
          onStart={() => setFocusTarget(null)}
          enableZoom
          enablePan
          enableRotate={false}
          enableDamping
          screenSpacePanning
          dampingFactor={0.09}
          panSpeed={1.12}
          zoomSpeed={0.88}
          minDistance={320}
          maxDistance={7800}
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
