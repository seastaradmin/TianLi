/**
 * 深空背景
 * 纯深色背景，让程序生成的恒星成为主角
 */

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

/**
 * 深空背景 - 禁用银河图片，使用纯净深色背景
 */
export function NasaMilkyWayBackground() {
  const meshRef = useRef<THREE.Mesh>(null!)
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.00001
    }
  })
  
  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 64, 32]} />
      <meshBasicMaterial
        side={THREE.BackSide}
        color="#020205"
      />
    </mesh>
  )
}

/**
 * NASA 恒星地图背景
 * 来源：NASA 公开资源
 */
export function NasaStarsBackground() {
  const meshRef = useRef<THREE.Mesh>(null!)
  
  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[450, 32, 32]} />
      <meshBasicMaterial
        map={new THREE.TextureLoader().load('/textures/stars/stars_map.png')}
        side={THREE.BackSide}
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

/**
 * 深空背景渐变（备用方案）
 */
export function DeepSpaceBackground() {
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 32, 32]} />
      <meshBasicMaterial
        side={THREE.BackSide}
        color="#050510"
      />
    </mesh>
  )
}
