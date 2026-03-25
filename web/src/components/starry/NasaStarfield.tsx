/**
 * NASA 真实星空背景
 * 
 * 使用 Hipparcos 星表数据渲染真实恒星位置
 * 包含 200+ 颗真实亮星 + 4800 颗模拟暗星
 */

import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { generateFaintStars, getStarColor, HIPPARCOS_BRIGHT_STARS } from '../../data/hipparcos-stars'

interface StarfieldProps {
  starCount?: number
  starSize?: number
  rotationSpeed?: number
}

export function NasaStarfield({
  starCount = 5000,
  starSize = 0.3,
  rotationSpeed = 0.00005,
}: StarfieldProps) {
  const starsRef = useRef<THREE.Points>(null!)
  const timeRef = useRef(0)
  
  // 合并真实亮星和模拟暗星
  const allStars = useMemo(() => {
    const brightStars = HIPPARCOS_BRIGHT_STARS.map(([ra, dec, mag, spec]) => [
      ra,
      dec,
      mag,
      spec,
    ] as [number, number, number, number])
    
    const faintStars = generateFaintStars(starCount - brightStars.length)
    
    return [...brightStars, ...faintStars]
  }, [starCount])
  
  // 创建几何体和材质
  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(allStars.length * 3)
    const colors = new Float32Array(allStars.length * 3)
    const sizes = new Float32Array(allStars.length)
    
    allStars.forEach(([raDeg, decDeg, magnitude, spectralType], i) => {
      // 角度转弧度
      const ra = (raDeg * Math.PI) / 180
      const dec = (decDeg * Math.PI) / 180
      
      // 球坐标转笛卡尔坐标
      const radius = 100 // 星空球半径
      const x = radius * Math.cos(dec) * Math.cos(ra)
      const y = radius * Math.sin(dec)
      const z = radius * Math.cos(dec) * Math.sin(ra)
      
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      
      // 获取恒星真实颜色（基于光谱类型）- 增强饱和度
      const [r, g, b] = getStarColor(spectralType)
      
      // 根据视星等设置亮度 - 增强对比
      // 视星等越小越亮，负数表示非常亮
      let brightness: number
      if (magnitude < 0) {
        brightness = 2.0 // 天狼星等超亮星
      } else if (magnitude < 1) {
        brightness = 1.5 // 一等星
      } else if (magnitude < 2) {
        brightness = 1.2 // 二等星
      } else if (magnitude < 3) {
        brightness = 0.9 // 三等星
      } else {
        brightness = Math.max(0.4, 1 - magnitude / 8) // 暗星
      }
      
      // 增强颜色饱和度
      const saturationBoost = 1.3
      colors[i * 3] = Math.min(1.0, r * saturationBoost * brightness)
      colors[i * 3 + 1] = Math.min(1.0, g * saturationBoost * brightness)
      colors[i * 3 + 2] = Math.min(1.0, b * saturationBoost * brightness)
      
      // 大小与亮度相关 - 增强尺寸差异
      let starScale: number
      if (magnitude < 0) {
        starScale = starSize * 5 // 天狼星等超亮星 - 非常明显
      } else if (magnitude < 1) {
        starScale = starSize * 3.5 // 一等星 - 明显
      } else if (magnitude < 2) {
        starScale = starSize * 2.5 // 二等星
      } else if (magnitude < 3) {
        starScale = starSize * 1.8 // 三等星
      } else if (magnitude < 4) {
        starScale = starSize * 1.3
      } else {
        starScale = starSize // 暗星
      }
      sizes[i] = starScale
    })
    
    return { positions, colors, sizes }
  }, [allStars, starSize])
  
  // 缓慢旋转星空 + 闪烁效果
  useFrame((_, delta) => {
    timeRef.current += delta
    if (starsRef.current) {
      starsRef.current.rotation.y += rotationSpeed * delta * 1000
      
      // 闪烁效果（通过修改 uniform）
      // 这里简单实现，更复杂的话需要 custom shader
    }
  })
  
  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={sizes.length}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexColors
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        transparent
        uniform
        // 自定义着色器实现更好的星星渲染
        vertexShader={`
          attribute float size;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          void main() {
            // 圆形星星
            float r = distance(gl_PointCoord, vec2(0.5));
            if (r > 0.5) discard;
            
            // 柔和边缘
            float glow = 1.0 - (r * 2.0);
            glow = pow(glow, 1.5);
            
            gl_FragColor = vec4(vColor, glow);
          }
        `}
      />
    </points>
  )
}

/**
 * NASA 银河背景球面
 * 使用程序生成的银河带 + 星云效果
 */
export function MilkyWayBackground() {
  const meshRef = useRef<THREE.Mesh>(null!)
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.00002
    }
  })
  
  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 64, 64]} />
      <shaderMaterial
        side={THREE.BackSide}
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
          varying vec2 vUv;
          varying vec3 vPosition;
          
          // 简单的噪声函数
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
            // 深空背景色 - 更暗
            vec3 bgColor = vec3(0.01, 0.01, 0.02);
            
            // 银河带（沿赤道）- 更暗，不抢星星
            float galacticBand = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 3.0);
            vec3 galacticColor = vec3(0.05, 0.07, 0.12) * galacticBand * 0.2;
            
            // 星云效果 - 更淡
            float cloud = noise(vUv * 3.0) * noise(vUv * 6.0 + 0.5);
            vec3 nebulaColor = vec3(0.08, 0.05, 0.1) * cloud * galacticBand * 0.15;
            
            // 随机暗星 - 更暗
            float starNoise = noise(vUv * 200.0);
            vec3 stars = vec3(step(0.999, starNoise)) * 0.15;
            
            vec3 finalColor = bgColor + galacticColor + nebulaColor + stars;
            gl_FragColor = vec4(finalColor, 1.0);
          }
        `}
      />
    </mesh>
  )
}
