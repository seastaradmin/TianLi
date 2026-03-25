/**
 * NASA 真实星空背景
 * 使用本地存储的 NASA/ESO 公开天文照片
 * 
 * 图片来源：
 * - ESO 银河系全景图：eso1925a.jpg
 * - NASA 恒星地图：stars_map.png
 * 
 * 下载说明：见 /public/textures/stars/README.md
 */

import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useState } from 'react'
import * as THREE from 'three'

/**
 * ESO 银河系全景背景
 * 来源：https://www.eso.org/public/images/eso1925a/
 */
export function NasaMilkyWayBackground() {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [loaded, setLoaded] = useState(false)
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.00002
    }
  })
  
  // 尝试加载本地 NASA 图片，失败则使用程序生成
  const texture = loaded 
    ? new THREE.TextureLoader().load('/textures/stars/milkyway.jpg')
    : null
  
  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 64, 32]} />
      {texture ? (
        <meshBasicMaterial
          map={texture}
          side={THREE.BackSide}
          transparent
          opacity={0.8}
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <meshBasicMaterial
          side={THREE.BackSide}
          color="#0a0a1a"
        />
      )}
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
