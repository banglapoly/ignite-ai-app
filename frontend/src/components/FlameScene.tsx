import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Float } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Procedural candle flame.
 *  gravity = 1 : buoyant, elongated yellow teardrop with a sooty tip (hot gas rises)
 *  gravity = 0 : diffusion-only, near-spherical, dim blue flame (no buoyant convection)
 * Particles are advected on the CPU; the look is an artistic illustration of documented
 * behaviour, not a combustion simulation.
 */
const N = 2200

const vert = /* glsl */ `
  attribute float aLife;
  attribute float aSize;
  uniform float uG;
  varying float vLife;
  void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mv.z) * (0.6 + 0.4 * (1.0 - aLife));
    gl_Position = projectionMatrix * mv;
  }
`
const frag = /* glsl */ `
  uniform float uG;
  varying float vLife;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    // colour ramp: 1g = white core -> yellow -> orange -> dark soot; 0g = pale blue -> deep blue
    vec3 g1a = vec3(1.0, 0.97, 0.85);
    vec3 g1b = vec3(1.0, 0.62, 0.12);
    vec3 g1c = vec3(0.55, 0.12, 0.03);
    vec3 col1 = mix(mix(g1a, g1b, smoothstep(0.0, 0.45, vLife)), g1c, smoothstep(0.45, 1.0, vLife));
    vec3 g0a = vec3(0.75, 0.88, 1.0);
    vec3 g0b = vec3(0.18, 0.42, 1.0);
    vec3 col0 = mix(g0a, g0b, smoothstep(0.0, 0.7, vLife));
    vec3 col = mix(col0, col1, uG);
    float a = soft * (1.0 - vLife) * mix(0.42, 0.55, uG);
    gl_FragColor = vec4(col * a, a);
  }
`

function Flame({ gravity }: { gravity: number }) {
  const ref = useRef<THREE.Points>(null!)
  const mat = useRef<THREE.ShaderMaterial>(null!)
  const g = useRef(gravity)
  const { positions, vel, life, size, speed } = useMemo(() => {
    const positions = new Float32Array(N * 3)
    const vel = new Float32Array(N * 3)
    const life = new Float32Array(N)
    const size = new Float32Array(N)
    const speed = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      life[i] = Math.random()
      size[i] = 0.18 + Math.random() * 0.22
      speed[i] = 0.5 + Math.random() * 0.8
    }
    return { positions, vel, life, size, speed }
  }, [])
  const uniforms = useMemo(() => ({ uG: { value: gravity } }), [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    g.current += (gravity - g.current) * Math.min(1, dt * 2.5)
    const G = g.current
    if (mat.current) mat.current.uniforms.uG.value = G
    const lifeRate = 1.7 * G + 0.45 * (1 - G)
    for (let i = 0; i < N; i++) {
      let l = life[i] + dt * lifeRate * speed[i]
      const j = i * 3
      if (l >= 1) {
        l = 0
        // respawn around the wick tip
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(2 * Math.random() - 1)
        const r = 0.06 + Math.random() * 0.05
        positions[j] = r * Math.sin(ph) * Math.cos(th)
        positions[j + 1] = 0.05 + r * Math.cos(ph)
        positions[j + 2] = r * Math.sin(ph) * Math.sin(th)
        // 0g: radial diffusion outward; 1g: buoyant upward plume that necks in
        const rv = 0.22 + Math.random() * 0.16
        const vx0 = Math.sin(ph) * Math.cos(th) * rv
        const vy0 = Math.cos(ph) * rv
        const vz0 = Math.sin(ph) * Math.sin(th) * rv
        vel[j] = vx0 * (1 - G) + vx0 * 0.35 * G
        vel[j + 1] = vy0 * (1 - G) + (0.35 + Math.random() * 0.35) * G
        vel[j + 2] = vz0 * (1 - G) + vz0 * 0.35 * G
      } else {
        // buoyant acceleration + inward pull (teardrop) in 1g; slight damping in 0g
        vel[j + 1] += 1.3 * G * dt
        vel[j] += -positions[j] * 4.0 * G * dt
        vel[j + 2] += -positions[j + 2] * 4.0 * G * dt
        const damp = 1 - dt * (0.9 * (1 - G) + 0.2 * G)
        vel[j] *= damp; vel[j + 1] *= damp; vel[j + 2] *= damp
        positions[j] += vel[j] * dt
        positions[j + 1] += vel[j + 1] * dt
        positions[j + 2] += vel[j + 2] * dt
      }
      life[i] = l
    }
    const geo = ref.current.geometry
    geo.attributes.position.needsUpdate = true
    geo.attributes.aLife.needsUpdate = true
  })

  return (
    <points ref={ref} position={[0, 0.2, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aLife" args={[life, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[size, 1]} />
      </bufferGeometry>
      <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

function FlameLight({ gravity }: { gravity: number }) {
  const ref = useRef<THREE.PointLight>(null!)
  const g = useRef(gravity)
  useFrame((s, dt) => {
    g.current += (gravity - g.current) * Math.min(1, dt * 2.5)
    const flick = 1 + Math.sin(s.clock.elapsedTime * 13) * 0.05 * g.current + Math.sin(s.clock.elapsedTime * 7.3) * 0.04 * g.current
    ref.current.intensity = (1.2 + 2.2 * g.current) * flick
    ref.current.color.setRGB(0.35 + 0.65 * g.current, 0.5 + 0.2 * g.current, 1.0 - 0.75 * g.current)
  })
  return <pointLight ref={ref} position={[0, 0.6, 0]} distance={6} decay={2} />
}

function Candle() {
  return (
    <group>
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 1.1, 32]} />
        <meshStandardMaterial color="#e9e4d8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.22, 8]} />
        <meshStandardMaterial color="#1a1208" />
      </mesh>
    </group>
  )
}

/** Low-poly, procedurally built station module (not a model of any specific spacecraft). */
function Station() {
  const panel = (x: number) => (
    <group position={[x, 0, 0]}>
      <mesh>
        <boxGeometry args={[1.6, 0.02, 0.7]} />
        <meshStandardMaterial color="#1d3a8a" metalness={0.6} roughness={0.35} emissive="#0a1440" />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[1.62, 0.005, 0.02]} />
        <meshStandardMaterial color="#9fb3d9" />
      </mesh>
    </group>
  )
  return (
    <Float speed={0.6} rotationIntensity={0.25} floatIntensity={0.4}>
      <group position={[-1.5, 1.35, -3.6]} rotation={[0.35, -0.6, 0.15]} scale={0.7}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.28, 0.28, 2.4, 16]} />
          <meshStandardMaterial color="#c9ccd3" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[1.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.28, 0.25, 16]} />
          <meshStandardMaterial color="#aeb3bd" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.06, 0.06, 3.2]} />
          <meshStandardMaterial color="#8c93a0" metalness={0.7} />
        </mesh>
        <group position={[0, 0, 1.3]}>{panel(-0.9)}{panel(0.9)}</group>
        <group position={[0, 0, -1.3]}>{panel(-0.9)}{panel(0.9)}</group>
      </group>
    </Float>
  )
}

export default function FlameScene({ gravity }: { gravity: number }) {
  return (
    <Canvas camera={{ position: [0, 0.55, 3.6], fov: 42 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
      <color attach="background" args={['#04060f']} />
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 4, 2]} intensity={0.6} color="#b8c7ff" />
      <Stars radius={60} depth={40} count={3500} factor={3} fade speed={0.6} />
      <Station />
      <Candle />
      <Flame gravity={gravity} />
      <FlameLight gravity={gravity} />
      <OrbitControls enablePan={false} minDistance={1.8} maxDistance={7} autoRotate autoRotateSpeed={0.4} target={[0, 0.3, 0]} />
    </Canvas>
  )
}
