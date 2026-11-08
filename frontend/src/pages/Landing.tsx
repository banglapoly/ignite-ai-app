import { useEffect, useState } from 'react'
import type { ModelCard, PsiInfo } from '../lib/api'
import { getJSON } from '../lib/api'
import Disclaimer from '../components/Disclaimer'
import { Link } from '../lib/router'

export default function Landing({ card }: { card: ModelCard | null }) {
  const m = card?.metrics
  const nG = card?.model.n_by_gravity
  const [psiCount, setPsiCount] = useState<number | null>(null)
  useEffect(() => { getJSON<PsiInfo>('/psi').then(d => setPsiCount(d.investigations.length)).catch(() => setPsiCount(null)) }, [])
  return (
    <>
      <section className="land-hero">
        <div className="land-hero-bg" />
        <div className="land-hero-inner">
          <div className="hero-brand">
            <img src="/logo.svg" className="hero-logo" alt="IGNITE-AI flame logo" width={112} height={112} />
            <h1>IGNITE-AI</h1>
          </div>
          <p className="tagline">A workspace for combustion-condition investigations</p>
          <p className="lead">The practical question: which published tests are actually near the gravity, oxygen, pressure, airflow, gas mix, and material you are studying, and where does the loaded record stop? IGNITE-AI keeps that question, the scenario history, the cited evidence, and a comparison in one investigation.</p>
          <div className="cta">
            <Link to="/dashboard" className="btn big cta-main">Open the dashboard</Link>
            <Link to="/simulator" className="btn big ghost">Explore the sandbox</Link>
          </div>
          <div className="stat-cards">
            <div className="stat"><b>{card ? card.model.n_train : '…'}</b><span>flame-spread rows in the loaded snapshot, each with a report quote</span></div>
            <div className="stat"><b>{card ? card.model.n_sources : '…'}</b><span>source reports in that snapshot{nG ? ` · 0 g ${nG['0']}, Moon ${nG['0.165']}, Mars ${nG['0.38']}, Earth ${nG['1']}` : ''}</span></div>
            <div className="stat"><b>{m ? `${(m.cv_accuracy * 100).toFixed(1)}%` : '…'}</b><span>stratified cross-validated accuracy, beside a {m ? `${(m.majority_baseline_accuracy * 100).toFixed(1)}%` : '…'} majority baseline</span></div>
            <div className="stat"><b>{psiCount ?? '…'}</b><span>PSI investigation records in the loaded knowledge base</span></div>
          </div>
        </div>
      </section>

      <section className="section wide">
        <Disclaimer />
        <h2>How an investigation helps</h2>
        <div className="cards four">
          <article className="card step"><span className="stepn">1</span><h3>Write the question</h3><p>Name the cabin or lab condition you need to understand. The dashboard then tells you the next missing piece instead of a generic menu.</p></article>
          <article className="card step"><span className="stepn">2</span><h3>Save the conditions</h3><p>Gravity, oxygen, pressure, ventilation, gas mix, and material use the same scales as the sandbox. Each save stays in the scenario history and can be reloaded.</p></article>
          <article className="card step"><span className="stepn">3</span><h3>Separate three outputs</h3><p>Ranked experiments with citations are the evidence. A class share is a statistical estimate, and only inside the loaded envelope. The 3D flame is an illustration.</p></article>
          <article className="card step"><span className="stepn">4</span><h3>Compare, then back up</h3><p>Hold oxygen, pressure, airflow, and gravity fixed and swap materials. Unsupported combinations stay visible as limitations. Full backups include notes. Parameter links do not.</p></article>
        </div>
      </section>

      <section className="section wide">
        <h2>Start here</h2>
        <div className="cards pagecards">
          <Link to="/dashboard" className="card pagecard"><span className="pc-ico">🗂️</span><h3>Dashboard</h3><p>Saved investigations, recent activity, and a next step based on what is still missing.</p></Link>
          <Link to="/simulator" className="card pagecard"><span className="pc-ico">🔥</span><h3>Sandbox</h3><p>Move the controls and watch the illustrative flame before you save a scenario into an investigation.</p></Link>
          <Link to="/learn" className="card pagecard"><span className="pc-ico">📘</span><h3>Learn</h3><p>How to read evidence, estimates, and the illustration, including what partial-gravity presets do and do not mean.</p></Link>
          <Link to="/predict" className="card pagecard"><span className="pc-ico">📈</span><h3>Evidence</h3><p>The range guard, the model slice, and the nearest published tests with quotes.</p></Link>
          <Link to="/sources" className="card pagecard"><span className="pc-ico">📚</span><h3>Sources</h3><p>PSI investigations, NTRS reports, and the citations behind the loaded notes.</p></Link>
          <Link to="/data" className="card pagecard"><span className="pc-ico">🧮</span><h3>Model</h3><p>The model card read from this build, per-gravity accuracy, and which catalogs are actually loaded.</p></Link>
        </div>
        <p className="narrow-p">Counts above are read from the model card and PSI list shipped with this build. They are not a claim about a future data release, and this prototype does not assert that a challenge brief has been verified. Guest saves stay in this browser until you export them.</p>
      </section>
    </>
  )
}
