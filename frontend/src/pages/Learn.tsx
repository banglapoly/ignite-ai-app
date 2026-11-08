import { Suspense, lazy } from 'react'
import Disclaimer from '../components/Disclaimer'
import ProvenanceNote from '../components/ProvenanceNote'
import { NextLinks, PageHead } from '../components/Layout'
import { Link } from '../lib/router'

const CompareScene = lazy(() => import('../components/FlameScene').then(m => ({ default: m.CompareScene })))
const NASA_COMB = 'https://www.nasa.gov/missions/station/iss-research/studying-combustion-and-fire-safety/'
const FRIEDMAN = 'https://ntrs.nasa.gov/citations/20000120278'
const OLSON12 = 'https://ntrs.nasa.gov/citations/20130010991'
const FERKUL26 = 'https://ntrs.nasa.gov/citations/20260001966'
const OLSON08 = 'https://ntrs.nasa.gov/citations/20080034883'
const C = ({ href, children }: { href: string; children: React.ReactNode }) => <a className="cite" href={href} target="_blank" rel="noreferrer">{children}</a>

export default function Learn() {
  return (
    <>
      <PageHead kicker="Learn" title="How to read a combustion investigation">
        Background for the workspace. The three outputs mean different things, and a gravity preset is not a test.
      </PageHead>
      <section className="section wide page-body">
        <Disclaimer />
        <div className="cards three">
          <article className="card"><h3>1 · Experiment evidence</h3><p>Published tests, ranked by a stated distance and linked to the report. Quotes are the words in the loaded record. This is the evidence.</p></article>
          <article className="card"><h3>2 · Statistical model estimate</h3><p>A class share from the gradient-boosting model, only inside the loaded envelope. The shares are not a calibrated confidence, a risk score, or a certificate. Minima and maxima of each input are not a jointly tested box.</p></article>
          <article className="card"><h3>3 · Illustrative flame</h3><p>The 3D view changes shape with gravity, oxygen, pressure, and airflow so a condition is easier to see. It is not a combustion simulation and it does not add evidence.</p></article>
        </div>
      </section>

      <section className="section wide">
        <h2>Why gravity, oxygen, and flow are the question</h2>
        <div className="crisis">
          <div className="crisis-text">
            <p><b>On Earth, hot gas rises.</b> That buoyant flow shapes the familiar teardrop flame <C href={NASA_COMB}>NASA</C>.</p>
            <p><b>In orbital free fall, buoyancy is gone</b>, and low-momentum flames can become rounded or even spherical <C href={NASA_COMB}>NASA</C>. NASA reported that flames “propagate poorly in truly quiescent conditions” and are “enhanced vigorously by low-rate atmospheric flows” <C href={FRIEDMAN}>NASA/TM-2000-210337</C>.</p>
            <p><b>Some of those flames are hard to see.</b> At very low airflow, “the entire flame is pale violet and nearly invisible” <C href={FRIEDMAN}>NASA/TM-2000-210337</C>. FLEX also recorded cool flames that continued after the visible flame went out <C href={NASA_COMB}>NASA</C>.</p>
            <p className="small muted">Near-spherical dim blue flames are typical of low-momentum droplet and gas-jet flames in microgravity. Flames over solids in a ventilation flow are elongated downstream instead.</p>
          </div>
          <div className="compare">
            <div className="compare-canvas"><Suspense fallback={<div className="canvas-fallback" />}><CompareScene /></Suspense></div>
            <div className="compare-labels">
              <div className="clabel"><h3>Normal buoyant flame (1 g)</h3><ul><li><b>Shape:</b> tall, flickering teardrop</li><li><b>Driven by:</b> buoyant convection</li><li><b>Look:</b> blue base, yellow sooty body</li></ul></div>
              <div className="clabel"><h3>Microgravity diffusion flame (~0 g)</h3><ul><li><b>Shape:</b> rounded or near-spherical</li><li><b>Driven by:</b> diffusion and airflow</li><li><b>Look:</b> dim and bluish; can be nearly invisible</li></ul></div>
            </div>
            <p className="small muted">Illustrative rendering of documented behaviour, not a combustion simulation.</p>
          </div>
        </div>
      </section>

      <section className="section wide">
        <div className="cards three">
          <article className="card"><h3>Earth screening is not always the low-oxygen bound</h3><p>In drop-tower tests, some materials burned at lower oxygen in 0 g (up to 4% O₂ lower at 30 cm/s) than in the NASA-STD-6001 upward test <C href={OLSON08}>NTRS 20080034883</C>. At Martian gravity, limits were up to 5.75% O₂ lower than at 1 g <C href={OLSON12}>NTRS 20130010991</C>.</p></article>
          <article className="card"><h3>Partial gravity is a scarce record</h3><p>A cited analysis calls lunar gravity “nearly the most flammable condition” <C href={FERKUL26}>NTRS 20260001966</C>, and puts flammability maxima near 0.15–0.4 g <C href={FRIEDMAN}>NTRS 20000120278</C>. That is a source statement, not a score computed by this app.</p></article>
          <article className="card"><h3>Exploration atmospheres are oxygen-rich on paper</h3><p>One cited lunar habitat description uses 8.2 psia with 34% O₂, and control bands up to 37% <C href={FERKUL26}>NTRS 20260001966</C>. Whether a joint cabin condition was tested is a separate question, answered only by the loaded rows.</p></article>
        </div>
        <div className="provenance-grid">
          <ProvenanceNote gravity={0.165} preset="Moon 0.165 g" />
          <ProvenanceNote gravity={0.38} preset="Mars 0.38 g" />
        </div>
        <div className="page-cta">
          <span>Continue into the cited notes and the model card:</span>
          <Link to="/safety" className="btn">Safety notes</Link>
          <Link to="/sources" className="btn ghost">Sources</Link>
          <Link to="/data" className="btn ghost">Model</Link>
          <Link to="/ask" className="btn ghost">Ask the knowledge base</Link>
        </div>
      </section>
      <NextLinks path="/learn" />
    </>
  )
}
