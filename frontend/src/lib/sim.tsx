import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Boundary, EnvData, GasMix, Inputs, Prediction } from './api'
import { OUTCOME_LABEL, getJSON, postPredict } from './api'

/** Shared simulator state: the environment, conditions and prediction are the same on the
 *  Simulator, Prediction and Safety pages, so moving between pages keeps your settings. */
type Crossing = { from: string; to: string; at: number; a?: string; b?: string }
export type Sim = {
  envs: EnvData[]; gases: GasMix[]; envId: string; setEnvId: (id: string) => void; env?: EnvData
  inp: Inputs | null; setInpF: (f: (s: Inputs) => Inputs) => void; gas: string; setGas: (g: string) => void
  pred: Prediction | null; err: string | null; bnd: Boundary | null
  menv?: EnvData['dataset']['materials'][string]
  playing: boolean; play: () => void; stop: () => void; demoLog: { o2: number; pred: string | null }[]; crossing: Crossing | null
}
const Ctx = createContext<Sim | null>(null)
export const useSim = () => { const s = useContext(Ctx); if (!s) throw new Error('SimProvider missing'); return s }
const ENV_PAGES = ['/simulator', '/predict', '/safety']

export function SimProvider({ path, children }: { path: string; children: React.ReactNode }) {
  const [envs, setEnvs] = useState<EnvData[]>([])
  const [gases, setGases] = useState<GasMix[]>([])
  const [envId, setEnvId] = useState<string>(() => new URLSearchParams(location.search).get('env') || 'iss')
  const env = envs.find(e => e.id === envId)
  const [inp, setInp] = useState<Inputs | null>(null)
  const [gas, setGas] = useState('air')
  const [pred, setPred] = useState<Prediction | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [bnd, setBnd] = useState<Boundary | null>(null)
  const [playing, setPlaying] = useState(false)
  const [demoLog, setDemoLog] = useState<{ o2: number; pred: string | null }[]>([])
  const [crossing, setCrossing] = useState<Crossing | null>(null)
  const playRef = useRef<number | null>(null)
  const lastPred = useRef<string | null>(null)
  const onEnvPage = ENV_PAGES.includes(path)

  useEffect(() => { getJSON<{ environments: EnvData[]; gas_mixes: GasMix[] }>('/environments').then(d => { setEnvs(d.environments); setGases(d.gas_mixes) }).catch(e => setErr(String(e))) }, [])
  useEffect(() => { if (env) { stop(); setInp(env.default); setGas('air'); setCrossing(null); setDemoLog([]) } }, [env?.id])
  // keep ?env= in the address bar on the pages that use it (shareable deep links)
  useEffect(() => { if (env && onEnvPage) { const u = new URL(location.href); if (u.searchParams.get('env') !== env.id) { u.searchParams.set('env', env.id); history.replaceState(null, '', u) } } }, [env?.id, path])

  useEffect(() => {
    if (!inp || !env) return
    const t = setTimeout(() => {
      postPredict({ ...inp, gravity_g: env.gravity_g, gas_mix: gas }).then(p => { setPred(p); setErr(null) }).catch(e => setErr(String(e)))
    }, 90)
    return () => clearTimeout(t)
  }, [inp, gas, env?.id])

  const menv = env && inp ? env.dataset.materials[inp.material] : undefined
  const axes = useMemo(() => {
    if (!menv) return null
    const y = menv.flow_cm_s[1] > menv.flow_cm_s[0] ? 'flow_cm_s' : menv.pressure_kpa[1] > menv.pressure_kpa[0] ? 'pressure_kpa' : 'flow_cm_s'
    return { x: 'oxygen_pct', y, third: y === 'flow_cm_s' ? 'pressure_kpa' : 'flow_cm_s' }
  }, [menv])
  const thirdVal = axes && inp ? (inp as any)[axes.third] as number : 0
  const wantBoundary = path === '/predict'
  useEffect(() => {
    if (!wantBoundary) return
    if (!axes || !inp || !env) { setBnd(null); return }
    const t = setTimeout(() => {
      const q = new URLSearchParams({ material: inp.material, flow_direction: inp.flow_direction, gravity_g: String(env.gravity_g), x: axes.x, y: axes.y, [axes.third]: String(thirdVal), nx: '70', ny: '56' })
      getJSON<Boundary>('/boundary?' + q.toString()).then(setBnd).catch(() => setBnd(null))
    }, 200)
    return () => clearTimeout(t)
  }, [inp?.material, inp?.flow_direction, axes, thirdVal, env?.id, wantBoundary])

  useEffect(() => {
    if (!pred) return
    const cur = pred.prediction
    if (playing) {
      setDemoLog(l => (l.length && l[l.length - 1].o2 === pred.inputs.oxygen_pct) ? l : [...l, { o2: pred.inputs.oxygen_pct, pred: cur }])
      if (lastPred.current && cur && cur !== lastPred.current) {
        const s = (e: any) => e ? `${e.report_id}: ${e.oxygen_pct}% O₂, ${e.pressure_kpa} kPa, ${e.flow_cm_s} cm/s → ${OUTCOME_LABEL[e.outcome as keyof typeof OUTCOME_LABEL]} (${e.source_location})` : undefined
        setCrossing({ from: lastPred.current, to: cur, at: pred.inputs.oxygen_pct, a: s(pred.contrast_experiment), b: s(pred.supporting_experiment) })
      }
    }
    if (cur) lastPred.current = cur
  }, [pred])

  function stop() { if (playRef.current) clearInterval(playRef.current); playRef.current = null; setPlaying(false) }
  const play = () => {
    if (!menv || !inp) return
    stop(); setDemoLog([]); setCrossing(null); lastPred.current = null; setGas('air')
    const hi = menv.oxygen_pct[1], lo = menv.oxygen_pct[0]
    const step = Math.max(0.1, +((hi - lo) / 16).toFixed(2))
    let o2 = hi
    setInp(s => s && ({ ...s, oxygen_pct: o2 })); setPlaying(true)
    playRef.current = window.setInterval(() => {
      o2 = +(o2 - step).toFixed(2)
      if (o2 < lo - 1e-9) { stop(); return }
      setInp(s => s && ({ ...s, oxygen_pct: o2 }))
    }, 420)
  }
  useEffect(() => () => stop(), [])
  useEffect(() => { if (!['/simulator', '/predict'].includes(path)) stop() }, [path])

  const value: Sim = { envs, gases, envId, setEnvId, env, inp, setInpF: f => setInp(s => s ? f(s) : s), gas, setGas, pred, err, bnd, menv, playing, play, stop, demoLog, crossing }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
