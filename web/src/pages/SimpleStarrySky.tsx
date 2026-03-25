/**
 * 极简星空页面 - 基于 ConstellationView 优化
 * 只保留星空背景，让星星更明显
 */

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { createRoot } from 'react-dom/client'

/**
 * 生成星空数据
 */
function buildStarfield(count: number = 10000, radius: number = 400) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  
  // 恒星光谱颜色（真实分布）
  const spectralColors = [
    [0.5, 0.7, 1.0],    // O/B: 蓝白
    [0.8, 0.9, 1.0],    // A: 白色
    [1.0, 0.95, 0.8],   // F: 黄白
    [1.0, 0.9, 0.6],    // G: 黄色
    [1.0, 0.75, 0.5],   // K: 橙色
    [1.0, 0.5, 0.4],    // M: 红色
  ]
  
  for (let i = 0; i < count; i++) {
    // 球面均匀分布
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius
    positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius
    positions[i * 3 + 2] = Math.cos(phi) * radius
    
    // 随机光谱类型（更多红矮星）
    const spectralIndex = Math.random() < 0.76 ? 5 :  // M: 76%
                         Math.random() < 0.88 ? 4 :  // K: 12%
                         Math.random() < 0.96 ? 3 :  // G: 8%
                         Math.random() < 0.99 ? 2 :  // F: 3%
                         Math.random() < 0.999 ? 1 : // A: 0.6%
                         0                            // O/B: 0.1%
    
    const [r, g, b] = spectralColors[spectralIndex]
    
    // 亮度变化
    const brightness = 0.5 + Math.random() * 0.5
    
    colors[i * 3] = r * brightness
    colors[i * 3 + 1] = g * brightness
    colors[i * 3 + 2] = b * brightness
  }
  
  return { positions, colors }
}

function StarrySky() {
  const starsRef = useRef<THREE.Points>(null!)
  const [loaded, setLoaded] = useState(false)
  
  const starData = useMemo(() => buildStarfield(10000, 400), [])
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true)
      document.getElementById('loading')?.classList.add('hidden')
    }, 1000)
    return () => clearTimeout(timer)
  }, [])
  
  useEffect(() => {
    if (starsRef.current && starData) {
      const geometry = starsRef.current.geometry as THREE.BufferGeometry
      geometry.setAttribute('position', new THREE.BufferAttribute(starData.positions, 3))
      geometry.setAttribute('color', new THREE.BufferAttribute(starData.colors, 3))
    }
  }, [starData])
  
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas camera={{ position: [0, 0, 60], fov: 70 }}>
        <color attach="background" args={['#000008']} />
        
        {/* 星空 - 超大超亮 */}
        <points ref={starsRef}>
          <bufferGeometry />
          <pointsMaterial
            size={8}
            vertexColors
            transparent
            opacity={1.0}
            sizeAttenuation={false}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </points>
        
        {/* 相机控制 */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={40}
          maxDistance={120}
          autoRotate
          autoRotateSpeed={0.5}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
      
      {/* 底部输入框 */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(500px, 80vw)',
        }}
      >
        <input
          type="text"
          placeholder="输入任务..."
          style={{
            width: '100%',
            padding: '14px 20px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '999px',
            color: '#fff',
            fontSize: '15px',
            outline: 'none',
            backdropFilter: 'blur(10px)',
          }}
        />
      </div>
    </div>
  )
}

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<StarrySky />)
}
