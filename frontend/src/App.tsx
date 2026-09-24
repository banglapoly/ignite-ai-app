import { Suspense, lazy, useEffect, useState } from 'react'
import type { ModelCard } from './lib/api'
import { MATERIAL_LABEL, OUTCOME_COLOR, OUTCOME_LABEL, getJSON } from './lib/api'
import Explorer from './components/Explorer'
import DataTable from './components/DataTable'

const FlameScene = lazy(() => import('./components/FlameScene'))
const ntrs = (id: string) => `https://ntrs.nasa.gov/citations/${id}`
const Cite = ({ id }: { id: string }) => <a className="cite" href={ntrs(id)} target="_blank" rel="noreferrer">NTRS {id}</a>

const NAV = [['science', 'Science'], ['timeline', 'History'], ['explorer', 'Explorer'], ['data', 'Data & Model'], ['safety', 'Safety'], ['sources', 'Sources'], ['team', 'Team'], ['about', 'About']]

const FACTS: { t: string; b: React.ReactNode; c: string[] }[] = [
  { t: 'No buoyancy, no chimney', b: <>On Earth, hot combustion gas rises and pulls in fresh air. In orbit that buoyant flow disappears, so oxygen reaches the flame only by diffusion or by the ventilation fans. That is why microgravity flames are dimmer, rounder and bluer.</>, c: ['20050192122', '19880006471'] },
  { t: 'Still air can put a flame out', b: <>In quiescent drop-tower tests, a thin cellulose flame extinguished at <b>21% O₂</b> in microgravity, while the same fuel burned down to <b>16.5% O₂</b> in normal gravity. The microgravity flame is quenched by heat losses. The Earth flame is blown off.</>, c: ['19880006471'] },
  { t: 'A gentle breeze can revive it', b: <>Slow opposed flow let thin cellulose burn at oxygen levels where quiescent flames died. Quenching appeared again at very low speeds, and the low-oxygen limit sat near <b>15%</b>. On the ISS, SIBAL fabric quenched at flows between <b>1 and 5 cm/s</b>, and the quench speed rose as oxygen fell.</>, c: ['19890014267', '20150008962'] },
  { t: 'Earth tests are not always conservative', b: <>Drop-tower limits for Nomex, Ultem and Mylar were up to <b>4% O₂ lower</b> in 0g (at 30 cm/s flow) than in NASA-STD-6001 Test 1. For Ultem the mean limit fell from <b>25.25%</b> (1g) to <b>22.5%</b> (0g), inside the ISS nominal band of 21 ± 2%.</>, c: ['20080034883'] },
  { t: 'Flames grow to a limiting size', b: <>In the Saffire spacecraft experiments, concurrent flames over large thin fabrics reached a steady, limiting size instead of growing without limit as upward flames do on Earth. Flames on thick PMMA stayed anchored at the leading edge.</>, c: ['20210011521', '20260001992'] },
  { t: 'Exploration cabins raise the stakes', b: <>Artemis-era cabins plan higher oxygen at lower pressure. Saffire VI burned samples at <b>54.1 kPa and 31% O₂</b>. NASA notes that materials considered safe on the ISS may become flammable in these atmospheres.</>, c: ['20240002981', '20250010975'] },
]

const TIMELINE: { y: string; t: string; d: string; c: string }[] = [
  { y: '1987', t: 'Drop-tower flame spread over thin fuel', d: 'Olson maps quiescent microgravity flame spread over Kimwipes from the limiting oxygen concentration up to 100% O₂ at 1 atm.', c: '19880006471' },
  { y: '1989', t: 'Quenching extinction observed', d: 'Low-speed opposed flow in the 5.18 s Zero Gravity Facility reveals a new "quenching" extinction branch and a flammability map.', c: '19890014267' },
  { y: '1990–1995', t: 'Solid Surface Combustion Experiment (SSCE)', d: 'Eight Space Shuttle flights between October 1990 and February 1995 study flame spread over filter paper and PMMA in still O₂/N₂.', c: '19960008387' },
  { y: '1995–1999', t: 'DARTFire sounding rockets', d: 'Opposed-flow flame spread over PMMA at 1–20 cm/s with imposed radiant flux in 35–70% O₂ atmospheres.', c: '19960008415' },
  { y: '1996', t: 'RITSI on USMP-3 (STS-75)', d: '25 glovebox tests of radiative ignition and the transition to flame spread over filter paper, with flow from 0 to 6.5 cm/s.', c: '19990020832' },
  { y: '1999', t: 'SKOROST on space station Mir', d: 'US/Russian tests confirm a limiting flow velocity below which PMMA and glass-epoxy samples cannot burn.', c: '19990053976' },
  { y: '2008', t: 'Exploration-atmosphere drop tests', d: 'Pressure, oxygen and flow effects measured together. 0g limits fall below 1g Test 1 limits.', c: '20080034883' },
  { y: '2013', t: 'FLEX droplet extinguishment (ISS)', d: 'Fuel droplets burned in the Combustion Integrated Rack to find limiting oxygen indices with inert diluents.', c: '20130014061' },
  { y: '2013–2015', t: 'BASS and BASS-II (ISS glovebox)', d: 'Long-duration tests of thin and thick solids with fan-controlled flow and nitrogen-diluted oxygen. They produce the quench boundaries used in this model.', c: '20150008962' },
  { y: '2016–2017', t: 'Saffire I–III', d: 'The first large-scale fires set on purpose inside a spacecraft (Cygnus), after it left the ISS.', c: '20170008805' },
  { y: '2021 (report)', t: 'Saffire IV–V', d: 'Large-sample fires at 100 kPa and at about 71 kPa with elevated oxygen. Vehicle-level smoke and gas measurements.', c: '20210011521' },
  { y: '2021→', t: 'SoFIE insert for the ISS CIR', d: 'Solid Fuel Ignition and Extinction hardware for variable-pressure, variable-oxygen material flammability studies.', c: '20200000361' },
  { y: '2024 (report)', t: 'Saffire VI', d: 'Final Saffire flight: SIBAL and PMMA burned at 54–55 kPa and 29–31% O₂.', c: '20240002981' },
  { y: 'Next', t: 'FM² on the Moon', d: 'Flammability of Materials on the Moon aims to test ignition and burning in real lunar gravity.', c: '20250010975' },
]

const SOURCES_USED: [string, string][] = [
  ['19880006471', 'Olson (1987) The Effect of Microgravity on Flame Spread over a Thin Fuel, NASA TM-100195'],
  ['19890014267', "Olson, Ferkul, T'ien (1989) Opposed flow diffusion flame extinction over a thin fuel in microgravity"],
  ['20150008962', "Zhao, T'ien, Ferkul, Olson (2015) Concurrent flame growth, spread and extinction over composite fabric (BASS/BASS-II)"],
  ['20080034883', 'Olson et al. (2008) Microgravity Flame Spread in Exploration Atmospheres, NASA/TM-2008-215260'],
  ['20210011521', 'Urban et al. (2021) Fire Safety Implications of Preliminary Results from Saffire IV and V'],
  ['20170008805', 'Urban et al. (2017) Results of Large-Scale Spacecraft Flammability Tests (Saffire I/II)'],
  ['20240002981', 'Urban et al. (2024) Preliminary Results from the Saffire VI Experiment'],
  ['20260001992', 'Heat and Smoke Emission from Tests on the Saffire VI Experiment (2026)'],
  ['20050177200', 'SSCE Completes a Series of Eight Successful Flights (1996)'],
  ['19960008387', 'SSCE flame spread in a quiescent microgravity environment (1995)'],
  ['19950007798', 'The Solid Surface Combustion Experiment aboard the USML-1 Mission (1994)'],
  ['19970020608', 'SSCE: Thick Fuel Results (1997)'],
  ['19990053971', 'Reflight of SSCE: Flame Radiation Near Extinction (1999)'],
  ['20210017785', 'Opposed Flame Spreading Along a Structured PMMA Sample (Saffire V)'],
]

function Pct({ v }: { v: number }) { return <>{(v * 100).toFixed(1)}%</> }

export default function App() {
  const [gravity, setGravity] = useState(0)
  const [card, setCard] = useState<ModelCard | null>(null)
  const [corpusN, setCorpusN] = useState<number | null>(null)
  useEffect(() => {
    getJSON<ModelCard>('/model').then(setCard).catch(() => {})
    getJSON<{ n: number }>('/corpus').then(d => setCorpusN(d.n)).catch(() => {})
  }, [])
  const m = card?.metrics

  return (
    <>
      <header className="nav">
        <a href="#top" className="brand"><span className="brand-dot" />Flame in Freefall</a>
        <nav>{NAV.map(([id, l]) => <a key={id} href={`#${id}`}>{l}</a>)}</nav>
      </header>

      <section id="top" className="hero">
        <div className="hero-canvas">
          <Suspense fallback={<div className="canvas-fallback" />}>
            <FlameScene gravity={gravity} />
          </Suspense>
        </div>
        <div className="hero-copy">
          <div className="eyebrow">NASA Space Apps Challenge 2026 · Challenge 08 · Bangladesh</div>
          <h1>Fire behaves differently when nothing falls.</h1>
          <p className="lead">
            <b>Flame in Freefall</b> is a flammability explorer for spacecraft operators. Set oxygen, pressure, ventilation flow and material. A gradient-boosting model trained only on
            {card ? ` ${card.model.n_train} ` : ' '}published NASA microgravity experiments predicts the flame-spread regime and cites the real tests on either side of the boundary. It refuses to answer outside the evidence.
          </p>
          <div className="gtoggle" role="group" aria-label="Gravity">
            <button className={gravity === 1 ? 'on' : ''} onClick={() => setGravity(1)}>🌍 Earth gravity (1 g)</button>
            <button className={gravity === 0 ? 'on' : ''} onClick={() => setGravity(0)}>🛰️ Microgravity</button>
          </div>
          <p className="small muted">{gravity ? 'Buoyant convection draws the flame into a yellow, sooty teardrop.' : 'Without buoyancy, oxygen arrives only by diffusion: a dim, near-spherical blue flame.'} Drag to orbit. (Artistic illustration, not a simulation.)</p>
          <div className="cta"><a className="btn" href="#explorer">Open the explorer</a><a className="btn ghost" href="#data">See the data & honest accuracy</a></div>
        </div>
      </section>

      <section className="stats">
        <div><b>{card?.model.n_train ?? '…'}</b><span>published microgravity tests</span></div>
        <div><b>{card?.model.n_sources ?? '…'}</b><span>NTRS reports cited row-by-row</span></div>
        <div><b>{m ? <Pct v={m.cv_accuracy} /> : '…'}</b><span>stratified 5-fold CV accuracy</span></div>
        <div><b>{m ? <Pct v={m.majority_baseline_accuracy} /> : '…'}</b><span>majority-class baseline</span></div>
        <div><b>{corpusN ?? '…'}</b><span>NTRS records in the retrieval corpus</span></div>
      </section>

      <section id="problem" className="section narrow">
        <h2>The problem</h2>
        <p>A fire on a spacecraft is one of the most dangerous things that can happen, and the crew has almost nowhere to go. Materials are screened with Earth-gravity tests. Decades of drop-tower, Shuttle, ISS and Cygnus experiments show that flames in microgravity follow different rules: they can die in still air yet survive in a gentle ventilation breeze, and some burn at lower oxygen than Earth tests predict. Those results are spread across hundreds of NASA reports. Our tool turns a small, fully cited slice of them into a question an operator can ask: <i>at these cabin conditions, could this material sustain a spreading flame?</i></p>
      </section>

      <section id="science" className="section">
        <h2>Why fire is different in microgravity</h2>
        <div className="cards">
          {FACTS.map(f => (
            <article key={f.t} className="card">
              <h3>{f.t}</h3>
              <p>{f.b}</p>
              <div className="cites">{f.c.map(c => <Cite key={c} id={c} />)}</div>
            </article>
          ))}
        </div>
      </section>

      <section id="timeline" className="section">
        <h2>Four decades of fire experiments beyond gravity</h2>
        <ol className="timeline">
          {TIMELINE.map(e => (
            <li key={e.t}>
              <div className="tl-year">{e.y}</div>
              <div className="tl-body"><h3>{e.t}</h3><p>{e.d}</p><Cite id={e.c} /></div>
            </li>
          ))}
        </ol>
        <p className="small muted">Years come from the cited NTRS record (publication year, or the mission it describes).</p>
      </section>

      <section id="explorer" className="section wide">
        <h2>Flammability explorer <span className="badge">MVP</span></h2>
        <p className="narrow-p">Try the killer demo: press <b>▶ Killer demo</b>. It slides oxygen from 21% to 17% for SIBAL cotton-fiberglass fabric at 1 atm and 3 cm/s concurrent flow, the conditions of the BASS-II ISS tests. The prediction crosses from sustained spread to no spread, and the panel names the experiments on each side with their NTRS identifiers.</p>
        <Explorer card={card} />
      </section>

      <section id="data" className="section">
        <h2>Data & model transparency</h2>
        <div className="model-grid">
          <div className="panel">
            <h3>Model card</h3>
            {card && m ? (
              <table className="kv"><tbody>
                <tr><td>Model</td><td>{card.model.estimator}</td></tr>
                <tr><td>Features</td><td>{card.model.features.join(', ')}</td></tr>
                <tr><td>Training rows</td><td>{card.model.n_train} (from {card.model.n_sources} NTRS reports)</td></tr>
                <tr><td>Class counts</td><td>{Object.entries(card.class_counts).map(([k, v]) => `${OUTCOME_LABEL[k as keyof typeof OUTCOME_LABEL]} ${v}`).join(' · ')}</td></tr>
                <tr><td>Stratified 5-fold CV accuracy</td><td><b><Pct v={m.cv_accuracy} /></b> (balanced <Pct v={m.cv_balanced_accuracy} />)</td></tr>
                <tr><td>Repeated CV (5×10)</td><td><Pct v={m.repeated_cv_accuracy_mean} /> ± <Pct v={m.repeated_cv_accuracy_std} /></td></tr>
                <tr><td>Leave-whole-reports-out</td><td><Pct v={m.leave_reports_out_accuracy} /> <span className="muted">(harder: entire papers held out)</span></td></tr>
                <tr><td>Majority baseline</td><td><Pct v={m.majority_baseline_accuracy} /></td></tr>
                <tr><td>scikit-learn</td><td>{card.model.sklearn_version}</td></tr>
              </tbody></table>
            ) : <p>Loading…</p>}
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
            <p className="small muted">The model is weakest on <b>no spread</b>. Many extinction points sit right next to sustained flames, and several materials have only 2–4 tests. Please read the accuracy with that in mind.</p>
            <h3>Class definitions</h3>
            <ul className="small">
              <li><b style={{ color: OUTCOME_COLOR.spread }}>Sustained spread</b>: the source reports continued propagation (a measured steady spread rate, the sample consumed, or no quench during the test).</li>
              <li><b style={{ color: OUTCOME_COLOR.marginal_spread }}>Marginal spread</b>: a flame persisted but only at the limit. The source reports oscillating spread, an unmeasurably small spread rate, decelerating spread, or a flame anchored at the leading edge.</li>
              <li><b style={{ color: OUTCOME_COLOR.no_spread }}>No spread</b>: no ignition, extinction or quench, blow-off, or an insignificant burn.</li>
            </ul>
          </div>
        </div>
        <div className="panel">
          <h3>Training envelope (the range guard)</h3>
          <div className="dt-scroll">
            <table className="env"><thead><tr><th>Material</th><th>n</th><th>O₂ %</th><th>kPa</th><th>cm/s</th><th>Directions</th><th>Outcomes</th></tr></thead>
              <tbody>{card && Object.entries(card.training_range.materials).sort((a, b) => b[1].n - a[1].n).map(([k, e]) => (
                <tr key={k}><td>{MATERIAL_LABEL[k] || k}</td><td>{e.n}</td><td>{e.oxygen_pct.join('–')}</td><td>{e.pressure_kpa.join('–')}</td><td>{e.flow_cm_s.join('–')}</td><td>{e.flow_directions.join(', ')}</td>
                  <td>{Object.entries(e.outcomes).map(([o, n]) => <span key={o} className="pill" style={{ background: OUTCOME_COLOR[o as keyof typeof OUTCOME_COLOR] }}>{n}</span>)}</td></tr>
              ))}</tbody></table>
          </div>
          <p className="small muted">A request is refused if any numeric input falls outside its material's min–max, or if it uses a flow direction never tested for that material. Inside the box, sparse coverage shows up as a larger nearest-experiment distance and lower confidence.</p>
        </div>
        <div className="panel">
          <h3>Every training row, with the text it came from</h3>
          <p className="small muted">Click a row to see the value as printed in the source, its page or table, and any notes. Nothing here is interpolated, read off a figure or synthesised.</p>
          <DataTable />
        </div>
      </section>

      <section id="safety" className="section narrow">
        <h2>For spacecraft operators: how to read this</h2>
        <div className="cards two">
          <article className="card"><h3>What it is</h3><p>A triage aid that answers one question: <i>have published microgravity experiments near these conditions shown sustained, marginal or no flame spread?</i> Each answer comes with the probabilities and the tests behind it.</p></article>
          <article className="card"><h3>What it is not</h3><p>It is not a material certification, and it does not replace NASA-STD-6001 testing. A <b>no spread</b> result never clears a material. It only says the nearest published tests did not sustain a flame.</p></article>
          <article className="card"><h3>Ventilation cuts both ways</h3><p>Below a material's limiting flow velocity a flame cannot survive, and flow reduction is one of the suppression strategies SoFIE was built to study. The same data show flames that die in still air coming back at a few cm/s of flow.</p><div className="cites"><Cite id="19990053976" /><Cite id="20200000361" /><Cite id="19890014267" /></div></article>
          <article className="card"><h3>When it refuses</h3><p>A refusal is information: nobody has published a test there. Treat those conditions as untested and potentially flammable. The nearest published tests are listed so you know where the evidence stops.</p></article>
        </div>
      </section>

      <section id="sources" className="section narrow">
        <h2>Sources</h2>
        <p>Every training row cites one of these NASA Technical Reports Server records, with the table or page it came from:</p>
        <ol className="refs">{SOURCES_USED.map(([id, t]) => <li key={id}><a href={ntrs(id)} target="_blank" rel="noreferrer">NTRS {id}</a> — {t}</li>)}</ol>
        <p>The retrieval layer indexes {corpusN ?? 'the'} NTRS citation records (titles and abstracts) harvested through the public NTRS API (<code>ntrs.nasa.gov/api/citations/search</code>). Science and timeline statements cite the records linked next to them. Other resources: <a href="https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/" target="_blank" rel="noreferrer">NASA Glenn Physical Sciences</a>, <a href="https://osdr.nasa.gov/" target="_blank" rel="noreferrer">NASA OSDR</a>.</p>
        <p className="small muted">The 3D scene is procedural (three.js, @react-three/fiber, @react-three/drei). It is not a NASA model. All code is Apache-2.0.</p>
      </section>

      <section id="team" className="section narrow">
        <h2>Team</h2>
        <div className="team">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="member">
              <div className="avatar">?</div>
              <b>[Team member name]</b>
              <span className="muted">[Role, e.g. data extraction / ML / frontend]</span>
              <span className="muted small">[University / city, Bangladesh]</span>
            </div>
          ))}
        </div>
        <p className="small muted">Placeholders: the team fills in names and roles before submission. Do not include names, voices or likenesses of anyone under 18.</p>
      </section>

      <section id="about" className="section narrow">
        <h2>About the challenge</h2>
        <p><b>NASA Space Apps Challenge 2026, Challenge 08: Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data</b> (AI & microgravity safety). The challenge asks teams to apply AI to decades of microgravity combustion research and produce fire-safety insight for spacecraft. This project was built for the Bangladesh local event.</p>
        <p>How it works: public NTRS reports → a hand-extracted table of conditions and outcomes (<code>backend/data/experiments.csv</code>) → a scikit-learn gradient-boosting classifier with a stored training envelope → a FastAPI service → this site. The explanation layer is a deterministic template that only restates numbers from the prediction object. A local LLM (Ollama) can be switched on, and its text is rejected if it contains any number not present in the prediction object. Everything runs locally with no cloud services.</p>
        <p className="small muted">AI disclosure: parts of this code and text were drafted with an AI coding assistant and then reviewed. Details are in docs/AI_USE.md. No AI system produced any training value. Every value was transcribed from a cited report.</p>
      </section>

      <footer className="footer">
        <span>Flame in Freefall · Apache-2.0 · Built for NASA Space Apps Challenge 2026 (Bangladesh)</span>
        <span>NASA does not endorse this project. Data: NASA Technical Reports Server.</span>
      </footer>
    </>
  )
}
