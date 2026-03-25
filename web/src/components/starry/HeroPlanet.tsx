/**
 * Hero 星球组件
 * 每个 Hero 显示为一个星球，带状态反馈
 */

import { Html, OrbitControls, Sphere } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { memo, useRef, useState } from 'react'
import * as THREE from 'three'

import type { HeroState } from '../../types'

interface HeroPlanetProps {
  hero: HeroState
  position: [number, number, number]
  size?: number
  selected?: boolean
  onClick?: (heroId: string) => void
}

/**
 * Hero 状态颜色映射
 */
const HERO_STATUS_COLORS: Record<string, string> = {
  idle: '#4a90d9',      // 蓝色 - 空闲
  routing: '#f5a623',   // 橙色 - 路由中
  consulting: '#9013fe',// 紫色 - 协商中
  running: '#50e3c2',   // 青色 - 运行中
  recovering: '#ff5e57',// 红色 - 恢复中
  error: '#ff3b30',     // 红色 - 错误
}

/**
 * Hero 类型颜色（用于星球主色调）
 */
const HERO_TYPE_COLORS: Record<string, string> = {
  coding: '#4a90d9',     // 蓝色
  writing: '#ff9500',    // 橙色
  design: '#ff2d55',     // 粉色
  analysis: '#5856d6',   // 紫色
  data: '#5ac8fa',       // 天蓝
  default: '#8e8e93',    // 灰色
}

export const HeroPlanet = memo(function HeroPlanet({
  hero,
  position,
  size = 2,
  selected = false,
  onClick,
}: HeroPlanetProps) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const glowRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)
  
  const statusColor = HERO_STATUS_COLORS[hero.status] || HERO_STATUS_COLORS.idle
  const typeColor = HERO_TYPE_COLORS[hero.type] || HERO_TYPE_COLORS.default
  
  // 脉动动画（工作中的 Hero）
  useFrame(({ clock }) => {
    if (meshRef.current && hero.status !== 'idle') {
      const t = clock.getElapsedTime()
      const scale = 1 + Math.sin(t * 2) * 0.05 // 5% 脉动
      meshRef.current.scale.setScalar(scale)
    }
    
    // 光晕旋转
    if (glowRef.current) {
      glowRef.current.rotation.z += 0.001
    }
  })
  
  const handleClick = () => {
    onClick?.(hero.heroId)
  }
  
  return (
    <group position={position}>
      {/* 光晕层（工作状态可见） */}
      {hero.status !== 'idle' && (
        <mesh ref={glowRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 1.2, size * 1.3, 32]} />
          <meshBasicMaterial
            color={statusColor}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      
      {/* 星球主体 */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial
          color={typeColor}
          emissive={statusColor}
          emissiveIntensity={hovered || selected ? 0.5 : 0.2}
          roughness={0.7}
          metalness={0.3}
        />
      </mesh>
      
      {/* 选中标记 */}
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 1.5, size * 1.6, 4]} />
          <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
        </mesh>
      )}
      
      {/* 标签（始终面向相机） */}
      <Html distanceFactor={100} zIndexRange={[100, 0]}>
        <div
          style={{
            position: 'absolute',
            top: -40,
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: '600',
            textShadow: '0 0 10px rgba(0,0,0,0.8)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            opacity: hovered || selected ? 1 : 0.7,
            transition: 'opacity 0.2s',
          }}
        >
          {hero.displayName || hero.heroId}
          {hero.status !== 'idle' && (
            <div
              style={{
                fontSize: '10px',
                opacity: 0.8,
                marginTop: '2px',
              }}
            >
              {hero.status}
            </div>
          )}
        </div>
      </Html>
    </group>
  )
})
