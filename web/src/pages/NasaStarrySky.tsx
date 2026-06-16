/**
 * NASA 真实星空页面
 * 使用 NASA/ESO 真实天文照片 + 程序生成星星
 */

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'

function NasaSky() {
  const [loaded, setLoaded] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true)
      document.getElementById('loading')?.classList.add('hidden')
    }, 2000)
    return () => clearTimeout(timer)
  }, [])
  
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas camera={{ position: [0, 0, 50], fov: 75 }}>
        {/* 背景色 */}
        <color attach="background" args={['#000005']} />
        
        {/* 超亮星星 - 15000 颗 */}
        <Stars
          radius={400}
          depth={100}
          count={15000}
          factor={8}
          saturation={1.5}
          fade
          speed={2}
        />
        
        {/* 环境光 */}
        <ambientLight intensity={0.1} />
        
        {/* 相机控制 */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={30}
          maxDistance={100}
          autoRotate
          autoRotateSpeed={0.3}
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
  root.render(<NasaSky />)
}
