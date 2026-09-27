import { Suspense, lazy } from 'react'
import type { ModelCard } from '../lib/api'
import { Link } from '../lib/router'

const CompareScene = lazy(() => import('../components/FlameScene').then(m => ({ default: m.CompareScene })))
const NASA_COMB = 'https://www.nasa.gov/missions/station/iss-research/studying-combustion-and-fire-safety/'
const FRIEDMAN = 'https://ntrs.nasa.gov/citations/20000120278'
const OLSON12 = 'https://ntrs.nasa.gov/citations/20130010991'
const FERKUL26 = 'https://ntrs.nasa.gov/citations/20260001966'
const OLSON08 = 'https://ntrs.nasa.gov/citations/20080034883'
const C = ({ href, children }: { href: string; children: React.ReactNode }) => <a className="cite" href={href} target="_blank" rel="noreferrer">{children}</a>

export function Nav({ demo }: { demo?: boolean }) {
  return (
    <header className="nav">
      <Link to="/" className="brand"><span className="brand-dot" />IGNITE-AI</Link>
      <nav>
        {demo ? <>
          <a href="#environment">Environment</a><a href="#ask">Ask</a><a href="#safety">Safety</a><a href="#sources">Sources</a><a href="#model">Model</a><a href="#team">Team</a>
        </> : <>
          <a href="#crisis">The crisis</a><a href="#how">How it works</a><a href="#data">Data</a>
        </>}
        {!demo && <Link to="/demo" className="btn small">Open tool</Link>}
      </nav>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <span><b>IGNITE-AI</b> · Apache-2.0 · NASA Space Apps Challenge 2026 (Bangladesh) · runs locally, open-source only</span>
      <span>Data: NASA PSI (psi.nasa.gov) and NASA Technical Reports Server. NASA does not endorse this project. <a href="/llms.txt">llms.txt</a> · <a href="/docs">API</a></span>
    </footer>
  )
}

export default function Landing({ card }: { card: ModelCard | null }) {
  const m = card?.metrics
  const nG = card?.model.n_by_gravity
  return (
    <>
      <Nav />
      <section className="land-hero">
        <div className="land-hero-bg" />
        <div className="land-hero-inner">
          <div className="eyebrow">NASA Space Apps Challenge 2026 · Challenge 08 · Bangladesh</div>
          <h1>IGNITE-AI</h1>
          <p className="tagline">Predictive Fire Safety Analytics for Space Station Orbit &amp; Rocket Transit</p>
          <p className="lead">Pick an environment (Earth, Moon, Mars, the ISS or a transit cabin), then set the oxygen, pressure, ventilation and material. IGNITE-AI predicts whether a fire could <b>spread</b>, shows the <b>real NASA experiments</b> behind that answer, and <b>refuses to guess</b> where no one has tested.</p>
          <Link to="/demo" className="btn big cta-main">[ Explore Space Fire Safety Tool ]</Link>
          <div className="stat-cards">
            <div className="stat"><b>{card?.model.n_train ?? '…'}</b><span>real NASA flame-spread experiments, each quoted from its report</span></div>
            <div className="stat"><b>4</b><span>gravity levels with data: 0 g{nG ? ` (${nG['0']})` : ''}, Moon{nG ? ` (${nG['0.165']})` : ''}, Mars{nG ? ` (${nG['0.38']})` : ''}, Earth{nG ? ` (${nG['1']})` : ''}</span></div>
            <div className="stat"><b>{m ? `${(m.cv_accuracy * 100).toFixed(1)}%` : '…'}</b><span>cross-validated accuracy (baseline {m ? `${(m.majority_baseline_accuracy * 100).toFixed(1)}%` : '…'}), reported honestly</span></div>
            <div className="stat"><b>24</b><span>NASA PSI combustion investigations in the Ask IGNITE-AI knowledge base</span></div>
          </div>
        </div>
      </section>

      <section id="crisis" className="section wide">
        <h2>The Microgravity Fire Crisis</h2>
        <div className="crisis">
          <div className="crisis-text">
            <p><b>Fire changes character when gravity disappears.</b> On Earth, hot gas rises and cooler air is pulled in at the base. That produces the familiar flickering, teardrop-shaped flame <C href={NASA_COMB}>NASA</C>.</p>
            <p><b>In the free fall of orbit, buoyancy is gone</b>, and low-momentum flames become <b>rounded or even spherical</b> <C href={NASA_COMB}>NASA</C>. Airflow now matters most: flames "propagate poorly in truly quiescent conditions" but are "enhanced vigorously by low-rate atmospheric flows" <C href={FRIEDMAN}>NASA/TM-2000-210337</C>.</p>
            <p><b>Some space fires are hard to see.</b> At very low airflow, NASA observed that "the entire flame is pale violet and nearly invisible" <C href={FRIEDMAN}>NASA/TM-2000-210337</C>. The FLEX experiment found <b>cool flames</b> in which fuel kept "burning" after the visible flame went out <C href={NASA_COMB}>NASA</C>.</p>
            <p className="small muted">Near-spherical dim blue flames are typical of low-momentum droplet and gas-jet flames in microgravity. Flames over solids in a ventilation flow are elongated downstream instead.</p>
          </div>
          <div className="compare">
            <div className="compare-canvas"><Suspense fallback={<div className="canvas-fallback" />}><CompareScene /></Suspense></div>
            <div className="compare-labels">
              <div className="clabel"><h3>Normal buoyant flame (1 g)</h3><ul><li><b>Shape:</b> tall, flickering teardrop</li><li><b>Driven by:</b> buoyant convection (hot gas rises)</li><li><b>Look:</b> blue base, yellow sooty body</li></ul></div>
              <div className="clabel"><h3>Microgravity diffusion flame (~0 g)</h3><ul><li><b>Shape:</b> rounded or near-spherical</li><li><b>Driven by:</b> diffusion and cabin airflow only</li><li><b>Look:</b> dim and bluish; can be nearly invisible</li></ul></div>
            </div>
            <p className="small muted">Illustrative rendering of documented behaviour, not a combustion simulation.</p>
          </div>
        </div>
      </section>

      <section className="section wide">
        <h2>Why it matters now</h2>
        <div className="cards three">
          <article className="card"><h3>Earth tests are not always conservative</h3><p>In drop-tower tests, some materials burned at <b>lower oxygen in 0 g</b> (up to 4% O₂ lower at 30 cm/s flow) than in the NASA-STD-6001 upward test <C href={OLSON08}>NTRS 20080034883</C>. At Martian gravity, limits were up to <b>5.75% O₂ lower</b> than at 1 g <C href={OLSON12}>NTRS 20130010991</C>.</p></article>
          <article className="card"><h3>The Moon may be the worst case</h3><p>"Lunar gravity is <b>nearly the most flammable condition</b>" <C href={FERKUL26}>NTRS 20260001966</C>. NASA's analysis puts partial-gravity flammability maxima at roughly <b>0.15–0.4 g</b> <C href={FRIEDMAN}>NTRS 20000120278</C>.</p></article>
          <article className="card"><h3>Exploration cabins run richer in oxygen</h3><p>Lunar lander, habitat and rover plans use <b>8.2 psia with 34% O₂</b>, with control bands up to 37% <C href={FERKUL26}>NTRS 20260001966</C>. In transit there is less suppressant, and help from Earth arrives with a delay <C href={FRIEDMAN}>NTRS 20000120278</C>.</p></article>
        </div>
      </section>

      <section id="how" className="section wide">
        <h2>How IGNITE-AI works</h2>
        <div className="cards four">
          <article className="card step"><span className="stepn">1</span><h3>Choose the environment</h3><p>Earth 1 g, Moon 0.165 g, Mars 0.38 g, ISS ~0 g or a <b>transit cabin</b> (coasting spaceflight is also free fall). Each tab shows sourced facts and the real tests at that gravity.</p></article>
          <article className="card step"><span className="stepn">2</span><h3>Set the conditions</h3><p>Oxygen, pressure, ventilation fan speed, material and gas mix. The 3D flame reacts live, and the model predicts <b>spread / marginal / no spread</b> with probabilities.</p></article>
          <article className="card step"><span className="stepn">3</span><h3>See the evidence or a refusal</h3><p>The nearest published experiments are shown with verbatim quotes. <b>Outside the tested envelope</b> (including untested gravity levels and gas mixes) the tool refuses to predict.</p></article>
          <article className="card step"><span className="stepn">4</span><h3>Ask IGNITE-AI</h3><p>Ask questions or compare experiments. Answers are <b>verbatim quotes from NASA sources</b> with links, retrieved locally. The assistant declines when nothing relevant is found.</p></article>
        </div>
      </section>

      <section id="data" className="section wide">
        <h2>Built only on NASA open data</h2>
        <div className="chips big">
          {['NASA PSI repository', 'NTRS reports', 'FLEX · PSI-69', 'FLEX-2', 'BASS · BASS-II', 'SPICE', 'SLICE', 'CFI', 'ACME / BRE', 'SAME · SAME-R', 'DAFT', 'Saffire I–VI', 'SoFIE', 'LUCI'].map(t => <span key={t} className="chip static">{t}</span>)}
        </div>
        <p className="narrow-p">Every training row cites its NASA report and page. Estimates, such as buoyancy scaling with √g on the Moon and Mars, are labelled as estimates. The accuracy is reported against a majority-class baseline and broken down by gravity level. Everything runs locally under Apache-2.0.</p>
        <div className="center"><Link to="/demo" className="btn big">[ Explore Space Fire Safety Tool ]</Link></div>
      </section>
      <Footer />
    </>
  )
}
