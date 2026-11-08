import { Suspense, lazy } from 'react'
import type { ModelCard } from '../lib/api'
import { MATERIAL_LABEL, OUTCOME_COLOR, OUTCOME_LABEL } from '../lib/api'
import { ConditionsPanel, PredictionPanel } from '../components/Conditions'
import { FactCard, KeyFindings } from '../components/Sections'
import EnvTabs, { TAB_ICON } from '../components/EnvTabs'
import { Link, navigate } from '../lib/router'
import { useSim } from '../lib/sim'
import { useWorkspace } from '../lib/workspace/WorkspaceContext'
import type { FlowDirection } from '../lib/workspace/logic'
import type { FlameState } from '../three/Flame'

const FlameScene = lazy(() => import('../components/FlameScene'))

export default function Simulator({ card }: { card: ModelCard | null }) {
  const { env, inp, setInpF, gas, setGas, gases, pred, err, playing, play, stop, crossing, demoLog } = useSim()
  const ws = useWorkspace()
  const state: FlameState = pred ? (pred.in_training_range ? pred.prediction : 'refused') : null
  const ppO2 = inp ? (inp.oxygen_pct / 100) * inp.pressure_kpa : 0
  return (
    <>
      <h1 className="sr-only">3D Flame Simulator</h1>
      <section className="viewport">
        <div className="viewport-canvas">
          {env && inp ? (
            <Suspense fallback={<div className="canvas-fallback" />}>
              <FlameScene env={env.id} params={{ gravity: env.gravity_g, o2: inp.oxygen_pct, pressure: inp.pressure_kpa, flow: inp.flow_cm_s, flowDir: inp.flow_direction, state }} autoRotate={!playing} />
            </Suspense>
          ) : <div className="canvas-fallback" />}
        </div>
        {env && inp && (
          <>
            <div className="hud hud-left">
              <div className="hud-title">ENVIRONMENT CHAMBER · {env.short.toUpperCase()}</div>
              <div className="hud-row"><span>Gravity</span><b>{env.gravity_g} g</b></div>
              <div className="hud-row"><span>Oxygen</span><b>{inp.oxygen_pct.toFixed(1)} %</b></div>
              <div className="hud-row"><span>Pressure</span><b>{inp.pressure_kpa.toFixed(1)} kPa</b></div>
              <div className="hud-row"><span>Airflow</span><b>{inp.flow_cm_s.toFixed(1)} cm/s</b></div>
              <div className="hud-row"><span>O₂ partial pressure <i>computed</i></span><b>{ppO2.toFixed(1)} kPa</b></div>
              <div className="hud-row"><span>Buoyant flow vs Earth <i>estimate √g</i></span><b>{env.gravity_g ? `≈ ${Math.sqrt(env.gravity_g).toFixed(2)}×` : '≈ 0 (none)'}</b></div>
            </div>
            <div className="hud hud-right">
              <div className="hud-title">MODEL ESTIMATE · NOT A RISK SCORE</div>
              {pred && pred.in_training_range && pred.prediction ? (
                <div className="hud-verdict" style={{ color: OUTCOME_COLOR[pred.prediction], borderColor: OUTCOME_COLOR[pred.prediction] }}>ESTIMATE · {OUTCOME_LABEL[pred.prediction].toUpperCase()} · {Math.round((pred.probabilities?.[pred.prediction] || 0) * 100)}% SHARE</div>
              ) : <div className="hud-verdict refused">NO ESTIMATE · OUTSIDE LOADED TESTS</div>}
              <div className="hud-row"><span>Range guard</span><b className={pred?.in_training_range ? 'ok' : 'bad'}>{pred?.in_training_range ? 'IN ENVELOPE' : 'REFUSED'}</b></div>
              <div className="hud-row"><span>Gas mix</span><b className={gas === 'air' ? 'ok' : 'bad'}>{gas === 'air' ? 'O₂/N₂ (modelled)' : 'not modelled'}</b></div>
              <div className="hud-row"><span>Material</span><b>{MATERIAL_LABEL[inp.material] || inp.material}</b></div>
              <div className="hud-row"><span>Tests at this gravity</span><b>{env.dataset.n}</b></div>
            </div>
            <div className="viewport-caption">Illustrative rendering driven by your inputs and the model output (shape from √g buoyancy, size and colour from O₂ and pressure, skew from airflow). It is not a combustion simulation. Drag to look around.</div>
          </>
        )}
      </section>

      <EnvTabs />

      {env && inp && (
        <section className="section wide envsec" id="environment">
          <div className="env-head">
            <h2>{TAB_ICON[env.id]} {env.name}: {env.tagline}</h2>
            <p className="small">{env.data_note}{env.dataset.oof_accuracy && env.gravity_g > 0 ? ` Out-of-fold accuracy at this gravity: ${(env.dataset.oof_accuracy.accuracy * 100).toFixed(0)}% (n=${env.dataset.oof_accuracy.n}).` : ''}</p>
          </div>
          <KeyFindings env={env} />
          <div className="facts">{env.facts.map(f => <FactCard key={f.label} f={f} />)}</div>
          <div className="explorer-grid">
            <ConditionsPanel env={env} card={card} inp={inp} setInp={setInpF} gas={gas} setGas={g => setGas(g)} gases={gases} playing={playing} onPlay={play} onStop={stop} />
            <PredictionPanel pred={pred} err={err} env={env} crossing={crossing} demoLog={demoLog} />
          </div>
          {ws.actionError && <div className="alert" role="alert">{ws.actionError}</div>}
          <div className="page-cta">
            <span>Save or inspect this point:</span>
            <button className="btn" onClick={() => {
              const id = ws.createInvestigation({
                title: `${env.short} · ${MATERIAL_LABEL[inp.material] || inp.material}`,
                question: '',
                mode: 'sandbox',
                scenario: { envId: env.id, gravity_g: env.gravity_g, oxygen_pct: inp.oxygen_pct, pressure_kpa: inp.pressure_kpa, flow_cm_s: inp.flow_cm_s, material: inp.material, flow_direction: inp.flow_direction as FlowDirection, gas_mix: gas },
              })
              if (id) navigate(`/workspace?id=${id}`)
            }}>Save into a new investigation</button>
            {ws.doc.lastOpenedId && <button className="btn ghost" onClick={() => {
              const ok = ws.saveScenario(ws.doc.lastOpenedId!, { envId: env.id, gravity_g: env.gravity_g, oxygen_pct: inp.oxygen_pct, pressure_kpa: inp.pressure_kpa, flow_cm_s: inp.flow_cm_s, material: inp.material, flow_direction: inp.flow_direction as FlowDirection, gas_mix: gas }, 'From the sandbox')
              if (ok) navigate(`/workspace?id=${ws.doc.lastOpenedId}`)
            }}>Add to the last investigation</button>}
            <Link to="/predict" className="btn ghost">Evidence and nearest experiments</Link>
            <Link to="/dashboard" className="btn ghost">Dashboard</Link>
          </div>
        </section>
      )}
    </>
  )
}
