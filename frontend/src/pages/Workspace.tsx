import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import type { Prediction } from '../lib/api'
import { MATERIAL_LABEL, postPredict } from '../lib/api'
import AskPanel from '../components/AskPanel'
import { ConditionsPanel, PredictionPanel } from '../components/Conditions'
import Disclaimer from '../components/Disclaimer'
import { EvidenceList } from '../components/EvidenceList'
import ProvenanceNote from '../components/ProvenanceNote'
import { PageHead } from '../components/Layout'
import { Link, navigate, useQuery } from '../lib/router'
import { useSim } from '../lib/sim'
import { investigationNext, useWorkspace } from '../lib/workspace/WorkspaceContext'
import {
  STEPS,
  evidenceQuestion,
  parseShare,
  shareQuery,
  type FlowDirection,
  type ScenarioConditions,
  type StepId,
} from '../lib/workspace/logic'
import type { FlameState } from '../three/Flame'

const FlameScene = lazy(() => import('../components/FlameScene'))

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function snapshot(envId: string, gravity: number, inp: { oxygen_pct: number; pressure_kpa: number; flow_cm_s: number; material: string; flow_direction: string }, gas: string): ScenarioConditions {
  return {
    envId,
    gravity_g: gravity,
    oxygen_pct: inp.oxygen_pct,
    pressure_kpa: inp.pressure_kpa,
    flow_cm_s: inp.flow_cm_s,
    material: inp.material,
    flow_direction: inp.flow_direction as FlowDirection,
    gas_mix: gas,
  }
}

export default function Workspace({ card }: { card: import('../lib/api').ModelCard | null }) {
  const ws = useWorkspace()
  const query = useQuery()
  const id = query.get('id')
  const shared = query.get('share') === '1'
  const sim = useSim()
  const inv = ws.doc.investigations.find(i => i.id === id) ?? null
  const [title, setTitle] = useState('Untitled investigation')
  const [question, setQuestion] = useState('')
  const [notes, setNotes] = useState('')
  const [label, setLabel] = useState('Scenario')
  const [picked, setPicked] = useState<string[]>([])
  const [results, setResults] = useState<Prediction[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [linkNote, setLinkNote] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const [pair, setPair] = useState<[Prediction | null, Prediction | null]>([null, null])
  const applied = useRef('')

  useEffect(() => { if (inv) ws.markOpened(inv.id) }, [inv?.id])
  useEffect(() => {
    if (!inv) return
    setTitle(inv.title)
    setQuestion(inv.question)
    setNotes(inv.notes)
    setPicked([])
    setResults(null)
  }, [inv?.id])

  useEffect(() => {
    if (!sim.envs.length) return
    if (inv) {
      const scenario = inv.scenarios.find(s => s.id === inv.activeScenarioId) ?? inv.scenarios[inv.scenarios.length - 1]
      const key = `${inv.id}:${scenario?.id ?? 'none'}`
      if (applied.current === key) return
      applied.current = key
      if (scenario) sim.loadScenario(scenario.conditions)
      return
    }
    if (!shared) return
    const parsed = parseShare(location.search)
    if (applied.current === location.search) return
    applied.current = location.search
    if (!parsed.ok) { setShareError(parsed.error); return }
    setShareError(null)
    sim.loadScenario(parsed.conditions)
  }, [inv?.id, inv?.activeScenarioId, sim.envs.length, shared])

  const step = inv ? investigationNext(inv) : null
  const show = (name: StepId) => {
    if (!inv || inv.mode === 'sandbox') return true
    const neededId: StepId = step?.id === 'backup' || step?.id === 'question' || step?.id === 'conditions' || step?.id === 'evidence' || step?.id === 'compare' || step?.id === 'notes' ? step.id === 'backup' ? 'notes' : step.id : inv.step
    return STEPS.indexOf(name) <= Math.max(STEPS.indexOf(inv.step), STEPS.indexOf(neededId))
  }
  const materials = card ? Object.keys(card.training_range.materials) : []
  const cond = sim.env && sim.inp ? snapshot(sim.env.id, sim.env.gravity_g, sim.inp, sim.gas) : null
  const askSeed = cond ? evidenceQuestion(cond) : 'What did published NASA combustion experiments report for this material and gravity?'

  const historyOptions = inv?.scenarios ?? []
  const left = historyOptions.find(s => s.id === leftId)
  const right = historyOptions.find(s => s.id === rightId)
  const sharedFields = left && right ? (['envId', 'gravity_g', 'oxygen_pct', 'pressure_kpa', 'flow_cm_s', 'flow_direction', 'gas_mix'] as const).filter(k => left.conditions[k] !== right.conditions[k]) : []

  useEffect(() => {
    let live = true
    if (!left || !right) { setPair([null, null]); return }
    Promise.all([left, right].map(s => postPredict({ ...s.conditions, gravity_g: s.conditions.gravity_g }))).then(preds => { if (live) setPair([preds[0], preds[1]]) })
    return () => { live = false }
  }, [leftId, rightId, inv?.id])

  const flame: FlameState = sim.pred ? (sim.pred.in_training_range ? sim.pred.prediction : 'refused') : null
  const suggested = useMemo(() => materials.filter(m => m !== sim.inp?.material).slice(0, 1), [materials, sim.inp?.material])

  function toggleMaterial(material: string) {
    setPicked(list => list.includes(material) ? list.filter(m => m !== material) : [...list, material])
    setResults(null)
  }

  async function runMaterials(list: string[]) {
    if (!sim.env || !sim.inp || list.length < 2) return
    setBusy(true)
    try {
      const preds = await Promise.all(list.map(material => postPredict({ ...sim.inp, material, gravity_g: sim.env!.gravity_g, gas_mix: sim.gas })))
      setResults(preds)
    } finally { setBusy(false) }
  }

  function saveDraft() {
    if (!cond) return
    const newId = ws.createInvestigation({ title: title || 'Imported parameter link', question, mode: 'sandbox', scenario: cond })
    if (newId) navigate(`/workspace?id=${newId}`)
  }

  return (
    <>
      <PageHead kicker="Investigation" title={inv ? inv.title : shared ? 'Parameter link' : 'No investigation open'}>
        {inv ? (inv.question || 'Add the question this investigation should answer.') : 'Open a saved investigation, or keep a parameter link as a new one. Parameter links do not carry private notes.'}
      </PageHead>
      <section className="section wide page-body">
        <Disclaimer compact />
        {ws.actionError && <div className="alert" role="alert">{ws.actionError}</div>}
        {shareError && <div className="alert" role="alert">{shareError}</div>}
        {shared && !inv && <div className="caution" role="status">This is a parameter link. Private notes and the written question are not in the URL. Nothing is stored until you save it in this browser.</div>}
        {linkNote && <p className="small" role="status">{linkNote}</p>}

        {!inv && !shared && (
          <div className="next-callout">
            <div>
              <h2>Choose an investigation</h2>
              <p>The dashboard lists what this browser has saved. The sandbox is where you can explore before saving.</p>
            </div>
            <div className="cta">
              <Link to="/dashboard" className="btn">Dashboard</Link>
              <Link to="/simulator" className="btn ghost">Sandbox</Link>
            </div>
          </div>
        )}

        {(inv || (shared && cond)) && sim.env && sim.inp && (
          <>
            {inv && step && (
              <div className="next-callout">
                <div>
                  <div className="pagehead-kicker">Next step</div>
                  <h2>{step.title}</h2>
                  <p>{step.detail}</p>
                </div>
                <div className="cta">
                  <button className="btn ghost" onClick={() => ws.updateInvestigation(inv.id, { mode: inv.mode === 'guided' ? 'sandbox' : 'guided' })}>
                    {inv.mode === 'guided' ? 'Show every section' : 'Use guided steps'}
                  </button>
                </div>
              </div>
            )}

            {inv && (
              <ol className="path-rail path-rail--steps" aria-label="Investigation steps">
                {STEPS.map(name => (
                  <li key={name}>
                    <button type="button" aria-current={inv.step === name ? 'step' : undefined} className={inv.step === name ? 'on' : ''} onClick={() => ws.updateInvestigation(inv.id, { step: name })}>
                      {name}
                    </button>
                  </li>
                ))}
              </ol>
            )}

            <div className="split-2">
              <label className="field">Title
                <input value={title} maxLength={120} aria-label="Investigation title" onChange={e => setTitle(e.target.value)} onBlur={() => { if (inv) ws.updateInvestigation(inv.id, { title }) }} />
              </label>
              {(show('question') || !inv) && (
                <label className="field">Question
                  <textarea value={question} maxLength={800} rows={3} aria-label="Investigation question" onChange={e => setQuestion(e.target.value)} onBlur={() => { if (inv) ws.updateInvestigation(inv.id, { question }, { kind: 'question', summary: 'Question updated' }) }} />
                </label>
              )}
            </div>

            {show('conditions') && (
              <>
                <h2>Conditions</h2>
                <p className="small muted">The controls are the same gravity, oxygen, pressure, airflow, gas-mix, and material inputs as the sandbox. Saving appends a scenario. Changing the environment tab resets unsaved slider positions to that preset’s defaults.</p>
                <ProvenanceNote gravity={sim.env.gravity_g} preset={sim.env.short} />
                <div className="explorer-grid">
                  <ConditionsPanel env={sim.env} card={card} inp={sim.inp} setInp={sim.setInpF} gas={sim.gas} setGas={sim.setGas} gases={sim.gases} playing={sim.playing} onPlay={sim.play} onStop={sim.stop} />
                  <div className="panel">
                    <h3>Scenario history</h3>
                    <label className="field">Label for the next save
                      <input value={label} maxLength={80} aria-label="Scenario label" onChange={e => setLabel(e.target.value)} />
                    </label>
                    {inv ? (
                      <button className="btn" onClick={() => cond && ws.saveScenario(inv.id, cond, label || 'Scenario')}>Save scenario</button>
                    ) : (
                      <button className="btn" onClick={saveDraft}>Save as a new investigation</button>
                    )}
                    <ul className="scenario-list">
                      {(inv?.scenarios ?? []).map(s => (
                        <li key={s.id}>
                          <button type="button" className={s.id === inv?.activeScenarioId ? 'on' : ''} onClick={() => inv && ws.selectScenario(inv.id, s.id)}>
                            <b>{s.label}</b>
                            <span>{s.conditions.envId} · {s.conditions.oxygen_pct}% O₂ · {s.conditions.pressure_kpa} kPa · {s.conditions.flow_cm_s} cm/s · {MATERIAL_LABEL[s.conditions.material] || s.conditions.material} · {s.conditions.gas_mix}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}

            {show('evidence') && (
              <>
                <h2>Evidence and estimate</h2>
                <div className="layer-grid">
                  <article className="panel">
                    <h3><span className="layer">Experiment evidence</span></h3>
                    <EvidenceList experiments={sim.pred?.nearest_experiments ?? []} />
                  </article>
                  <article className="panel bare">
                    <h3><span className="layer">Statistical model estimate</span></h3>
                    <PredictionPanel pred={sim.pred} err={sim.err} env={sim.env} crossing={sim.crossing} demoLog={sim.demoLog} />
                  </article>
                </div>
                <h3><span className="layer">Illustrative 3D flame</span></h3>
                <p className="small muted">Illustration only. Shape follows a √g buoyancy sketch, and colour follows the inputs. It is not evidence and not a physics solution.</p>
                <div className="viewport compact">
                  <div className="viewport-canvas">
                    <Suspense fallback={<div className="canvas-fallback" />}>
                      <FlameScene env={sim.env.id} params={{ gravity: sim.env.gravity_g, o2: sim.inp.oxygen_pct, pressure: sim.inp.pressure_kpa, flow: sim.inp.flow_cm_s, flowDir: sim.inp.flow_direction, state: flame }} autoRotate={!sim.playing} />
                    </Suspense>
                  </div>
                </div>
              </>
            )}

            {show('compare') && inv && (
              <>
                <h2>Compare under shared conditions</h2>
                <p className="small muted">Materials are swapped. Oxygen, pressure, airflow, flow direction, gravity, and gas mix stay on the values currently on the controls. Results are recomputed from the loaded model when you run the comparison. They are not stored as if they were measurements.</p>
                <div className="chips" role="group" aria-label="Materials to compare">
                  {materials.map(m => (
                    <button key={m} type="button" className={`chip ${picked.includes(m) ? 'on' : ''}`} aria-pressed={picked.includes(m)} onClick={() => toggleMaterial(m)}>{MATERIAL_LABEL[m] || m}</button>
                  ))}
                </div>
                <div className="cta">
                  <button className="btn" disabled={busy || picked.length < 2} onClick={() => runMaterials(picked)}>{busy ? 'Comparing…' : 'Compare selected materials'}</button>
                  <button className="btn ghost" disabled={busy} onClick={() => { const list = [sim.inp!.material, ...suggested].filter((m, i, a) => a.indexOf(m) === i); setPicked(list); runMaterials(list) }}>Compare current material with another loaded material</button>
                </div>
                {results && cond && (
                  <>
                    <div className="compare-grid">
                      {results.map(pred => {
                        const mat = pred.inputs.material
                        return (
                          <article key={mat} className="panel">
                            <h3>{MATERIAL_LABEL[mat] || mat}</h3>
                            <p className="small muted">Shared: {cond.oxygen_pct}% O₂ · {cond.pressure_kpa} kPa · {cond.flow_cm_s} cm/s · {cond.gravity_g} g · {cond.gas_mix}</p>
                            <PredictionPanel pred={pred} err={null} env={sim.env!} crossing={null} demoLog={[]} />
                            <EvidenceList experiments={pred.nearest_experiments} />
                          </article>
                        )
                      })}
                    </div>
                    <button className="btn" onClick={() => ws.saveComparison(inv.id, results.map(r => r.inputs.material), cond, label || 'Material comparison')}>Save this comparison</button>
                  </>
                )}
                {inv.comparisons.length > 0 && (
                  <ul className="scenario-list">
                    {inv.comparisons.map(c => (
                      <li key={c.id}><span><b>{c.label}</b> · {c.materials.join(', ')} · {c.shared.oxygen_pct}% O₂ · {c.shared.pressure_kpa} kPa · {c.shared.flow_cm_s} cm/s · {c.shared.envId}</span></li>
                    ))}
                  </ul>
                )}

                <h3>Two saved scenarios</h3>
                <p className="small muted">If any condition besides the material differs, this is not a single-variable comparison. The differences are listed.</p>
                <div className="split-2">
                  <label className="field">First scenario
                    <select value={leftId} aria-label="First scenario" onChange={e => setLeftId(e.target.value)}>
                      <option value="">Choose</option>
                      {historyOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </label>
                  <label className="field">Second scenario
                    <select value={rightId} aria-label="Second scenario" onChange={e => setRightId(e.target.value)}>
                      <option value="">Choose</option>
                      {historyOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </label>
                </div>
                {left && right && sharedFields.length > 0 && <p className="small warn-text">These scenarios differ in {sharedFields.join(', ')}. Read them as two saved points, not as one shared-condition test.</p>}
                {left && right && sharedFields.length === 0 && <p className="small">These two scenarios share gravity, oxygen, pressure, airflow, direction, and gas mix.</p>}
                {pair[0] && pair[1] && sim.env && (
                  <div className="compare-grid">
                    {[left!, right!].map((s, i) => (
                      <article key={s.id} className="panel">
                        <h3>{s.label}</h3>
                        <p className="small">{MATERIAL_LABEL[s.conditions.material] || s.conditions.material} · {s.conditions.oxygen_pct}% O₂ · {s.conditions.pressure_kpa} kPa · {s.conditions.flow_cm_s} cm/s</p>
                        <PredictionPanel pred={pair[i]} err={null} env={sim.env!} crossing={null} demoLog={[]} />
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}

            {show('notes') && inv && (
              <>
                <h2>Private notes</h2>
                <label className="field">Notes stay in this browser and in a full backup. Parameter export and parameter links leave them out.
                  <textarea value={notes} maxLength={4000} rows={6} aria-label="Private notes" onChange={e => setNotes(e.target.value)} onBlur={() => ws.updateInvestigation(inv.id, { notes }, { kind: 'notes', summary: 'Private notes updated' })} />
                </label>
              </>
            )}

            <h2>Ask with these conditions</h2>
            <p className="small muted">The assistant only returns retrieved quotes. The suggested question names the current material and gravity. It does not include your notes.</p>
            <AskPanel envName={sim.env.name} initialQuestion={askSeed} contextNote="Suggested from the conditions on screen. Edit it before asking. Declines stay declines." />

            <div className="page-cta">
              <span>Keep a copy:</span>
              {inv && <button className="btn" onClick={() => download(`${inv.title.replace(/[^\w.-]+/g, '_') || 'investigation'}-backup.json`, ws.exportFull())}>Download full backup</button>}
              {inv && <button className="btn ghost" onClick={() => { const text = ws.exportParameters(inv.id); if (text) download(`${inv.title.replace(/[^\w.-]+/g, '_') || 'conditions'}-parameters.json`, text) }}>Download conditions only</button>}
              {cond && <button className="btn ghost" onClick={async () => {
                const url = `${location.origin}${shareQuery(cond)}`
                try { await navigator.clipboard.writeText(url); setLinkNote('Parameter link copied. It has conditions only.') }
                catch { setLinkNote(url) }
              }}>Copy parameter link</button>}
              <Link to="/predict" className="btn ghost">Open the evidence page</Link>
              <Link to="/simulator" className="btn ghost">Open the sandbox</Link>
            </div>
          </>
        )}
      </section>
    </>
  )
}
