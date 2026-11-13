import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import Flame, { type FlameParams } from '../three/Flame'
import Module, { type EnvId } from '../three/Module'

const DPR: [number, number] = [1, 1.5]
const GL = { antialias: false, alpha: false, powerPreference: 'high-performance' as const, stencil: false }

function useLiveCanvas() {
  const ref = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let onScreen = true
    let shown = !document.hidden
    const update = () => setLive(onScreen && shown)
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update() }, { threshold: 0.08 })
    io.observe(el)
    const onVis = () => { shown = !document.hidden; update() }
    document.addEventListener('visibilitychange', onVis)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  return { ref, live }
}

/** Main demo viewport: flame inside a combustion chamber inside a procedural module / habitat. */
export default function FlameScene({ params, env, autoRotate = true }: { params: FlameParams; env: EnvId; autoRotate?: boolean }) {
  const { ref, live } = useLiveCanvas()
  return (
    <div ref={ref} className="flame-host">
    <Canvas frameloop={live ? 'always' : 'never'} camera={{ position: [0.85, 0.5, 2.75], fov: 42 }} dpr={DPR} gl={GL}>
      <color attach="background" args={['#05070d']} />
      <ambientLight intensity={0.22} />
      <hemisphereLight args={['#bcd4ff', '#2a2f38', 0.35]} />
      <directionalLight position={[0, 0.5, -6]} intensity={0.5} color={env === 'mars' ? '#ffc79a' : env === 'moon' ? '#dfe6ff' : '#9cc4ff'} />
      <Module env={env} />
      <Flame params={params} />
      <OrbitControls enablePan={false} minDistance={1.3} maxDistance={3.0} minPolarAngle={0.9} maxPolarAngle={2.0}
        autoRotate={autoRotate} autoRotateSpeed={0.35} target={[0, 0.3, 0]} />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.95} luminanceThreshold={0.7} luminanceSmoothing={0.2} radius={0.7} />
        <Vignette offset={0.22} darkness={0.72} eskil={false} />
      </EffectComposer>
    </Canvas>
    </div>
  )
}

/** Landing-page comparison: the same candle in 1 g and in microgravity, side by side. */
export function CompareScene() {
  const base = { o2: 21, pressure: 101.3, flow: 0, flowDir: 'quiescent', state: 'spread' as const }
  const { ref, live } = useLiveCanvas()
  return (
    <div ref={ref} className="flame-host">
    <Canvas frameloop={live ? 'always' : 'never'} camera={{ position: [0, 0.3, 2.3], fov: 40 }} dpr={DPR} gl={GL}>
      <color attach="background" args={['#04060d']} />
      <ambientLight intensity={0.25} />
      <Stars radius={40} depth={30} count={2000} factor={2.5} fade speed={0.4} />
      <Flame params={{ ...base, gravity: 1 }} position={[-0.75, 0, 0]} showFlow={false} />
      <Flame params={{ ...base, gravity: 0 }} position={[0.75, 0, 0]} showFlow={false} />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.65} luminanceSmoothing={0.2} radius={0.65} />
        <Vignette offset={0.25} darkness={0.7} eskil={false} />
      </EffectComposer>
    </Canvas>
    </div>
  )
}
