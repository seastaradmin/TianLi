/**
 * 星空主场景 - 无外部依赖版本
 * 所有资源都是程序生成，不需要加载外部图片
 */

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { memo, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { HeroState } from '../../types'
import { HeroPlanet } from './HeroPlanet'
import { RealisticStarfield } from './RealisticStarfield'

/**
 * 程序生成的银河背景（无外部依赖）
 */
function ProceduralMilkyWay() {
  const meshRef = useRef<THREE.Mesh>(null!)
  
  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 32, 32]} />
      <shaderMaterial
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          time: { value: 0 },
          color1: { value: new THREE.Color(0x0a0a1a) },
          color2: { value: new THREE.Color(0x1a0a2e) },
          color3: { value: new THREE.Color(0x0a1a2e) },
        }}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vPosition;
          void main() {
            vUv = uv;
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 color1;
          uniform vec3 color2;
          uniform vec3 color3;
          varying vec2 vUv;
          varying vec3 vPosition;
          
          float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
          }
          
          float noise(vec2 st) {
            vec2 i = floor(st);
            vec2 f = fract(st);
            float a = random(i);
            float b = random(i + vec2(1.0, 0.0));
            float c = random(i + vec2(0.0, 1.0));
            float d = random(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
          }
          
          void main() {
            vec3 dir = normalize(vPosition);
            
            // 银河带
            float band = 1.0 - abs(dir.y) * 2.0;
            band = pow(max(0.0, band), 3.0);
            
            // 多层噪声
            float n1 = noise(vUv * 3.0);
            float n2 = noise(vUv * 6.0);
            float cloud = n1 * 0.5 + n2 * 0.3;
            
            // 颜色混合
            vec3 color = mix(color1, color2, cloud);
            color = mix(color, color3, band * 0.5);
            
            float alpha = band * 0.4 + cloud * 0.2;
            
            gl_FragColor = vec4(color, alpha);
          }
        `}
      />
    </mesh>
  )
}

/**
 * 深空背景渐变
 */
function DeepSpaceBackground() {
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

interface StarSceneProps {
  heroes: HeroState[]
  selectedHeroId?: string | null
  onHeroClick?: (heroId: string) => void
}

/**
 * 计算 Hero 星球在星空中的位置
 */
function calculateHeroPositions(heroes: HeroState[], radius: number = 30) {
  const positions: Map<string, [number, number, number]> = new Map()
  
  heroes.forEach((hero, index) => {
    const total = heroes.length
    const phi = Math.acos(-1 + (2 * index) / total)
    const theta = Math.sqrt(total * Math.PI) * phi
    
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
        dpr={[1, 2]}
      >
        {/* 深空背景 */}
        <DeepSpaceBackground />
        
        {/* 程序生成银河 */}
        <ProceduralMilkyWay />
        
        {/* 真实星空（8000 颗恒星，基于光谱分布） */}
        <RealisticStarfield starCount={8000} twinkleSpeed={1.5} exposure={1.5} />
        
        {/* 环境光 */}
        <ambientLight intensity={0.2} />
        
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
