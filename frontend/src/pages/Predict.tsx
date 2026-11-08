import type { ModelCard } from '../lib/api'
import { MATERIAL_LABEL } from '../lib/api'
import { ConditionsPanel, PredictionPanel } from '../components/Conditions'
import BoundaryPlot from '../components/BoundaryPlot'
import { EvidenceList } from '../components/EvidenceList'
import { FlexPanel } from '../components/Sections'
import EnvTabs from '../components/EnvTabs'
import { NextLinks, PageHead } from '../components/Layout'
import { Link } from '../lib/router'
import { useSim } from '../lib/sim'

export default function Predict({ card }: { card: ModelCard | null }) {
  const { env, inp, setInpF, gas, setGas, gases, pred, err, bnd, menv, playing, play, stop, crossing, demoLog } = useSim()
  return (
    <>
      <PageHead kicker="Evidence" title="Loaded tests, then the model estimate">
        The model estimates <b>spread / marginal / no spread</b> only inside the loaded tests. Outside them it refuses. The decision boundary is the model. The ranked experiments are the evidence. Settings are shared with the <Link to="/simulator">sandbox</Link>. A min-to-max band is not a jointly tested combination.
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
              <h3>Closest experiments, ranked by distance to these conditions</h3>
              <EvidenceList experiments={pred?.nearest_experiments ?? []} />
            </div>
          </div>
          {gas !== 'co2' && <div className="panel note-panel"><h3>Carbon dioxide build-up?</h3><p className="small">The classifier only covers O₂/N₂ atmospheres. Pick the <b>Carbon dioxide</b> gas chip to see the real FLEX (NASA PSI-69) CO₂-dilution droplet data instead, shown as published.</p></div>}
        </section>
      )}
      <NextLinks path="/predict" />
    </>
  )
}
