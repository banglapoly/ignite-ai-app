import { useEffect, useMemo, useRef, useState } from 'react'
import type { Boundary, ModelCard, Prediction, Outcome } from '../lib/api'
import { DIRECTION_LABEL, MATERIAL_LABEL, OUTCOME_COLOR, OUTCOME_LABEL, OUTCOMES, getJSON, postPredict } from '../lib/api'
import BoundaryPlot from './BoundaryPlot'

type Inputs = { oxygen_pct: number; pressure_kpa: number; flow_cm_s: number; material: string; flow_direction: string }

const PRESETS: { id: string; label: string; hint: string; inp: Inputs; demo?: boolean }[] = [
  { id: 'demo', label: '▶ Killer demo: ISS fabric, 21 → 17% O₂', hint: 'SIBAL fabric, 1 atm, 3 cm/s concurrent flow (BASS/BASS-II conditions). Press play and watch the regime flip.',
    inp: { oxygen_pct: 21, pressure_kpa: 101.3, flow_cm_s: 3, material: 'SIBAL_fabric', flow_direction: 'concurrent' }, demo: true },
  { id: 'paper', label: '▶ Quiescent paper, 21 → 17% O₂', hint: 'Thin cellulose, 1 atm, no flow (Olson 1987 drop-tower tests): the extinction limit sits at 21%.',
    inp: { oxygen_pct: 21, pressure_kpa: 101.3, flow_cm_s: 0, material: 'cellulose_thin', flow_direction: 'quiescent' }, demo: true },
  { id: 'saffire', label: 'Exploration atmosphere (Saffire VI)', hint: 'SIBAL fabric at 54.1 kPa / 31% O₂, 20 cm/s — a lunar-mission style cabin.',
    inp: { oxygen_pct: 31, pressure_kpa: 54.1, flow_cm_s: 20, material: 'SIBAL_fabric', flow_direction: 'concurrent' } },
  { id: 'nomex', label: 'Nomex at its 0g limit', hint: 'Nomex HT90-40, 1 atm, 30 cm/s concurrent: 0g MOC 22%, ULOI 23%.',
    inp: { oxygen_pct: 22.5, pressure_kpa: 101.3, flow_cm_s: 30, material: 'Nomex_HT90-40', flow_direction: 'concurrent' } },
  { id: 'out', label: 'Outside the envelope', hint: 'SIBAL at 14% O₂ was never tested: the tool refuses to predict.',
    inp: { oxygen_pct: 14, pressure_kpa: 101.3, flow_cm_s: 3, material: 'SIBAL_fabric', flow_direction: 'concurrent' } },
]

function fmt(v: number, d = 1) { return Number.isInteger(v) ? String(v) : v.toFixed(d) }

function RangeSlider({ label, unit, value, min, max, step, env, onChange, sqrt }: {
  label: string; unit: string; value: number; min: number; max: number; step: number; env?: [number, number]
  onChange: (v: number) => void; sqrt?: boolean
}) {
  const toPos = (v: number) => sqrt ? Math.sqrt((v - min) / (max - min)) * 1000 : ((v - min) / (max - min)) * 1000
  const fromPos = (p: number) => { const f = p / 1000; const v = sqrt ? min + f * f * (max - min) : min + f * (max - min); return Math.round(v / step) * step }
  const out = env ? (value < env[0] - 1e-9 || value > env[1] + 1e-9) : false
  const a = env ? toPos(env[0]) / 10 : 0, b = env ? toPos(env[1]) / 10 : 100
  return (
    <label className={`slider ${out ? 'out' : ''}`}>
      <div className="slider-top">
        <span>{label}</span>
        <span className="slider-val">
          <input type="number" value={+value.toFixed(2)} step={step} min={min} max={max}
            onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v) }} />
          {unit}
        </span>
      </div>
      <input type="range" min={0} max={1000} step={1} value={toPos(Math.min(Math.max(value, min), max))}
        onChange={e => onChange(+fromPos(+e.target.value).toFixed(3))}
        style={{ background: `linear-gradient(90deg, #1a2140 0%, #1a2140 ${a}%, #2f6b5c ${a}%, #2f6b5c ${Math.max(b, a + 0.8)}%, #1a2140 ${Math.max(b, a + 0.8)}%)` }} />
      <div className="slider-env">{env ? <>tested for this material: {fmt(env[0], 2)}–{fmt(env[1], 2)} {unit}</> : null}{out && <b> · outside</b>}</div>
    </label>
  )
}

export default function Explorer({ card }: { card: ModelCard | null }) {
  const [inp, setInp] = useState<Inputs>(PRESETS[0].inp)
  const [pred, setPred] = useState<Prediction | null>(null)
  const [bnd, setBnd] = useState<Boundary | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [demoLog, setDemoLog] = useState<{ o2: number; pred: Outcome | null; p?: number }[]>([])
  const [crossing, setCrossing] = useState<{ from: Outcome; to: Outcome; at: number; a?: string; b?: string } | null>(null)
  const [playing, setPlaying] = useState(false)
  const playRef = useRef<number | null>(null)
  const lastPred = useRef<Outcome | null>(null)

  const env = card?.training_range.materials[inp.material]
  const glob = card?.training_range.global
  const materials = useMemo(() => card ? Object.keys(card.training_range.materials).sort((a, b) => (card.training_range.materials[b].n - card.training_range.materials[a].n)) : [], [card])

  // prediction (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      postPredict(inp).then(p => { setPred(p); setErr(null) }).catch(e => setErr(String(e)))
    }, 90)
    return () => clearTimeout(t)
  }, [inp])

  // boundary slice
  const axes = useMemo(() => {
    if (!env) return null
    const y = env.flow_cm_s[1] > env.flow_cm_s[0] ? 'flow_cm_s' : env.pressure_kpa[1] > env.pressure_kpa[0] ? 'pressure_kpa' : 'flow_cm_s'
    const third = y === 'flow_cm_s' ? 'pressure_kpa' : 'flow_cm_s'
    return { x: 'oxygen_pct', y, third }
  }, [env])
  const thirdVal = axes ? (inp as any)[axes.third] as number : 0
  useEffect(() => {
    if (!axes) return
    const t = setTimeout(() => {
      const q = new URLSearchParams({ material: inp.material, flow_direction: inp.flow_direction, x: axes.x, y: axes.y, [axes.third]: String(thirdVal), nx: '70', ny: '56' })
      getJSON<Boundary>('/boundary?' + q.toString()).then(setBnd).catch(() => setBnd(null))
    }, 200)
    return () => clearTimeout(t)
  }, [inp.material, inp.flow_direction, axes, thirdVal])

  // track boundary crossings while the demo plays
  useEffect(() => {
    if (!pred) return
    const cur = pred.prediction
    if (playing) {
      setDemoLog(l => (l.length && l[l.length - 1].o2 === pred.inputs.oxygen_pct) ? l : [...l, { o2: pred.inputs.oxygen_pct, pred: cur, p: cur && pred.probabilities ? pred.probabilities[cur] : undefined }])
      if (lastPred.current && cur && cur !== lastPred.current) {
        setCrossing({ from: lastPred.current, to: cur, at: pred.inputs.oxygen_pct,
          a: pred.contrast_experiment ? `${pred.contrast_experiment.report_id} — ${pred.contrast_experiment.oxygen_pct}% O₂, ${pred.contrast_experiment.flow_cm_s} cm/s: ${OUTCOME_LABEL[pred.contrast_experiment.outcome]} (${pred.contrast_experiment.source_location})` : undefined,
          b: pred.supporting_experiment ? `${pred.supporting_experiment.report_id} — ${pred.supporting_experiment.oxygen_pct}% O₂, ${pred.supporting_experiment.flow_cm_s} cm/s: ${OUTCOME_LABEL[pred.supporting_experiment.outcome]} (${pred.supporting_experiment.source_location})` : undefined })
      }
    }
    if (cur) lastPred.current = cur
  }, [pred])

  const set = (k: keyof Inputs, v: any) => setInp(s => {
    const n = { ...s, [k]: v }
    if (k === 'flow_cm_s') { if (v === 0) n.flow_direction = 'quiescent'; else if (n.flow_direction === 'quiescent') n.flow_direction = card?.training_range.materials[n.material]?.flow_directions.find(d => d !== 'quiescent') || 'concurrent' }
    if (k === 'flow_direction' && v === 'quiescent') n.flow_cm_s = 0
    return n
  })
  const chooseMaterial = (m: string) => {
    const e = card?.training_range.materials[m]
    if (!e) return
    const clamp = (v: number, r: [number, number]) => Math.min(Math.max(v, r[0]), r[1])
    const dir = e.flow_directions.includes(inp.flow_direction) ? inp.flow_direction : e.flow_directions[0]
    setInp({ material: m, flow_direction: dir, oxygen_pct: clamp(inp.oxygen_pct, e.oxygen_pct), pressure_kpa: clamp(inp.pressure_kpa, e.pressure_kpa),
      flow_cm_s: dir === 'quiescent' ? 0 : clamp(Math.max(inp.flow_cm_s, 0.5), e.flow_cm_s) })
  }

  const stop = () => { if (playRef.current) clearInterval(playRef.current); playRef.current = null; setPlaying(false) }
  const play = (preset = PRESETS.find(p => p.inp.material === inp.material && p.demo) || PRESETS[0]) => {
    stop()
    setDemoLog([]); setCrossing(null); lastPred.current = null
    setInp({ ...preset.inp, oxygen_pct: 21 })
    setPlaying(true)
    let o2 = 21
    playRef.current = window.setInterval(() => {
      o2 = +(o2 - 0.25).toFixed(2)
      if (o2 < 17) { stop(); return }
      setInp(s => ({ ...s, oxygen_pct: o2 }))
    }, 420)
  }
  useEffect(() => () => stop(), [])

  const u = pred?.uncertainty
  return (
    <div className="explorer">
      <div className="presets">
        {PRESETS.map(p => (
          <button key={p.id} className={`chip ${p.demo ? 'chip-demo' : ''}`} title={p.hint}
            onClick={() => { if (p.demo) play(p); else { stop(); setCrossing(null); setDemoLog([]); setInp(p.inp) } }}>{p.label}</button>
        ))}
      </div>

      <div className="explorer-grid">
        <div className="panel controls">
          <h3>Conditions</h3>
          <label className="field">
            <span>Material</span>
            <select value={inp.material} onChange={e => { stop(); setCrossing(null); setDemoLog([]); chooseMaterial(e.target.value) }}>
              {materials.map(m => <option key={m} value={m}>{MATERIAL_LABEL[m] || m} — {card!.training_range.materials[m].n} tests</option>)}
            </select>
          </label>
          <label className="field">
            <span>Flow direction</span>
            <select value={inp.flow_direction} onChange={e => { stop(); set('flow_direction', e.target.value) }}>
              {['concurrent', 'opposed', 'quiescent'].map(d => <option key={d} value={d}>{DIRECTION_LABEL[d]}{env && !env.flow_directions.includes(d) ? ' — not tested' : ''}</option>)}
            </select>
          </label>
          {glob && <>
            <RangeSlider label="Oxygen" unit="%" value={inp.oxygen_pct} min={10} max={100} step={0.1} env={env?.oxygen_pct} onChange={v => { stop(); set('oxygen_pct', v) }} />
            <RangeSlider label="Pressure" unit="kPa" value={inp.pressure_kpa} min={30} max={210} step={0.1} env={env?.pressure_kpa} onChange={v => { stop(); set('pressure_kpa', v) }} />
            <RangeSlider label="Flow velocity" unit="cm/s" value={inp.flow_cm_s} min={0} max={60} step={0.1} env={env?.flow_cm_s} sqrt onChange={v => { stop(); set('flow_cm_s', v) }} />
          </>}
          <div className="demo-row">
            {!playing ? <button className="btn" onClick={() => play()}>▶ Slide O₂ 21 → 17%</button> : <button className="btn ghost" onClick={stop}>■ Stop</button>}
          </div>
          <p className="small muted">Green band on each slider = range actually tested for the selected material. Outside it, the API refuses to predict.</p>
        </div>

        <div className="panel result">
          {err && <div className="alert">API error: {err}. Is the backend running on port 8000?</div>}
          {pred && !pred.in_training_range && (
            <div className="refusal">
              <div className="refusal-title">⛔ No prediction — outside the published experimental envelope</div>
              <ul>{pred.range_violations?.map(r => <li key={r}>{r}</li>)}</ul>
              <p>A fire-safety tool that quietly guesses is worse than no tool. Nearest real experiments are shown for reference only.</p>
            </div>
          )}
          {pred && pred.in_training_range && pred.prediction && pred.probabilities && (
            <>
              <div className="verdict" style={{ borderColor: OUTCOME_COLOR[pred.prediction] }}>
                <div className="verdict-label">Predicted flame-spread regime</div>
                <div className="verdict-class" style={{ color: OUTCOME_COLOR[pred.prediction] }}>{OUTCOME_LABEL[pred.prediction]}</div>
                <div className={`conf conf-${u?.level}`}>confidence: {u?.level}</div>
              </div>
              <div className="probs">
                {OUTCOMES.map(o => (
                  <div key={o} className="prob-row">
                    <span>{OUTCOME_LABEL[o]}</span>
                    <div className="bar"><div style={{ width: `${pred.probabilities![o] * 100}%`, background: OUTCOME_COLOR[o] }} /></div>
                    <b>{(pred.probabilities![o] * 100).toFixed(0)}%</b>
                  </div>
                ))}
              </div>
              {u && <div className="unc small">
                top probability {u.max_probability} · margin {u.margin_to_second} · {u.neighbours_agreeing}/3 nearest tests agree · nearest distance {u.nearest_distance}
              </div>}
            </>
          )}
          {crossing && (
            <div className="crossing">
              <b>Boundary crossed at {crossing.at}% O₂:</b> {OUTCOME_LABEL[crossing.from]} → {OUTCOME_LABEL[crossing.to]}
              {crossing.b && <div>▸ Evidence for <i>{OUTCOME_LABEL[crossing.to]}</i>: {crossing.b}</div>}
              {crossing.a && <div>▸ Other side of the boundary: {crossing.a}</div>}
            </div>
          )}
          {demoLog.length > 0 && (
            <div className="demolog">
              {demoLog.map(d => <span key={d.o2} title={d.pred || 'refused'} style={{ background: d.pred ? OUTCOME_COLOR[d.pred] : '#555' }}>{d.o2}</span>)}
            </div>
          )}
          {pred && (
            <div className="explain">
              <div className="explain-head">Explanation <span className="tag">{pred.explanation.source === 'template' ? 'deterministic template · numbers only from the prediction object' : 'local LLM (validated)'}</span></div>
              <pre>{pred.explanation.text}</pre>
            </div>
          )}
          <button className="btn ghost small" onClick={() => setShowRaw(s => !s)}>{showRaw ? 'Hide' : 'Show'} provenance (raw /predict JSON)</button>
          {showRaw && pred && <pre className="raw">{JSON.stringify({ ...pred, cited_abstracts: undefined, related_reports: undefined }, null, 2)}</pre>}
        </div>
      </div>

      <div className="explorer-grid second">
        <div className="panel">
          <h3>Decision boundary with real experiments</h3>
          <BoundaryPlot data={bnd} current={inp} inRange={!!pred?.in_training_range} />
        </div>
        <div className="panel">
          <h3>Nearest real experiments</h3>
          {pred?.nearest_experiments.map(e => (
            <a key={e.row_id} className="exp" href={e.source_url} target="_blank" rel="noreferrer">
              <div className="exp-top">
                <span className="pill" style={{ background: OUTCOME_COLOR[e.outcome] }}>{OUTCOME_LABEL[e.outcome]}</span>
                <b>{e.report_id}</b><span className="muted">{e.source_location}</span>
              </div>
              <div className="exp-cond">{e.oxygen_pct}% O₂ · {e.pressure_kpa} kPa · {e.flow_cm_s} cm/s {e.flow_direction} · {MATERIAL_LABEL[e.material] || e.material}</div>
              <div className="exp-q">“{e.quote}”</div>
              <div className="exp-src muted">{e.source_title} — {e.facility}</div>
            </a>
          ))}
          {pred?.related_reports?.length ? <>
            <h4>Related reports (TF-IDF retrieval over {`NTRS`} titles + abstracts)</h4>
            {pred.related_reports.map(r => (
              <a key={r.report_id} className="rel" href={r.source_url} target="_blank" rel="noreferrer">
                <b>{r.report_id}</b> {r.title} <span className="muted">({r.date?.slice(0, 4) || 'n.d.'})</span>
                <div className="muted small">{r.abstract_snippet}</div>
              </a>
            ))}
          </> : null}
        </div>
      </div>
    </div>
  )
}
