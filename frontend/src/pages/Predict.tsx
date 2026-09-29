import type { ModelCard } from '../lib/api'
import { MATERIAL_LABEL, OUTCOME_COLOR, OUTCOME_LABEL } from '../lib/api'
import { ConditionsPanel, PredictionPanel } from '../components/Conditions'
import BoundaryPlot from '../components/BoundaryPlot'
import { FlexPanel } from '../components/Sections'
import EnvTabs from '../components/EnvTabs'
import { NextLinks, PageHead } from '../components/Layout'
import { Link } from '../lib/router'
import { useSim } from '../lib/sim'

const SIM_HELP = 'Distance is the same one the model uses to find its nearest evidence: the Euclidean distance over oxygen, pressure and airflow, each scaled by the full range tested in the dataset, plus 1 if the material differs, plus 1 if the gravity level differs and plus 0.25 if the flow direction differs. Similarity = 1 / (1 + distance): 100% means identical conditions, 50% means a distance of 1 (for example, the same conditions but a different material).'
const similarity = (d: number) => Math.round(100 / (1 + d))

export default function Predict({ card }: { card: ModelCard | null }) {
  const { env, inp, setInpF, gas, setGas, gases, pred, err, bnd, menv, playing, play, stop, crossing, demoLog } = useSim()
  return (
    <>
      <PageHead kicker="Prediction & experiments" title="Will a fire spread here? The evidence">
        The model predicts <b>spread / marginal / no spread</b> only inside the conditions NASA actually tested. Outside them the <b>range guard</b> refuses. Below the prediction: the decision boundary drawn over the real tests, and the nearest published experiments with verbatim quotes. Settings are shared with the <Link to="/simulator">3D simulator</Link>.
      </PageHead>
      <EnvTabs />
      {env && inp && (
        <section className="section wide envsec">
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
              <h3>Closest experiments, ranked by similarity to your conditions</h3>
              <p className="small muted">Similarity = 1 / (1 + distance), shown as a percentage. <span className="sim-help" title={SIM_HELP}>How is this computed?</span></p>
              {pred?.nearest_experiments.map(e => (
                <a key={e.row_id} className="exp" href={e.source_url} target="_blank" rel="noreferrer">
                  <div className="exp-top"><span className="pill" style={{ background: OUTCOME_COLOR[e.outcome] }}>{OUTCOME_LABEL[e.outcome]}</span><b>{e.report_id}</b><span className="muted">{e.source_location}</span>{e.distance != null && <span className="sim" title={SIM_HELP}>similarity {similarity(e.distance)}% · distance {e.distance}</span>}</div>
                  <div className="exp-cond">{e.gravity_g ?? 0} g · {e.oxygen_pct}% O₂ · {e.pressure_kpa} kPa · {e.flow_cm_s} cm/s {e.flow_direction} · {MATERIAL_LABEL[e.material] || e.material}</div>
                  <div className="exp-q">“{e.quote}”</div>
                  <div className="exp-src muted">{e.source_title} · {e.facility}</div>
                </a>
              ))}
            </div>
          </div>
          {gas !== 'co2' && <div className="panel note-panel"><h3>Carbon dioxide build-up?</h3><p className="small">The classifier only covers O₂/N₂ atmospheres. Pick the <b>Carbon dioxide</b> gas chip to see the real FLEX (NASA PSI-69) CO₂-dilution droplet data instead, shown as published.</p></div>}
        </section>
      )}
      <NextLinks path="/predict" />
    </>
  )
}
