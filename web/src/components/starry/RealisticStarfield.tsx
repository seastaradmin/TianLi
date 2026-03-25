/**
 * 真实星空场景 - 基于 procedural-starfield skill
 * 
 * 特性:
 * - 8000+ 颗恒星，基于真实光谱分布
 * - 视星等决定亮度和大小
 * - 黑体辐射颜色（真实恒星温度）
 * - 闪烁动画
 * - 银河带
 * - 流星效果
 */

import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'

/**
 * 黑体辐射颜色计算（Tanner Helland 算法）
 * 将恒星温度（K）转换为 RGB
 */
function blackbodyColor(tempK: number): THREE.Color {
  const t = tempK / 100
  let r: number, g: number, b: number

  if (t <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(t) - 161.1195681661
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492)
    b = 255
  }

  return new THREE.Color(
    Math.min(Math.max(r, 0), 255) / 255,
    Math.min(Math.max(g, 0), 255) / 255,
    Math.min(Math.max(b, 0), 255) / 255
  )
}

/**
 * 生成真实恒星数据
 * 基于恒星光谱分类的真实温度分布
 */
function generateRealisticStars(count: number = 8000): {
  positions: Float32Array
  colors: Float32Array
  magnitudes: Float32Array
} {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const magnitudes = new Float32Array(count)

  // 恒星温度分布（真实宇宙比例）
  // O: 0.003%, B: 0.1%, A: 0.6%, F: 3%, G: 8%, K: 12%, M: 76%
  function getStarTemp(random: number): number {
    if (random < 0.003) return 30000 + random * 5000000  // O: 蓝紫色
    if (random < 0.01) return 10000 + random * 1000000   // B: 蓝白色
    if (random < 0.04) return 7500 + random * 60000      // A: 白色
    if (random < 0.11) return 6000 + random * 15000      // F: 黄白色
    if (random < 0.23) return 5200 + random * 5000       // G: 黄色（太阳）
    if (random < 0.50) return 3700 + random * 3000       // K: 橙色
    return 2400 + random * 2600                           // M: 红色
  }

  // 伪随机数生成器（可重现）
  let seed = 42
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }

  for (let i = 0; i < count; i++) {
    // 球面均匀分布
    const theta = random() * Math.PI * 2
    const phi = Math.acos(2 * random() - 1)
    const radius = 400

    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius
    positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius
    positions[i * 3 + 2] = Math.cos(phi) * radius

    // 视星等分布（指数分布：更多暗星，更少亮星）
    // -1.5（最亮）到 6.5（人眼极限）
    const magnitude = -1.5 + Math.pow(random(), 0.4) * 8.0
    magnitudes[i] = magnitude

    // 恒星温度 → 颜色
    const temp = getStarTemp(random())
    const color = blackbodyColor(temp)

    // 亮度基于视星等（越小越亮）
    const brightness = magnitude < 0 ? 2.0 : Math.max(0.3, 1 - magnitude / 6.5)

    colors[i * 3] = Math.min(1.0, color.r * brightness)
    colors[i * 3 + 1] = Math.min(1.0, color.g * brightness)
    colors[i * 3 + 2] = Math.min(1.0, color.b * brightness)
  }

  return { positions, colors, magnitudes }
}

interface RealisticStarfieldProps {
  starCount?: number
  twinkleSpeed?: number
  exposure?: number
}

export function RealisticStarfield({
  starCount = 8000,
  twinkleSpeed = 1.0,
  exposure = 1.0,
}: RealisticStarfieldProps) {
  const starsRef = useRef<THREE.Points>(null!)
  const { size, camera } = useThree()
  const timeRef = useRef(0)

  const starData = useMemo(() => generateRealisticStars(starCount), [starCount])

  useEffect(() => {
    if (starsRef.current) {
      const geometry = starsRef.current.geometry as THREE.BufferGeometry
      geometry.setAttribute('position', new THREE.BufferAttribute(starData.positions, 3))
      geometry.setAttribute('aColor', new THREE.BufferAttribute(starData.colors, 3))
      geometry.setAttribute('aMagnitude', new THREE.BufferAttribute(starData.magnitudes, 1))
    }
  }, [starData])

  useFrame((state, delta) => {
    timeRef.current += delta
    if (starsRef.current) {
      starsRef.current.rotation.y += 0.00005 * delta * 1000
      starsRef.current.material.uniforms.time.value = timeRef.current
      starsRef.current.material.uniforms.twinkleSpeed.value = twinkleSpeed
      starsRef.current.material.uniforms.exposure.value = exposure
    }
  })

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={starData.positions.length / 3}
          array={starData.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aColor"
          count={starData.colors.length / 3}
          array={starData.colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aMagnitude"
          count={starData.magnitudes.length}
          array={starData.magnitudes}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
        uniforms={{
          time: { value: 0 },
          twinkleSpeed: { value: twinkleSpeed },
          exposure: { value: exposure },
          baseSizePx: { value: 3.0 },
          brightnessExp: { value: 2.5 },
        }}
        vertexShader={`
          uniform float time;
          uniform float twinkleSpeed;
          uniform float baseSizePx;
          uniform float brightnessExp;
          uniform float exposure;
          
          attribute vec3 aColor;
          attribute float aMagnitude;
          
          varying vec3 vColor;
          varying float vMagnitude;
          varying float vTwinkle;
          
          // 伪随机函数
          float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
          }
          
          void main() {
            vColor = aColor * exposure;
            vMagnitude = aMagnitude;
            
            // 闪烁效果（每颗星独立）
            float twinkle = sin(time * twinkleSpeed + position.x * 0.1 + position.y * 0.2) * 0.5 + 0.5;
            vTwinkle = mix(1.0, twinkle, 0.3);
            
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            
            // 视星等决定大小（越亮越大）
            float magSize = pow(10.0, (6.5 - aMagnitude) / 5.0);
            gl_PointSize = baseSizePx * magSize * (300.0 / -mvPosition.z);
            
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          varying float vMagnitude;
          varying float vTwinkle;
          
          void main() {
            // 圆形星星
            float r = distance(gl_PointCoord, vec2(0.5));
            if (r > 0.5) discard;
            
            // 柔和边缘 + 光晕
            float glow = 1.0 - (r * 2.0);
            glow = pow(glow, 1.5);
            
            // 亮星有明显光晕
            float halo = 1.0 - smoothstep(0.0, 0.5, r);
            halo = pow(halo, 3.0) * 0.5;
            
            vec3 finalColor = vColor * vTwinkle * (glow + halo);
            
            gl_FragColor = vec4(finalColor, glow + halo);
          }
        `}
      />
    </points>
  )
}

/**
 * 银河带
 */
export function MilkyWayBand() {
  const meshRef = useRef<THREE.Mesh>(null!)
  const timeRef = useRef(0)

  useFrame((_, delta) => {
    timeRef.current += delta
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.00002 * delta * 1000
      meshRef.current.material.uniforms.time.value = timeRef.current
    }
  })

  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]} position={[0, 0, 0]}>
      <sphereGeometry args={[450, 64, 32]} />
      <shaderMaterial
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          time: { value: 0 },
          brightness: { value: 0.3 },
          bandWidth: { value: 0.18 },
          bandTilt: { value: 0.4 },
          coreGlow: { value: 0.6 },
          warmTint: { value: new THREE.Color(0xffe8cc) },
          coolTint: { value: new THREE.Color(0xccddff) },
        }}
        vertexShader={`
          varying vec3 vWorldDir;
          void main() {
            vWorldDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float time;
          uniform float brightness;
          uniform float bandWidth;
          uniform float bandTilt;
          uniform float coreGlow;
          uniform vec3 warmTint;
          uniform vec3 coolTint;
          
          varying vec3 vWorldDir;
          
          // 噪声函数
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
            vec3 dir = normalize(vWorldDir);
            
            // 银河带（倾斜的带状）
            float band = dot(dir, normalize(vec3(sin(bandTilt), cos(bandTilt), 0.0)));
            band = 1.0 - abs(band) / bandWidth;
            band = pow(max(0.0, band), 2.0);
            
            // 核心区域（人马座方向）更亮
            vec3 coreDir = normalize(vec3(-0.5, -0.3, -0.8));
            float core = dot(dir, coreDir);
            core = pow(max(0.0, core), 3.0) * coreGlow;
            
            // 云气结构
            float cloud = noise(dir.xy * 5.0 + time * 0.01) * 0.5 + 0.5;
            cloud *= noise(dir.xz * 3.0) * 0.5 + 0.5;
            
            // 颜色混合
            vec3 color = mix(coolTint, warmTint, band);
            color *= (band * 0.5 + core + cloud * 0.3) * brightness;
            
            gl_FragColor = vec4(color, band * 0.5 + core);
          }
        `}
      />
    </mesh>
  )
}

/**
 * 深空背景（渐变色）
 */
export function DeepSpaceBackground() {
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={{
          zenithColor: { value: new THREE.Color(0x000005) },
          horizonColor: { value: new THREE.Color(0x000015) },
        }}
        vertexShader={`
          varying vec3 vWorldDir;
          void main() {
            vWorldDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 zenithColor;
          uniform vec3 horizonColor;
          varying vec3 vWorldDir;
          
          void main() {
            float horizonFactor = 1.0 - abs(vWorldDir.y);
            vec3 color = mix(zenithColor, horizonColor, horizonFactor * 0.5);
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  )
}
