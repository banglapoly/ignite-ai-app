import type { ModelCard } from '../lib/api'
import { MATERIAL_LABEL } from '../lib/api'
import { ConditionsPanel, PredictionPanel } from '../components/Conditions'
import BoundaryPlot from '../components/BoundaryPlot'
import { EvidenceList } from '../components/EvidenceList'
import { FlexPanel } from '../components/Sections'
import EnvTabs from '../components/EnvTabs'
import { NextLinks, PageHead } from '../components/Layout'
import NasaSources from '../components/NasaSources'
import RankedInvestigations from '../components/RankedInvestigations'
import { Link } from '../lib/router'
import { useSim } from '../lib/sim'

export default function Predict({ card }: { card: ModelCard | null }) {
  const { env, inp, setInpF, gas, setGas, gases, pred, err, bnd, menv, playing, play, stop, crossing, demoLog } = useSim()
  return (
    <>
      <PageHead kicker="Evidence" title="Loaded tests, then the model estimate">
        The official challenge asks for a dashboard that summarizes, ranks, and interprets PSI combustion investigations for fire safety in habitable crew environments: spacecraft, stations, lunar and Mars bases, and pressurized rovers. It should support predictive modelling of flammability and point to research for next-generation fire safety. Rocket and propellant fires are out of scope. The model below estimates <b>spread / marginal / no spread</b> only inside the loaded tests. Settings are shared with the <Link to="/simulator">sandbox</Link>.
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
          <div className="panel" id="nasa-sources">
            <h3>NASA data sources</h3>
            <p className="small">These are the official NASA Space Apps 2026 resource titles and links, published 13 November 2026. They are references. They were not added to the 143 training rows, and the classifier was not retrained.</p>
            <NasaSources />
          </div>
          <div className="panel" id="ranked-investigations">
            <h3>Ranked investigations</h3>
            <p className="small">Twenty-four Combustion Science investigations from the PSI repository metadata captured on 13 November 2026. The list uses the accession, acronym, title, objectives, and PSI page stored in that metadata. PSI has no partial-gravity combustion data yet. Lunar-g Combustion Investigation (LUCI) and Flammability of Materials on the Moon (FM2) are expected later, so a Moon or Mars preset does not match a partial-gravity PSI investigation. Of these 24, the 143-row table cites PSI-25 (BASS-II) and PSI-99 (SAFFIRE-II) in row notes. The other investigations are not yet linked as training rows. The 143 rows also include drop-tower, shuttle, Saffire IV, V, and VI, and a lunar sounding-rocket row. Those later Saffire flights and LUCI are not in this 24-investigation list.</p>
            {env && inp && <RankedInvestigations query={{ gravityG: env.gravity_g, flowCmS: inp.flow_cm_s, flowDirection: inp.flow_direction, material: inp.material }} />}
          </div>
        </section>
      )}
      <NextLinks path="/predict" />
    </>
  )
}
