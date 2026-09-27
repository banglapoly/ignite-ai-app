import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import type { Boundary, EnvData, GasMix, Inputs, ModelCard, Prediction } from '../lib/api'
import { MATERIAL_LABEL, OUTCOME_COLOR, OUTCOME_LABEL, getJSON, postPredict } from '../lib/api'
import { ConditionsPanel, PredictionPanel } from '../components/Conditions'
import BoundaryPlot from '../components/BoundaryPlot'
import AskPanel from '../components/AskPanel'
import { DisclosureTeam, FactCard, FlexPanel, ModelSection, Resources, SafetyBlock } from '../components/Sections'
import type { FlameState } from '../three/Flame'
import { Nav, Footer } from './Landing'

const FlameScene = lazy(() => import('../components/FlameScene'))
const TAB_ICON: Record<string, string> = { earth: '🌍', moon: '🌕', mars: '🔴', iss: '🛰️', transit: '🚀' }

export default function Demo({ card }: { card: ModelCard | null }) {
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
  const [crossing, setCrossing] = useState<{ from: string; to: string; at: number; a?: string; b?: string } | null>(null)
  const playRef = useRef<number | null>(null)
  const lastPred = useRef<string | null>(null)

  useEffect(() => { getJSON<{ environments: EnvData[]; gas_mixes: GasMix[] }>('/environments').then(d => { setEnvs(d.environments); setGases(d.gas_mixes) }).catch(e => setErr(String(e))) }, [])
  useEffect(() => { if (env) { stop(); setInp(env.default); setGas('air'); setCrossing(null); setDemoLog([]); const u = new URL(location.href); u.searchParams.set('env', env.id); history.replaceState(null, '', u) } }, [env?.id])

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
  useEffect(() => {
    if (!axes || !inp || !env) { setBnd(null); return }
    const t = setTimeout(() => {
      const q = new URLSearchParams({ material: inp.material, flow_direction: inp.flow_direction, gravity_g: String(env.gravity_g), x: axes.x, y: axes.y, [axes.third]: String(thirdVal), nx: '70', ny: '56' })
      getJSON<Boundary>('/boundary?' + q.toString()).then(setBnd).catch(() => setBnd(null))
    }, 200)
    return () => clearTimeout(t)
  }, [inp?.material, inp?.flow_direction, axes, thirdVal, env?.id])

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

  const state: FlameState = pred ? (pred.in_training_range ? pred.prediction : 'refused') : null
  const setInpF = (f: (s: Inputs) => Inputs) => setInp(s => s ? f(s) : s)
  const ppO2 = inp ? (inp.oxygen_pct / 100) * inp.pressure_kpa : 0

  return (
    <>
      <Nav demo />
      <section className="viewport">
        <div className="viewport-canvas">
          {env && inp ? (
            <Suspense fallback={<div className="canvas-fallback" />}>
              <FlameScene env={env.id} params={{ gravity: env.gravity_g, o2: inp.oxygen_pct, pressure: inp.pressure_kpa, flow: inp.flow_cm_s, flowDir: inp.flow_direction, state }} autoRotate={!playing} />
            </Suspense>
          ) : <div className="canvas-fallback" />}
        </div>
        {env && inp && (
          <>
            <div className="hud hud-left">
              <div className="hud-title">ENVIRONMENT CHAMBER · {env.short.toUpperCase()}</div>
              <div className="hud-row"><span>Gravity</span><b>{env.gravity_g} g</b></div>
              <div className="hud-row"><span>Oxygen</span><b>{inp.oxygen_pct.toFixed(1)} %</b></div>
              <div className="hud-row"><span>Pressure</span><b>{inp.pressure_kpa.toFixed(1)} kPa</b></div>
              <div className="hud-row"><span>Airflow</span><b>{inp.flow_cm_s.toFixed(1)} cm/s</b></div>
              <div className="hud-row"><span>O₂ partial pressure <i>computed</i></span><b>{ppO2.toFixed(1)} kPa</b></div>
              <div className="hud-row"><span>Buoyant flow vs Earth <i>estimate √g</i></span><b>{env.gravity_g ? `≈ ${Math.sqrt(env.gravity_g).toFixed(2)}×` : '≈ 0 (none)'}</b></div>
            </div>
            <div className="hud hud-right">
              <div className="hud-title">FIRE RISK STATUS</div>
              {pred && pred.in_training_range && pred.prediction ? (
                <div className="hud-verdict" style={{ color: OUTCOME_COLOR[pred.prediction], borderColor: OUTCOME_COLOR[pred.prediction] }}>{OUTCOME_LABEL[pred.prediction].toUpperCase()} · {Math.round((pred.probabilities?.[pred.prediction] || 0) * 100)}%</div>
              ) : <div className="hud-verdict refused">NO PREDICTION · OUTSIDE EVIDENCE</div>}
              <div className="hud-row"><span>Range guard</span><b className={pred?.in_training_range ? 'ok' : 'bad'}>{pred?.in_training_range ? 'IN ENVELOPE' : 'REFUSED'}</b></div>
              <div className="hud-row"><span>Gas mix</span><b className={gas === 'air' ? 'ok' : 'bad'}>{gas === 'air' ? 'O₂/N₂ (modelled)' : 'not modelled'}</b></div>
              <div className="hud-row"><span>Material</span><b>{MATERIAL_LABEL[inp.material] || inp.material}</b></div>
              <div className="hud-row"><span>Tests at this gravity</span><b>{env.dataset.n}</b></div>
            </div>
            <div className="viewport-caption">Illustrative rendering driven by your inputs and the model output (shape from √g buoyancy, size and colour from O₂ and pressure, skew from airflow). It is not a combustion simulation. Drag to look around.</div>
          </>
        )}
      </section>

      <nav className="tabs" role="tablist" aria-label="Environment">
        {envs.map(e => (
          <button key={e.id} role="tab" aria-selected={e.id === envId} className={e.id === envId ? 'on' : ''} onClick={() => setEnvId(e.id)}>
            <span className="tab-ico">{TAB_ICON[e.id]}</span><span className="tab-name">{e.short}</span><span className="tab-n">{e.dataset.n} tests</span>
          </button>
        ))}
      </nav>

      {env && inp && (
        <section className="section wide envsec" id="environment">
          <div className="env-head">
            <h2>{TAB_ICON[env.id]} {env.name}: {env.tagline}</h2>
            <p className="small">{env.data_note}{env.dataset.oof_accuracy && env.gravity_g > 0 ? ` Out-of-fold accuracy at this gravity: ${(env.dataset.oof_accuracy.accuracy * 100).toFixed(0)}% (n=${env.dataset.oof_accuracy.n}).` : ''}</p>
          </div>
          <div className="facts">{env.facts.map(f => <FactCard key={f.label} f={f} />)}</div>
          <div className="explorer-grid">
            <ConditionsPanel env={env} card={card} inp={inp} setInp={setInpF} gas={gas} setGas={g => setGas(g)} gases={gases} playing={playing} onPlay={play} onStop={stop} />
            <PredictionPanel pred={pred} err={err} env={env} crossing={crossing} demoLog={demoLog} />
          </div>
          {gas === 'co2' && <FlexPanel />}
          <div className="explorer-grid second">
            <div className="panel">
              <h3>Decision boundary with the real experiments ({env.short})</h3>
              {menv ? <BoundaryPlot data={bnd} current={inp} inRange={!!pred?.in_training_range} /> : <div className="plot-empty">No real experiment exists for {MATERIAL_LABEL[inp.material] || inp.material} at {env.short}, so there is nothing to plot and nothing to predict. Pick a material with tests here.</div>}
            </div>
            <div className="panel">
              <h3>Nearest real experiments</h3>
              {pred?.nearest_experiments.map(e => (
                <a key={e.row_id} className="exp" href={e.source_url} target="_blank" rel="noreferrer">
                  <div className="exp-top"><span className="pill" style={{ background: OUTCOME_COLOR[e.outcome] }}>{OUTCOME_LABEL[e.outcome]}</span><b>{e.report_id}</b><span className="muted">{e.source_location}</span></div>
                  <div className="exp-cond">{e.gravity_g ?? 0} g · {e.oxygen_pct}% O₂ · {e.pressure_kpa} kPa · {e.flow_cm_s} cm/s {e.flow_direction} · {MATERIAL_LABEL[e.material] || e.material}</div>
                  <div className="exp-q">“{e.quote}”</div>
                  <div className="exp-src muted">{e.source_title} · {e.facility}</div>
                </a>
              ))}
            </div>
          </div>
          <AskPanel envName={env.name} />
        </section>
      )}

      {env && <SafetyBlock env={env} />}
      <Resources card={card} />
      <ModelSection card={card} />
      <DisclosureTeam />
      <Footer />
    </>
  )
}

