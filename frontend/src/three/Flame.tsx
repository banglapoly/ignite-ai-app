import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SNOISE } from './noise'

/**
 * Procedural flame (artistic illustration of documented behaviour, NOT a combustion simulation).
 *  - gravity: buoyancy factor sqrt(g) turns a near-spherical diffusion flame (0 g) into a
 *    tall teardrop with a blue base and a sooty yellow/orange body (1 g)
 *  - oxygen / pressure: size, brightness and soot (yellow) content
 *  - airflow: flame is skewed and elongated downstream (+x); longer for concurrent flow
 *  - state: marginal = weak pulsing flame, no_spread = extinguished (ember + smoke),
 *           refused = desaturated "unknown" flame
 */
export type FlameState = 'spread' | 'marginal_spread' | 'no_spread' | 'refused' | null
export interface FlameParams { gravity: number; o2: number; pressure: number; flow: number; flowDir: string; state: FlameState }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export function flameTargets(p: FlameParams) {
  const buoy = Math.sqrt(clamp(p.gravity, 0, 1))
  const oxy = clamp((p.o2 - 12) / (36 - 12), 0, 1)
  const pr = clamp(p.pressure / 101.3, 0.3, 2.1)
  const flow = clamp(p.flow / 35, 0, 1)
  const conc = p.flowDir === 'opposed' ? -1 : 1
  let life = 1, pulse = 0, grey = 0
  if (p.state === 'marginal_spread') { life = 0.62; pulse = 1 }
  if (p.state === 'no_spread') life = 0.0
  if (p.state === 'refused') { life = 0.5; grey = 1 }
  if (p.state === null) life = 0.85
  const size = (0.5 + 0.55 * oxy) * (0.82 + 0.18 * Math.min(pr, 1.5)) * (0.25 + 0.75 * life) + 0.02
  const intensity = (0.55 + 0.85 * oxy) * (0.72 + 0.28 * Math.min(pr, 1.4)) * life
  const soot = clamp((0.1 + 0.9 * buoy) * Math.min(pr, 1.3) * (0.7 + 0.3 * oxy) * 1.25, 0, 1)
  return { buoy, oxy, pr, flow, conc, life, pulse, grey, size, intensity, soot }
}

const VERT = SNOISE + /* glsl */ `
uniform float uTime, uBuoy, uSize, uFlow, uConc, uLayer, uPulse;
varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vP;
void main(){
  vec3 p = position;
  float h0 = position.y * 0.5 + 0.5;
  float stretch = 1.0 + uBuoy * 2.7;
  if (p.y > 0.0) p.y *= stretch; else p.y *= (1.0 - 0.35 * uBuoy);
  float t = clamp(p.y / stretch, 0.0, 1.0);
  p.xz *= mix(1.0, 1.0 - 0.93 * pow(t, 0.9), uBuoy) * (1.0 - 0.42 * uBuoy);
  float speed = 0.5 + 3.4 * uBuoy + 1.2 * uFlow;
  float n = snoise(vec3(p.x * 1.7, p.y * 1.1 - uTime * speed, p.z * 1.7 + uLayer * 3.1));
  float amp = 0.04 + 0.17 * uBuoy * t + 0.05 * uFlow;
  p += normal * n * amp;
  p.x += sin(uTime * 7.0 + p.y * 2.3) * 0.035 * uBuoy * t;
  float along = p.y + 1.0;
  float el = uConc > 0.0 ? 1.0 + 1.9 * uFlow : 1.0 + 0.6 * uFlow;
  if (p.x > 0.0) p.x *= el;
  p.x += uFlow * 0.5 * along * along * 0.5 * (1.0 + (1.0 - uBuoy));
  p *= uSize * (1.0 + 0.08 * uPulse * sin(uTime * 8.0) + 0.04 * uPulse * sin(uTime * 21.0));
  vP = p; vH = h0;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`

const FRAG = SNOISE + /* glsl */ `
uniform float uTime, uBuoy, uSoot, uInt, uGrey, uLayer, uFlow;
varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vP;
void main(){
  float f = abs(dot(normalize(vN), normalize(vV)));
  float h = vH;
  vec3 blue = vec3(0.16, 0.38, 1.0);
  vec3 cyan = vec3(0.5, 0.78, 1.0);
  vec3 violet = vec3(0.5, 0.36, 1.0);
  vec3 yellow = vec3(1.0, 0.76, 0.26);
  vec3 orange = vec3(1.0, 0.38, 0.06);
  vec3 white = vec3(1.0, 0.96, 0.86);
  vec3 body = mix(mix(blue, cyan, 0.12 + 0.25 * f), mix(yellow, orange, smoothstep(0.3, 1.0, h)), uSoot);
  float baseMask = 1.0 - smoothstep(0.06, 0.34, h);
  vec3 col = mix(body, blue, baseMask * (0.35 + 0.6 * uBuoy));
  if (uLayer < 0.5) col = mix(col, white, 0.35 * uSoot + 0.08);
  if (uLayer > 1.5) col = mix(mix(col, orange, 0.5 * uSoot), violet, 0.55 * (1.0 - uSoot));
  float n = snoise(vP * 2.6 + vec3(0.0, -uTime * (0.7 + 2.6 * uBuoy), uTime * 0.25));
  float a;
  if (uLayer > 1.5) a = pow(1.0 - f, 2.0) * 0.3 + 0.05 * f;
  else a = pow(f, 1.2) * (uLayer < 0.5 ? 0.9 : 0.9);
  a *= 0.8 + 0.3 * n;
  a *= uInt;
  a *= 1.0 - smoothstep(0.72, 1.0, h) * uBuoy * 0.65;
  float lum = dot(col, vec3(0.3, 0.59, 0.11));
  col = mix(col, vec3(lum) * vec3(0.62, 0.7, 0.92), uGrey);
  float boost = uLayer < 0.5 ? 1.35 * (0.55 + 0.45 * uSoot) : (uLayer < 1.5 ? 1.0 : 0.7);
  gl_FragColor = vec4(col * a * boost, 1.0);   // additive: src*1 + dst
}`

function Shell({ layer, scale, st, geo, offsetY }: { layer: number; scale: number; st: React.MutableRefObject<any>; geo: THREE.BufferGeometry; offsetY: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null!)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uBuoy: { value: 0 }, uSize: { value: 1 }, uFlow: { value: 0 }, uConc: { value: 1 }, uLayer: { value: layer },
    uPulse: { value: 0 }, uSoot: { value: 0.5 }, uInt: { value: 1 }, uGrey: { value: 0 },
  }), [layer])
  useFrame(s => {
    const u = mat.current?.uniforms; if (!u) return
    const c = st.current
    u.uTime.value = s.clock.elapsedTime; u.uBuoy.value = c.buoy; u.uSize.value = c.size * scale; u.uFlow.value = c.flow
    u.uConc.value = c.conc; u.uPulse.value = c.pulse; u.uSoot.value = c.soot; u.uInt.value = c.intensity; u.uGrey.value = c.grey
  })
  return (
    <mesh geometry={geo} position={[0, offsetY, 0]} renderOrder={3 - layer}>
      <shaderMaterial ref={mat} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} transparent depthWrite={false}
        blending={THREE.AdditiveBlending} />
    </mesh>
  )
}

const PVERT = /* glsl */ `
attribute float aLife; attribute float aSize; attribute float aKind;
varying float vLife; varying float vKind;
void main(){ vLife = aLife; vKind = aKind; vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (260.0 / -mv.z); gl_Position = projectionMatrix * mv; }`
const EFRAG = /* glsl */ `
uniform float uSoot; uniform float uInt; uniform float uGrey;
varying float vLife; varying float vKind;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
  float s = smoothstep(0.5, 0.0, d);
  vec3 hot = mix(vec3(0.3, 0.55, 1.0), vec3(1.0, 0.55, 0.12), uSoot);
  vec3 col = mix(hot, vec3(0.9, 0.25, 0.05) * (0.6 + 0.4 * uSoot), vLife);
  col = mix(col, vec3(0.55, 0.6, 0.75), uGrey);
  float a = s * (1.0 - vLife) * uInt * 0.55;
  gl_FragColor = vec4(col * a, 1.0); }`
const SFRAG = /* glsl */ `
uniform float uSmoke;
varying float vLife;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
  float s = smoothstep(0.5, 0.05, d);
  float a = s * sin(3.14159 * vLife) * 0.16 * uSmoke;
  gl_FragColor = vec4(vec3(0.16, 0.16, 0.18), a); }`

function Particles({ st, kind, n }: { st: React.MutableRefObject<any>; kind: 'ember' | 'smoke'; n: number }) {
  const ref = useRef<THREE.Points>(null!)
  const mat = useRef<THREE.ShaderMaterial>(null!)
  const d = useMemo(() => {
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), life = new Float32Array(n), size = new Float32Array(n), spd = new Float32Array(n)
    for (let i = 0; i < n; i++) { life[i] = Math.random(); size[i] = kind === 'ember' ? 0.02 + Math.random() * 0.04 : 0.25 + Math.random() * 0.35; spd[i] = 0.5 + Math.random() }
    return { pos, vel, life, size, spd, kindA: new Float32Array(n).fill(kind === 'ember' ? 0 : 1) }
  }, [n, kind])
  const uniforms = useMemo(() => ({ uSoot: { value: 0.5 }, uInt: { value: 1 }, uGrey: { value: 0 }, uSmoke: { value: 0 } }), [])
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05), c = st.current
    const B = c.buoy, F = c.flow, S = c.size
    if (mat.current) {
      const u = mat.current.uniforms
      u.uSoot.value = c.soot; u.uInt.value = Math.min(1.2, c.intensity * 1.1); u.uGrey.value = c.grey
      u.uSmoke.value = kind === 'smoke' ? Math.min(1, 0.05 * c.soot * c.life + (1 - c.life) * 0.9 * (c.extinguishedFor > 0.2 ? 1 : 0)) : 0
    }
    const { pos, vel, life, spd } = d
    const rate = kind === 'ember' ? (0.25 + 1.2 * B + 0.8 * F) : (0.12 + 0.25 * B + 0.3 * F)
    const tip = S * (0.4 + 2.2 * B)
    for (let i = 0; i < n; i++) {
      const j = i * 3
      let l = life[i] + dt * rate * spd[i]
      if (l >= 1) {
        l = 0
        const th = Math.random() * Math.PI * 2, r = (kind === 'ember' ? 0.25 : 0.12) * S * Math.random()
        pos[j] = Math.cos(th) * r + (kind === 'smoke' ? F * 0.5 : 0); pos[j + 1] = kind === 'ember' ? (Math.random() * tip * 0.8) : tip * 1.05 + 0.1; pos[j + 2] = Math.sin(th) * r
        if (B > 0.05) { vel[j] = (Math.random() - 0.5) * 0.4; vel[j + 1] = (kind === 'ember' ? 2.2 : 1.1) * B + 0.1; vel[j + 2] = (Math.random() - 0.5) * 0.4 }
        else { const ph = Math.acos(2 * Math.random() - 1); const v = kind === 'ember' ? 0.55 : 0.22
          vel[j] = Math.sin(ph) * Math.cos(th) * v; vel[j + 1] = Math.cos(ph) * v; vel[j + 2] = Math.sin(ph) * Math.sin(th) * v }
      } else {
        vel[j + 1] += (kind === 'ember' ? 3.6 : 1.4) * B * dt
        vel[j] += F * (kind === 'ember' ? 7.0 : 3.5) * dt
        const damp = 1 - dt * (kind === 'ember' ? 0.6 : 0.3)
        vel[j] *= damp; vel[j + 1] *= damp; vel[j + 2] *= damp
        pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt
      }
      life[i] = l
    }
    const g = ref.current.geometry
    g.attributes.position.needsUpdate = true; g.attributes.aLife.needsUpdate = true
  })
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[d.pos, 3]} />
        <bufferAttribute attach="attributes-aLife" args={[d.life, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[d.size, 1]} />
        <bufferAttribute attach="attributes-aKind" args={[d.kindA, 1]} />
      </bufferGeometry>
      <shaderMaterial ref={mat} vertexShader={PVERT} fragmentShader={kind === 'ember' ? EFRAG : SFRAG} uniforms={uniforms}
        transparent depthWrite={false} blending={kind === 'ember' ? THREE.AdditiveBlending : THREE.NormalBlending} />
    </points>
  )
}

/** Ventilation airflow streaks moving in +x; opacity and speed follow the fan setting. */
function FlowStreaks({ st, n = 70 }: { st: React.MutableRefObject<any>; n?: number }) {
  const ref = useRef<THREE.LineSegments>(null!)
  const mat = useRef<THREE.LineBasicMaterial>(null!)
  const d = useMemo(() => {
    const pos = new Float32Array(n * 6), base = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) { base[i * 4] = Math.random() * 6 - 3; base[i * 4 + 1] = Math.random() * 2.2 - 0.6; base[i * 4 + 2] = Math.random() * 1.6 - 0.8; base[i * 4 + 3] = 0.12 + Math.random() * 0.25 }
    return { pos, base }
  }, [n])
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05), F = st.current.flow
    const { pos, base } = d
    for (let i = 0; i < n; i++) {
      base[i * 4] += dt * (0.4 + 3.2 * F) * (0.7 + base[i * 4 + 3])
      if (base[i * 4] > 3) base[i * 4] = -3
      const len = base[i * 4 + 3] * (0.4 + 1.6 * F)
      pos.set([base[i * 4], base[i * 4 + 1], base[i * 4 + 2], base[i * 4] + len, base[i * 4 + 1], base[i * 4 + 2]], i * 6)
    }
    ref.current.geometry.attributes.position.needsUpdate = true
    if (mat.current) mat.current.opacity = Math.min(0.5, F * 0.9)
  })
  return (
    <lineSegments ref={ref} frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[d.pos, 3]} /></bufferGeometry>
      <lineBasicMaterial ref={mat} color="#9fd8ff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  )
}

function Candle({ st }: { st: React.MutableRefObject<any> }) {
  const tip = useRef<THREE.MeshStandardMaterial>(null!)
  useFrame(s => { if (tip.current) tip.current.emissiveIntensity = 0.6 + 2.5 * Math.max(st.current.life, 0.25) * (1 + 0.2 * Math.sin(s.clock.elapsedTime * 6)) })
  return (
    <group>
      <mesh position={[0, -0.52, 0]}>
        <cylinderGeometry args={[0.1, 0.11, 0.8, 40]} />
        <meshStandardMaterial color="#d9cfbb" roughness={0.55} emissive="#2a1c0a" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, -0.13, 0]}>
        <sphereGeometry args={[0.1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
        <meshStandardMaterial color="#e2d8c4" roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.007, 0.009, 0.14, 8]} />
        <meshStandardMaterial ref={tip} color="#1a1208" emissive="#ff5a1a" emissiveIntensity={1} />
      </mesh>
    </group>
  )
}

export default function Flame({ params, position = [0, 0, 0], showFlow = true, light = true }: { params: FlameParams; position?: [number, number, number]; showFlow?: boolean; light?: boolean }) {
  const target = flameTargets(params)
  const st = useRef<any>({ ...target, extinguishedFor: 0 })
  const lightRef = useRef<THREE.PointLight>(null!)
  const geo = useMemo(() => new THREE.SphereGeometry(1, 72, 72), [])
  useFrame((s, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05), c = st.current, t = flameTargets(params)
    const k = Math.min(1, dt * 2.6)
    for (const key of ['buoy', 'oxy', 'pr', 'flow', 'conc', 'life', 'pulse', 'grey', 'size', 'intensity', 'soot'] as const) c[key] += (t[key] - c[key]) * k
    c.extinguishedFor = t.life === 0 ? c.extinguishedFor + dt : 0
    if (lightRef.current) {
      const fl = 1 + 0.07 * Math.sin(s.clock.elapsedTime * 13) * c.buoy + 0.05 * Math.sin(s.clock.elapsedTime * 7.7)
      lightRef.current.intensity = (0.25 + 2.6 * c.intensity) * fl
      const r = 0.35 + 0.65 * c.soot, g = 0.45 + 0.25 * c.soot, b = 1.0 - 0.72 * c.soot
      lightRef.current.color.setRGB(r * (1 - c.grey) + 0.6 * c.grey, g * (1 - c.grey) + 0.65 * c.grey, b * (1 - c.grey) + 0.8 * c.grey)
    }
  })
  return (
    <group position={position}>
      <Candle st={st} />
      <group position={[0, 0.06, 0]} scale={0.36}>
        <Shell layer={2} scale={1.32} st={st} geo={geo} offsetY={0.02} />
        <Shell layer={1} scale={1.0} st={st} geo={geo} offsetY={0} />
        <Shell layer={0} scale={0.5} st={st} geo={geo} offsetY={-0.02} />
        <Particles st={st} kind="ember" n={320} />
        <Particles st={st} kind="smoke" n={220} />
      </group>
      {showFlow && <FlowStreaks st={st} />}
      {light && <pointLight ref={lightRef} position={[0, 0.45, 0.2]} distance={9} decay={1.6} />}
    </group>
  )
}
