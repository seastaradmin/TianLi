/**
 * NASA 真实星空背景
 * 使用 NASA/ESO 公开的天文照片作为球面纹理
 * 
 * 图片来源：
 * - NASA APOD (Astronomy Picture of the Day)
 * - ESO 银河系全景图
 * - Hubble 深空场
 */

import { useTexture } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'

/**
 * NASA 银河系全景图背景
 * 使用 ESO 的银河系 360° 全景照片
 */
export function NasaMilkyWayBackground() {
  // 使用高分辨率银河系全景图
  // 来源：https://www.eso.org/public/images/eso1925a/
  const texture = useTexture('https://cdn.eso.org/images/large/eso1925a.jpg')
  
  const meshRef = useRef<THREE.Mesh>(null!)
  
  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 64, 32]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        transparent
        opacity={0.8}
      />
    </mesh>
  )
}

/**
 * Hubble 深空场背景
 * 显示遥远星系
 */
export function HubbleDeepFieldBackground() {
  // Hubble 超深空场
  const texture = useTexture('https://www.nasa.gov/sites/default/files/thumbnails/image/heic0406a.jpg')
  
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 32, 32]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        transparent
        opacity={0.6}
      />
    </mesh>
  )
}

/**
 * 程序生成星云背景（备用方案）
 * 当无法加载 NASA 图片时使用
 */
export function ProceduralNebulaBackground() {
  const meshRef = useRef<THREE.Mesh>(null!)
  
  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 64, 32]} />
      <shaderMaterial
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        uniforms={{
          time: { value: 0 },
          color1: { value: new THREE.Color(0x1a0a2e) },
          color2: { value: new THREE.Color(0x0a1a2e) },
          color3: { value: new THREE.Color(0x2e0a1a) },
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
          uniform float time;
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
            
            // 多层噪声生成星云
            float n1 = noise(vUv * 3.0 + time * 0.01);
            float n2 = noise(vUv * 6.0 - time * 0.02);
            float n3 = noise(vUv * 12.0);
            
            float cloud = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
            
            // 银河带
            float band = 1.0 - abs(dir.y) * 3.0;
            band = pow(max(0.0, band), 2.0);
            
            // 颜色混合
            vec3 color = mix(color1, color2, cloud);
            color = mix(color, color3, band * 0.5);
            
            float alpha = cloud * 0.4 + band * 0.3;
            
            gl_FragColor = vec4(color, alpha);
          }
        `}
      />
    </mesh>
  )
}
