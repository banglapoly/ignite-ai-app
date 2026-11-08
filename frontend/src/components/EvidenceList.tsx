import type { Experiment } from '../lib/api'
import { MATERIAL_LABEL, OUTCOME_COLOR, OUTCOME_LABEL } from '../lib/api'
import { RANKING_HELP, similarityPercent } from '../lib/workspace/logic'

export function EvidenceList({ experiments, empty }: { experiments: Experiment[]; empty?: string }) {
  if (!experiments.length) return <p className="small muted">{empty || 'No ranked experiments are available for this request.'}</p>
  return (
    <div>
      <p className="small muted">Ranked nearest published tests. <span className="sim-help" title={RANKING_HELP}>How is this ranked?</span></p>
      {experiments.map(e => (
        <a key={e.row_id} className="exp" href={e.source_url} target="_blank" rel="noreferrer">
          <div className="exp-top">
            <span className="pill" style={{ background: OUTCOME_COLOR[e.outcome] }}>{OUTCOME_LABEL[e.outcome]}</span>
            <b>{e.report_id}</b>
            <span className="muted">{e.source_location}</span>
            {e.distance != null && <span className="sim" title={RANKING_HELP}>similarity {similarityPercent(e.distance)}% · distance {e.distance}</span>}
          </div>
          <div className="exp-cond">{e.gravity_g ?? 0} g · {e.oxygen_pct}% O₂ · {e.pressure_kpa} kPa · {e.flow_cm_s} cm/s {e.flow_direction} · {MATERIAL_LABEL[e.material] || e.material}</div>
          <div className="exp-q">“{e.quote}”</div>
          <div className="exp-src muted">{e.source_title} · {e.facility}</div>
        </a>
      ))}
    </div>
  )
}
