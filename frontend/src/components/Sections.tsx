import { useEffect, useState } from 'react'
import type { EnvData, FlexSummary, ModelCard, PsiInfo, SafetySection, Experiment } from '../lib/api'
import { GRAVITY_LABEL, MATERIAL_LABEL, OUTCOME_COLOR, OUTCOME_LABEL, getJSON } from '../lib/api'
import DataTable from './DataTable'

const ICON: Record<string, string> = { radar: '📡', fan: '🌀', extinguisher: '🧯', layers: '🧵', crew: '👩‍🚀', planet: '🪐', rocket: '🚀' }
function Pct({ v }: { v: number }) { return <>{(v * 100).toFixed(1)}%</> }

export function FactCard({ f }: { f: EnvData['facts'][number] }) {
  return (
    <div className={`fact fact-${f.kind}`}>
      <div className="fact-top"><span className="fact-label">{f.label}</span>{f.kind === 'estimate' && <span className="badge-est">ESTIMATE</span>}{f.kind === 'sourced' && <span className="badge-src">SOURCED</span>}</div>
      <div className="fact-val">{f.value}</div>
      {f.quote && <q className="fact-q">{f.quote}</q>}
      {f.note && <div className="fact-note">{f.note}</div>}
      {f.source && <a className="cite" href={f.source.url} target="_blank" rel="noreferrer">{f.source.label}</a>}
    </div>
  )
}

export function SafetyBlock({ env }: { env: EnvData }) {
  const [secs, setSecs] = useState<SafetySection[]>([])
  useEffect(() => { getJSON<{ sections: SafetySection[] }>(`/safety?env=${env.id}`).then(d => setSecs(d.sections)).catch(() => {}) }, [env.id])
  return (
    <section id="safety" className="section wide">
      <h2>Fire safety measures & insights · {env.short}</h2>
      <p className="narrow-p">What NASA sources say about detecting, isolating and suppressing a fire, choosing materials and crew procedures, filtered for this environment. Every line quotes its source. This is a summary of published material, not an operational procedure.</p>
      <div className="safety-grid">
        {secs.map(s => (
          <article key={s.id} className="panel safety">
            <h3><span className="ico">{ICON[s.icon] || '•'}</span>{s.title}</h3>
            {s.items.map((f, i) => (
              <div key={i} className="sitem">
                <b>{f.label}:</b> {f.value}
                <q>{f.quote}</q>
                {f.source && <a className="cite" href={f.source.url} target="_blank" rel="noreferrer">{f.source.label}</a>}
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  )
}

export function FlexPanel({ compact }: { compact?: boolean }) {
  const [fx, setFx] = useState<FlexSummary | null>(null)
  useEffect(() => { getJSON<FlexSummary>('/flex').then(setFx).catch(() => {}) }, [])
  if (!fx?.available) return null
  return (
    <div className="panel flex">
      <h3>Real CO₂-dilution data: FLEX droplet tests (NASA PSI-69)</h3>
      <p className="small">{fx.n_tests} ISS droplet-combustion tests ({Object.entries(fx.fuels).map(([k, v]) => `${k} ${v}`).join(', ')}); {fx.n_with_co2} had CO₂ added (up to mole fraction {fx.co2_max_mole_fraction}). Counts and means below are computed directly from the <a href={fx.source.url} target="_blank" rel="noreferrer">PSI experimental table</a>.</p>
      {!compact && <div className="dt-scroll"><table className="env"><thead><tr><th>Fuel</th><th>CO₂ mole fraction</th><th>Tests</th><th>Ended in extinction</th><th>Mean extinction diameter (mm)</th><th>Mean burn time (s)</th></tr></thead>
        <tbody>{fx.by_co2.map(r => <tr key={r.fuel + r.co2_bin}><td>{r.fuel}</td><td>{r.co2_bin}</td><td>{r.n}</td><td>{r.extinctions}</td><td>{r.mean_extinction_diameter_mm}</td><td>{r.mean_burn_time_s}</td></tr>)}</tbody></table></div>}
      <ul className="small muted">{fx.notes.map(n => <li key={n}>{n}</li>)}</ul>
    </div>
  )
}

export function Resources({ card }: { card: ModelCard | null }) {
  const [psi, setPsi] = useState<PsiInfo | null>(null)
  const [rows, setRows] = useState<Experiment[]>([])
  useEffect(() => {
    getJSON<PsiInfo>('/psi').then(setPsi).catch(() => {})
    getJSON<{ rows: Experiment[] }>('/experiments').then(d => setRows(d.rows)).catch(() => {})
  }, [])
  const reports = Array.from(new Map(rows.map(r => [r.report_id, r])).values()).sort((a, b) => a.report_id.localeCompare(b.report_id))
  return (
    <section id="sources" className="section wide">
      <h2>Citations & resources</h2>
      <div className="res-grid">
        <div className="panel">
          <h3>NASA Physical Sciences Informatics (PSI): primary official source</h3>
          <p className="small">Investigation metadata (objectives, hardware, dates, DOIs, publication lists) and every public experimental table were harvested anonymously from the <a href="https://psi.nasa.gov/physci/repo/" target="_blank" rel="noreferrer">PSI repository</a> (data licence CC0-1.0 where stated). They feed Ask IGNITE-AI and corroborate the training rows. The raw PSI data files are mostly very large video and image archives. Some legacy files (for example the BASS-II test-matrix spreadsheet) returned "NoSuchKey" from PSI storage, so we cite them instead of using them.</p>
          <div className="dt-scroll"><table className="env"><thead><tr><th>Investigation</th><th>Title</th><th>Platform</th><th>Dates</th><th>Tables</th></tr></thead>
            <tbody>{psi?.investigations.map(i => <tr key={i.psi}><td><a href={i.url} target="_blank" rel="noreferrer">{i.acronym} · {i.psi}</a></td><td>{i.title}</td><td>{i.platform || '—'}</td><td>{i.start ? `${i.start} → ${i.end}` : 'not listed'}</td><td>{i.tables.length}</td></tr>)}</tbody></table></div>
          <p className="small">Also: {psi?.links.map((l, i) => <span key={l.url}>{i ? ' · ' : ''}<a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></span>)}</p>
        </div>
        <div className="panel">
          <h3>Reports behind the training rows (NTRS)</h3>
          <ol className="refs">{reports.map(r => <li key={r.report_id}><a href={r.source_url} target="_blank" rel="noreferrer">{r.report_id}</a> — {r.source_title}</li>)}</ol>
          <h3>Environment & safety sources</h3>
          <ol className="refs">{psi && Object.values(psi.sources).map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}</ol>
          <p className="small muted">The 3D scene is procedural (three.js, @react-three/fiber, drei, postprocessing). It is not a NASA model. {card ? `${card.model.n_train} training rows.` : ''}</p>
        </div>
      </div>
      <FlexPanel />
    </section>
  )
}

export function ModelSection({ card }: { card: ModelCard | null }) {
  const m = card?.metrics
  return (
    <section id="model" className="section wide">
      <h2>Model details: the honest model card</h2>
      <div className="model-grid">
        <div className="panel">
          <h3>Model card</h3>
          {card && m ? (
            <table className="kv"><tbody>
              <tr><td>Model</td><td>{card.model.estimator}</td></tr>
              <tr><td>Features</td><td>{card.model.features.join(', ')}</td></tr>
              <tr><td>Training rows</td><td>{card.model.n_train} real experiments from {card.model.n_sources} NASA reports</td></tr>
              <tr><td>Rows by gravity</td><td>{Object.entries(card.model.n_by_gravity || {}).map(([k, v]) => `${GRAVITY_LABEL[k] || k}: ${v}`).join(' · ')}</td></tr>
              <tr><td>Class counts</td><td>{Object.entries(card.class_counts).map(([k, v]) => `${OUTCOME_LABEL[k as keyof typeof OUTCOME_LABEL]} ${v}`).join(' · ')}</td></tr>
              <tr><td>Stratified 5-fold CV accuracy</td><td><b><Pct v={m.cv_accuracy} /></b> (balanced <Pct v={m.cv_balanced_accuracy} />)</td></tr>
              <tr><td>Repeated CV (5×10)</td><td><Pct v={m.repeated_cv_accuracy_mean} /> ± <Pct v={m.repeated_cv_accuracy_std} /></td></tr>
              <tr><td>Leave-whole-reports-out</td><td><Pct v={m.leave_reports_out_accuracy} /> <span className="muted">(entire papers held out)</span></td></tr>
              <tr><td>Majority-class baseline</td><td><Pct v={m.majority_baseline_accuracy} /></td></tr>
              <tr><td>scikit-learn</td><td>{card.model.sklearn_version}</td></tr>
            </tbody></table>
          ) : <p>Loading…</p>}
          <h3>Out-of-fold accuracy by gravity</h3>
          {m && <table className="env"><thead><tr><th>Gravity</th><th>Rows</th><th>OOF accuracy</th></tr></thead>
            <tbody>{Object.entries(m.oof_accuracy_by_gravity).map(([k, v]) => <tr key={k}><td>{GRAVITY_LABEL[k] || k}</td><td>{v.n}</td><td><Pct v={v.accuracy} /></td></tr>)}</tbody></table>}
          <p className="small warn-text">Partial-gravity and 1 g rows are very few (6–8 per level) and mostly paired limit tests, so held-out accuracy there is poor. Inside those tiny envelopes the tool effectively looks up the nearest published test. It is not a general partial-gravity model.</p>
        </div>
        <div className="panel">
          <h3>Confusion matrix (out-of-fold)</h3>
          {m && (
            <table className="cm"><thead><tr><th>true ↓ / predicted →</th>{m.confusion_matrix.labels.map(l => <th key={l}>{OUTCOME_LABEL[l]}</th>)}</tr></thead>
              <tbody>{m.confusion_matrix.matrix.map((row, i) => {
                const tot = row.reduce((a, b) => a + b, 0)
                return <tr key={i}><th style={{ color: OUTCOME_COLOR[m.confusion_matrix.labels[i]] }}>{OUTCOME_LABEL[m.confusion_matrix.labels[i]]}</th>
                  {row.map((v, j) => <td key={j} style={{ background: `rgba(${i === j ? '80,200,140' : '255,90,90'},${tot ? (v / tot) * 0.7 : 0})` }}>{v}</td>)}</tr>
              })}</tbody></table>
          )}
          <p className="small muted">Weakest on <b>no spread</b>: many extinction points sit right next to sustained flames.</p>
          <h3>Class definitions</h3>
          <ul className="small">
            <li><b style={{ color: OUTCOME_COLOR.spread }}>Sustained spread</b>: the source reports continued propagation (steady spread rate, sample consumed, or the flame survived the whole test).</li>
            <li><b style={{ color: OUTCOME_COLOR.marginal_spread }}>Marginal spread</b>: a flame persisted only at the limit (oscillating, decelerating, "dim and shrinking", or the upward limiting-oxygen point).</li>
            <li><b style={{ color: OUTCOME_COLOR.no_spread }}>No spread</b>: no ignition, extinction/quench, blow-off, or below the minimum oxygen concentration.</li>
          </ul>
          <h3>Range guard</h3>
          <p className="small">No prediction is returned if the material was never tested at the selected gravity level, if O₂, pressure or airflow fall outside that material's tested min–max at that gravity, if the flow direction was never tested, or if the gas mix is not O₂/N₂.</p>
        </div>
      </div>
      <div className="panel">
        <h3>Training envelope by material and gravity</h3>
        <div className="dt-scroll">
          <table className="env"><thead><tr><th>Material</th><th>Gravity</th><th>n</th><th>O₂ %</th><th>kPa</th><th>cm/s</th><th>Directions</th><th>Outcomes</th></tr></thead>
            <tbody>{card && Object.entries(card.training_range.materials).sort((a, b) => b[1].n - a[1].n).flatMap(([k, e]) => Object.entries(e.by_gravity).map(([g, v]) => (
              <tr key={k + g}><td>{MATERIAL_LABEL[k] || k}</td><td>{GRAVITY_LABEL[g] || g}</td><td>{v.n}</td><td>{v.oxygen_pct.join('–')}</td><td>{v.pressure_kpa.join('–')}</td><td>{v.flow_cm_s.join('–')}</td><td>{v.flow_directions.join(', ')}</td>
                <td>{Object.entries(v.outcomes).map(([o, n]) => <span key={o} className="pill" style={{ background: OUTCOME_COLOR[o as keyof typeof OUTCOME_COLOR] }}>{n}</span>)}</td></tr>
            )))}</tbody></table>
        </div>
      </div>
      <div className="panel">
        <h3>Every training row, with the text it came from</h3>
        <p className="small muted">Click a row for the quote as printed, the page or table, and notes (including PSI corroboration). Nothing here is interpolated, read off a figure or synthesised.</p>
        <DataTable />
      </div>
    </section>
  )
}

export function DisclosureTeam() {
  return (
    <>
      <section id="ai-use" className="section narrow">
        <h2>AI-use disclosure</h2>
        <p>AI coding assistants helped draft parts of this code and text; the team reviewed them. <b>No AI system produced any training value.</b> Every experiment row was transcribed from a cited NASA report, and every environment or safety statement quotes its source. At runtime there is <b>no paid or cloud AI</b>. Predictions come from a scikit-learn model. Explanations are deterministic templates. Ask IGNITE-AI uses local TF-IDF retrieval and quotes passages verbatim. Optional local generation through Ollama is <b>off by default</b>, and its output is rejected if it contains any number not found in the retrieved passages. Details: docs/AI_USE.md.</p>
      </section>
      <section id="team" className="section narrow">
        <h2>Team</h2>
        <div className="team">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="member"><div className="avatar">?</div><b>[Team member name]</b><span className="muted">[Role]</span><span className="muted small">[University / city, Bangladesh]</span></div>
          ))}
        </div>
        <p className="small muted">Placeholders: the team fills in names and roles before submission.</p>
      </section>
      <section id="about" className="section narrow">
        <h2>About</h2>
        <p><b>NASA Space Apps Challenge 2026, Challenge 08: Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data.</b> IGNITE-AI runs fully on a local machine (FastAPI + React + scikit-learn), is licensed Apache-2.0, and uses only public NASA data. NASA does not endorse this project.</p>
      </section>
    </>
  )
}
