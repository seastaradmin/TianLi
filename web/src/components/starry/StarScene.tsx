/**
 * 星空主场景
 * 整合星空背景、Hero 星球、任务流
 */

import { Canvas, useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Suspense, memo, useMemo } from 'react'
import { TextureLoader } from 'three'
import * as THREE from 'three'

import type { HeroState } from '../../types'
import { HeroPlanet } from './HeroPlanet'
import { NasaMilkyWayBackground, ProceduralNebulaBackground } from './NasaBackground'
import { RealisticStarfield } from './RealisticStarfield'

interface StarSceneProps {
  heroes: HeroState[]
  selectedHeroId?: string | null
  onHeroClick?: (heroId: string) => void
}

/**
 * 计算 Hero 星球在星空中的位置
 * 使用球面分布，避免重叠
 */
function calculateHeroPositions(heroes: HeroState[], radius: number = 30) {
  const positions: Map<string, [number, number, number]> = new Map()
  
  // 简单分布：按索引均匀分布在球面上
  heroes.forEach((hero, index) => {
    const total = heroes.length
    const phi = Math.acos(-1 + (2 * index) / total) // 极角
    const theta = Math.sqrt(total * Math.PI) * phi // 方位角
    
    const x = radius * Math.sin(phi) * Math.cos(theta)
    const y = radius * Math.sin(phi) * Math.sin(theta)
    const z = radius * Math.cos(phi)
    
    positions.set(hero.heroId, [x, y, z])
  })
  
  return positions
}

export const StarScene = memo(function StarScene({
  heroes,
  selectedHeroId,
  onHeroClick,
}: StarSceneProps) {
  const heroPositions = useMemo(
    () => calculateHeroPositions(heroes),
    [heroes]
  )
  
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 80], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]} // 高分屏支持
      >
        {/* NASA 真实银河背景 */}
        <Suspense fallback={null}>
          <NasaMilkyWayBackground />
        </Suspense>
        
        {/* 真实星空（15000+ 颗恒星，超亮模式） */}
        <RealisticStarfield starCount={15000} twinkleSpeed={2.0} exposure={2.5} />
        
        {/* 环境光 */}
        <ambientLight intensity={0.2} />
        
        {/* 平行光（模拟遥远恒星） */}
        <directionalLight position={[100, 50, 100]} intensity={0.5} />
        
        {/* Hero 星球 */}
        {heroes.map((hero) => {
          const position = heroPositions.get(hero.heroId) || [0, 0, 0]
          return (
            <HeroPlanet
              key={hero.heroId}
              hero={hero}
              position={position}
              size={2.5}
              selected={hero.heroId === selectedHeroId}
              onClick={onHeroClick}
            />
          )
        })}
        
        {/* 相机控制 */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={40}
          maxDistance={150}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  )
})
