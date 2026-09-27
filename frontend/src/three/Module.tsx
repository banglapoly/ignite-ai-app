import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SNOISE } from './noise'

/** Procedural spacecraft-module / habitat interior. Not a model of any specific NASA vehicle. */
export type EnvId = 'earth' | 'moon' | 'mars' | 'iss' | 'transit'
const ENV_INDEX: Record<EnvId, number> = { earth: 0, moon: 1, mars: 2, iss: 3, transit: 4 }

function panelTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#b9c1cc'; g.fillRect(0, 0, 1024, 512)
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)
  for (let col = 0; col < 8; col++) {
    const x = col * 128
    g.fillStyle = '#8d96a3'; g.fillRect(x, 0, 4, 512)
    let y = 6
    while (y < 500) {
      const h = [40, 60, 84, 110][Math.floor(Math.random() * 4)]
      const shade = Math.floor(rnd(178, 214))
      g.fillStyle = `rgb(${shade},${shade + 4},${shade + 10})`; g.fillRect(x + 8, y, 114, h - 6)
      g.strokeStyle = '#7d8591'; g.lineWidth = 2; g.strokeRect(x + 8, y, 114, h - 6)
      if (Math.random() < 0.45) { g.fillStyle = ['#2f5fb3', '#d9a21b', '#3b3f46', '#b8322a'][Math.floor(Math.random() * 4)]; g.fillRect(x + 14, y + 6, rnd(16, 50), 6) }
      if (Math.random() < 0.35) { for (let k = 0; k < 4; k++) { g.fillStyle = Math.random() < 0.5 ? '#39d98a' : '#ffb13b'; g.fillRect(x + 90 + k * 7, y + 8, 4, 4) } }
      if (Math.random() < 0.3) { g.fillStyle = '#2a2e35'; g.beginPath(); g.arc(x + 65, y + h / 2, 7, 0, Math.PI * 2); g.fill() }
      y += h
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

const WVERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const WFRAG = SNOISE + /* glsl */ `
uniform float uEnv; uniform float uTime; varying vec2 vUv;
float stars(vec2 uv){ vec2 g = floor(uv * 140.0); float h = fract(sin(dot(g, vec2(12.9898, 78.233))) * 43758.5453); return step(0.985, h) * (0.5 + 0.5 * sin(uTime * 2.0 + h * 40.0)); }
void main(){
  vec2 uv = vUv; vec3 col = vec3(0.0);
  if (uEnv < 0.5) {            // Earth: lab window, sky and horizon
    col = mix(vec3(0.55, 0.72, 0.95), vec3(0.2, 0.42, 0.8), uv.y);
    float ground = step(uv.y, 0.32 + 0.02 * snoise(vec3(uv.x * 6.0, 0.0, 0.0)));
    col = mix(col, mix(vec3(0.62, 0.55, 0.42), vec3(0.45, 0.4, 0.3), snoise(vec3(uv * 20.0, 1.0)) * 0.5 + 0.5), ground);
  } else if (uEnv < 1.5) {     // Moon: black sky, grey regolith, Earth in the sky
    col = vec3(stars(uv) * 0.9);
    vec2 e = uv - vec2(0.28, 0.76); float r = length(e);
    if (r < 0.07) { float n = snoise(vec3(e * 40.0, uTime * 0.02)); col = mix(vec3(0.1, 0.3, 0.8), vec3(0.95), smoothstep(0.2, 0.7, n)); col *= smoothstep(0.07, 0.0, r + 0.03 * (e.x + 0.07)); }
    float hz = 0.38 + 0.03 * snoise(vec3(uv.x * 4.0, 2.0, 0.0));
    if (uv.y < hz) { float n = snoise(vec3(uv * 18.0, 3.0)) * 0.5 + 0.5; float cr = smoothstep(0.55, 0.62, snoise(vec3(uv * 9.0, 7.0)) * 0.5 + 0.5); col = vec3(0.42, 0.42, 0.44) * (0.65 + 0.45 * n) - cr * 0.12; }
  } else if (uEnv < 2.5) {     // Mars: dusty butterscotch sky, rust ground
    col = mix(vec3(0.86, 0.66, 0.46), vec3(0.55, 0.36, 0.26), uv.y);
    float hz = 0.36 + 0.04 * snoise(vec3(uv.x * 3.0, 5.0, 0.0));
    if (uv.y < hz) { float n = snoise(vec3(uv * 14.0, 9.0)) * 0.5 + 0.5; col = mix(vec3(0.55, 0.24, 0.12), vec3(0.74, 0.38, 0.2), n); }
    vec2 s = uv - vec2(0.7, 0.72); col += vec3(1.0, 0.95, 0.85) * smoothstep(0.035, 0.0, length(s)) * 0.8;
  } else if (uEnv < 3.5) {     // ISS: Earth limb below, black space above
    col = vec3(stars(uv) * 0.6);
    vec2 c = vec2(0.5, -1.25); float r = length(uv - c);
    float R = 1.62;
    if (r < R) {
      vec2 p = (uv - c) * 3.0; float n = snoise(vec3(p * 2.0 + vec2(uTime * 0.01, 0.0), 0.0));
      float cl = smoothstep(0.1, 0.6, snoise(vec3(p * 3.5 + vec2(uTime * 0.02, 0.0), 4.0)));
      vec3 land = mix(vec3(0.05, 0.2, 0.55), vec3(0.2, 0.36, 0.18), smoothstep(0.25, 0.4, n));
      col = mix(land, vec3(0.95), cl * 0.8);
      col *= 0.6 + 0.4 * smoothstep(R, R - 0.25, r);
    }
    col += vec3(0.3, 0.6, 1.0) * smoothstep(0.035, 0.0, abs(r - R - 0.012)) * 0.9;
  } else {                     // Transit: deep space and a distant planet
    col = vec3(stars(uv));
    vec2 p = uv - vec2(0.72, 0.3); float r = length(p);
    if (r < 0.06) col = mix(vec3(0.1, 0.3, 0.9), vec3(0.8, 0.9, 1.0), smoothstep(0.02, 0.06, r)) * smoothstep(0.06, 0.0, r + 0.02 * p.x * 10.0);
    col += vec3(0.25, 0.15, 0.4) * (snoise(vec3(uv * 3.0, 11.0)) * 0.5 + 0.5) * 0.25;
  }
  gl_FragColor = vec4(col, 1.0);
}`

function Window({ env }: { env: EnvId }) {
  const mat = useRef<THREE.ShaderMaterial>(null!)
  const uniforms = useMemo(() => ({ uEnv: { value: ENV_INDEX[env] }, uTime: { value: 0 } }), [])
  useFrame(s => { if (mat.current) { mat.current.uniforms.uTime.value = s.clock.elapsedTime; mat.current.uniforms.uEnv.value = ENV_INDEX[env] } })
  return (
    <group position={[0, 0.3, -6.9]}>
      <mesh><circleGeometry args={[1.55, 64]} /><shaderMaterial ref={mat} vertexShader={WVERT} fragmentShader={WFRAG} uniforms={uniforms} /></mesh>
      <mesh position={[0, 0, 0.02]}><torusGeometry args={[1.6, 0.12, 16, 64]} /><meshStandardMaterial color="#8e97a5" metalness={0.8} roughness={0.3} /></mesh>
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
        <mesh key={i} position={[Math.cos(i * Math.PI / 4) * 1.6, Math.sin(i * Math.PI / 4) * 1.6, 0.12]}><sphereGeometry args={[0.05, 10, 10]} /><meshStandardMaterial color="#5c6470" metalness={0.9} roughness={0.3} /></mesh>
      ))}
    </group>
  )
}

function Chamber() {
  return (
    <group position={[0, -0.1, 0]}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.72, 0.72, 1.7, 48, 1, true]} />
        <meshStandardMaterial color="#a8d0ff" transparent opacity={0.07} roughness={0.05} metalness={0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {[-0.5, 1.2].map(y => (
        <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[0.8, 0.8, 0.12, 48]} /><meshStandardMaterial color="#59616d" metalness={0.85} roughness={0.32} /></mesh>
      ))}
      {[0, 1, 2, 3].map(i => (
        <mesh key={i} position={[Math.cos(i * Math.PI / 2 + 0.6) * 0.76, 0.35, Math.sin(i * Math.PI / 2 + 0.6) * 0.76]}><cylinderGeometry args={[0.025, 0.025, 1.7, 8]} /><meshStandardMaterial color="#7a838f" metalness={0.9} roughness={0.25} /></mesh>
      ))}
      <mesh position={[0, 1.265, 0]}><torusGeometry args={[0.55, 0.008, 8, 64]} /><meshStandardMaterial color="#39d98a" emissive="#39d98a" emissiveIntensity={1.1} /></mesh>
      <mesh position={[0, -0.9, 0]}><boxGeometry args={[1.9, 0.7, 1.9]} /><meshStandardMaterial color="#39414c" metalness={0.6} roughness={0.5} /></mesh>
      <mesh position={[0, -0.72, 0.96]}><planeGeometry args={[1.2, 0.18]} /><meshStandardMaterial color="#0b1830" emissive="#1c6cff" emissiveIntensity={0.8} /></mesh>
    </group>
  )
}

export default function Module({ env }: { env: EnvId }) {
  const tex = useMemo(() => panelTexture(), [])
  const hasFloor = env === 'earth' || env === 'moon' || env === 'mars'
  const tint = env === 'mars' ? '#e6c3a6' : env === 'moon' ? '#d4d6dc' : env === 'earth' ? '#e3e7ee' : '#dfe6f0'
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.3, -1]}>
        <cylinderGeometry args={[3.4, 3.4, 12, 40, 1, true]} />
        <meshStandardMaterial map={tex} color={tint} side={THREE.BackSide} roughness={0.62} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.3, -7.0]}><circleGeometry args={[3.4, 48]} /><meshStandardMaterial color="#9aa3b0" roughness={0.6} metalness={0.4} /></mesh>
      {[45, 135, 225, 315].map(a => {
        const r = 3.25, th = (a * Math.PI) / 180
        return <mesh key={a} position={[Math.cos(th) * r, 0.3 + Math.sin(th) * r, -1]} rotation={[0, 0, th]}><boxGeometry args={[0.06, 0.28, 10]} /><meshStandardMaterial color="#ffffff" emissive="#dfefff" emissiveIntensity={1.6} /></mesh>
      })}
      {[-3.5, -1.2, 1.1].map(z => [20, 160].map(a => {
        const th = (a * Math.PI) / 180, r = 3.05
        return <mesh key={`${z}-${a}`} position={[Math.cos(th) * r, 0.3 + Math.sin(th) * r, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.035, 0.035, 1.0, 10]} /><meshStandardMaterial color="#d9b13b" metalness={0.4} roughness={0.4} /></mesh>
      }))}
      {hasFloor && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.3, -1]}><planeGeometry args={[5.2, 12]} /><meshStandardMaterial color="#59606b" roughness={0.8} metalness={0.3} /></mesh>}
      <Window env={env} />
      <Chamber />
    </group>
  )
}
