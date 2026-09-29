import type { EnvData, GasMix, Inputs, MaterialEnv, ModelCard, Prediction } from '../lib/api'
import { DIRECTION_LABEL, MATERIAL_LABEL, OUTCOME_COLOR, OUTCOME_LABEL, OUTCOMES, gkey } from '../lib/api'

function fmt(v: number, d = 1) { return Number.isInteger(v) ? String(v) : v.toFixed(d) }

export function RangeSlider({ label, sub, unit, value, min, max, step, env, onChange, sqrt }: {
  label: string; sub?: string; unit: string; value: number; min: number; max: number; step: number; env?: [number, number]
  onChange: (v: number) => void; sqrt?: boolean
}) {
  const toPos = (v: number) => sqrt ? Math.sqrt((v - min) / (max - min)) * 1000 : ((v - min) / (max - min)) * 1000
  const fromPos = (p: number) => { const f = p / 1000; const v = sqrt ? min + f * f * (max - min) : min + f * (max - min); return Math.round(v / step) * step }
  const out = env ? (value < env[0] - 1e-9 || value > env[1] + 1e-9) : false
  const a = env ? toPos(env[0]) / 10 : 0, b = env ? toPos(env[1]) / 10 : 100
  return (
    <label className={`slider ${out ? 'out' : ''}`}>
      <div className="slider-top">
        <span>{label}{sub && <small> {sub}</small>}</span>
        <span className="slider-val">
          <input type="number" value={+value.toFixed(2)} step={step} min={min} max={max}
            onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v) }} />
          {unit}
        </span>
      </div>
      <input type="range" min={0} max={1000} step={1} value={toPos(Math.min(Math.max(value, min), max))} aria-label={label}
        onChange={e => onChange(+fromPos(+e.target.value).toFixed(3))}
        style={{ background: `linear-gradient(90deg, #172036 0%, #172036 ${a}%, #1f7a5c ${a}%, #1f7a5c ${Math.max(b, a + 0.8)}%, #172036 ${Math.max(b, a + 0.8)}%)` }} />
      <div className="slider-env">{env ? <>tested here: {fmt(env[0], 2)}–{fmt(env[1], 2)} {unit}</> : <>no tests for this material at this gravity</>}{out && <b> · outside → no prediction</b>}</div>
    </label>
  )
}

export function ConditionsPanel({ env, card, inp, setInp, gas, setGas, gases, playing, onPlay, onStop }: {
  env: EnvData; card: ModelCard | null; inp: Inputs; setInp: (f: (s: Inputs) => Inputs) => void; gas: string; setGas: (g: string) => void; gases: GasMix[]
  playing: boolean; onPlay: () => void; onStop: () => void
}) {
  const menv: MaterialEnv | undefined = env.dataset.materials[inp.material]
  const allMats = card ? Object.keys(card.training_range.materials) : []
  const here = Object.keys(env.dataset.materials)
  const mats = [...here.sort((a, b) => env.dataset.materials[b].n - env.dataset.materials[a].n), ...allMats.filter(m => !here.includes(m)).sort()]
  const set = (k: keyof Inputs, v: any) => setInp(s => {
    const n = { ...s, [k]: v }
    if (env.gravity_g === 0) {
      if (k === 'flow_cm_s') { if (v === 0) n.flow_direction = 'quiescent'; else if (n.flow_direction === 'quiescent') n.flow_direction = menv?.flow_directions.find(d => d !== 'quiescent') || 'concurrent' }
      if (k === 'flow_direction' && v === 'quiescent') n.flow_cm_s = 0
    }
    return n
  })
  const chooseMaterial = (m: string) => {
    const e = env.dataset.materials[m]
    const clamp = (v: number, r: [number, number]) => Math.min(Math.max(v, r[0]), r[1])
    if (!e) { setInp(s => ({ ...s, material: m })); return }
    const dir = e.flow_directions.includes(inp.flow_direction) ? inp.flow_direction : e.flow_directions[0]
    setInp(() => ({ material: m, flow_direction: dir, oxygen_pct: clamp(inp.oxygen_pct, e.oxygen_pct), pressure_kpa: clamp(inp.pressure_kpa, e.pressure_kpa),
      flow_cm_s: dir === 'quiescent' ? 0 : clamp(inp.flow_cm_s, e.flow_cm_s) }))
  }
  const g = gases.find(x => x.id === gas)
  return (
    <div className="panel controls">
      <h3>Conditions <span className="muted small">· {env.short}</span></h3>
      <label className="field">
        <span>Material</span>
        <select value={inp.material} onChange={e => { onStop(); chooseMaterial(e.target.value) }}>
          {mats.map(m => <option key={m} value={m}>{MATERIAL_LABEL[m] || m} ({env.dataset.materials[m] ? env.dataset.materials[m].n : 'no tests here'})</option>)}
        </select>
        <small className="muted field-hint">{env.dataset.materials[inp.material] ? `${env.dataset.materials[inp.material].n} real tests of this material at ${env.short}. The number after each material is its test count here.` : `No real tests of this material at ${env.short}.`}</small>
      </label>
      <div className="field">
        <span>Gas mix</span>
        <div className="chips">
          {gases.map(x => <button key={x.id} className={`chip ${gas === x.id ? 'on' : ''} ${x.modelled ? '' : 'chip-warn'}`} onClick={() => { onStop(); setGas(x.id) }}>{x.label}{!x.modelled && ' ⚠'}</button>)}
        </div>
        {g && !g.modelled && <p className="small warn-text">{g.note} {g.source && <a href={g.source.url} target="_blank" rel="noreferrer">Source</a>}</p>}
      </div>
      <RangeSlider label="Oxygen (O₂)" unit="%" value={inp.oxygen_pct} min={10} max={40} step={0.1} env={menv?.oxygen_pct} onChange={v => { onStop(); set('oxygen_pct', v) }} />
      <RangeSlider label="Cabin pressure" unit="kPa" value={inp.pressure_kpa} min={30} max={210} step={0.1} env={menv?.pressure_kpa} onChange={v => { onStop(); set('pressure_kpa', v) }} />
      <RangeSlider label="Ventilation fan speed" sub="(air velocity at the sample)" unit="cm/s" value={inp.flow_cm_s} min={0} max={60} step={0.1} env={menv?.flow_cm_s} sqrt onChange={v => { onStop(); set('flow_cm_s', v) }} />
      <label className="field">
        <span>Flow direction {env.gravity_g > 0 && <small className="muted">(at 1/lunar/Martian g: concurrent = upward burning, opposed = downward)</small>}</span>
        <select value={inp.flow_direction} onChange={e => { onStop(); set('flow_direction', e.target.value) }}>
          {['concurrent', 'opposed', 'quiescent'].map(d => <option key={d} value={d}>{DIRECTION_LABEL[d]}{menv && !menv.flow_directions.includes(d) ? ' — not tested' : ''}</option>)}
        </select>
      </label>
      <div className="demo-row">
        {!playing ? <button className="btn" onClick={onPlay} disabled={!menv}>▶ Slide O₂ down through the tested range</button> : <button className="btn ghost" onClick={onStop}>■ Stop</button>}
      </div>
      <p className="small muted">Green band = the range actually tested for this material at {env.short}. Outside it, or for an untested material, gravity or gas mix, the range guard refuses to predict.</p>
    </div>
  )
}

export function PredictionPanel({ pred, err, crossing, demoLog, env }: {
  pred: Prediction | null; err: string | null; env: EnvData
  crossing: { from: string; to: string; at: number; a?: string; b?: string } | null; demoLog: { o2: number; pred: string | null }[]
}) {
  const u = pred?.uncertainty
  const acc = pred?.model.oof_accuracy_by_gravity?.[gkey(env.gravity_g)]
  return (
    <div className="panel result">
      {err && <div className="alert">API error: {err}. Is the backend running on port 8000?</div>}
      {pred && !pred.in_training_range && (
        <div className="refusal">
          <div className="refusal-title">⛔ No prediction: outside the published experimental evidence</div>
          <ul>{pred.range_violations?.map(r => <li key={r}>{r}</li>)}</ul>
          <p>A fire-safety tool that quietly guesses is worse than no tool. Treat these conditions as <b>untested and potentially flammable</b>. The nearest real experiments are listed below for reference only.</p>
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
          {u && <div className="unc small">top probability {u.max_probability} · margin {u.margin_to_second} · {u.neighbours_agreeing}/3 nearest tests agree · nearest distance {u.nearest_distance}</div>}
          {env.gravity_g > 0 && acc && <div className="caution small">⚠ Only {acc.n} real tests exist at {env.short}; out-of-fold accuracy at this gravity is {(acc.accuracy * 100).toFixed(0)}%. Read this as "what the nearest published test showed", not as a general model.</div>}
        </>
      )}
      {crossing && (
        <div className="crossing">
          <b>Boundary crossed at {crossing.at}% O₂:</b> {OUTCOME_LABEL[crossing.from as keyof typeof OUTCOME_LABEL]} → {OUTCOME_LABEL[crossing.to as keyof typeof OUTCOME_LABEL]}
          {crossing.b && <div>▸ Evidence on the new side: {crossing.b}</div>}
          {crossing.a && <div>▸ Other side of the boundary: {crossing.a}</div>}
        </div>
      )}
      {demoLog.length > 0 && <div className="demolog">{demoLog.map(d => <span key={d.o2} title={d.pred || 'refused'} style={{ background: d.pred ? OUTCOME_COLOR[d.pred as keyof typeof OUTCOME_COLOR] : '#555' }}>{d.o2}</span>)}</div>}
      {pred && (
        <div className="explain">
          <div className="explain-head">Explanation <span className="tag">{pred.explanation.source === 'template' ? 'deterministic template · numbers only from the prediction object' : 'local LLM (validated)'}</span></div>
          <ExplanationText text={pred.explanation.text} />
        </div>
      )}
    </div>
  )
}

/** Explanation text: lines starting with "• " are shown as a real bullet list, other lines as paragraphs. */
function ExplanationText({ text }: { text: string }) {
  const blocks: (string | string[])[] = []
  for (const line of text.split('\n')) {
    if (line.startsWith('\u2022 ')) {
      const last = blocks[blocks.length - 1]
      if (Array.isArray(last)) last.push(line.slice(2)); else blocks.push([line.slice(2)])
    } else if (line.trim()) blocks.push(line)
  }
  return <div className="explain-text">{blocks.map((b, i) => Array.isArray(b) ? <ul key={i}>{b.map(li => <li key={li}>{li}</li>)}</ul> : <p key={i}>{b}</p>)}</div>
}
