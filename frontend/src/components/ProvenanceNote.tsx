import { useEffect, useState } from 'react'
import type { Experiment } from '../lib/api'
import { getJSON } from '../lib/api'
import { provenanceByReport } from '../lib/workspace/logic'

export default function ProvenanceNote({ gravity, preset }: { gravity: number; preset: string }) {
  const [rows, setRows] = useState<Experiment[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    setFailed(false)
    getJSON<{ rows: Experiment[] }>(`/experiments?gravity_g=${gravity}`)
      .then(d => { if (live) setRows(d.rows) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [gravity])
  const groups = rows ? provenanceByReport(rows, gravity) : []
  return (
    <aside className="provenance">
      <h3>What “{preset}” means in the loaded data</h3>
      <p>Choosing this environment sets a gravity preset and shows cited cabin context. The preset is not evidence that a habitat fire was tested there. Partial-gravity rows below name the facility written on each loaded test.</p>
      {failed && <p className="small warn-text">The experiment list could not be read, so this page will not invent a facility list.</p>}
      {rows && groups.length === 0 && <p className="small">No loaded rows are at {gravity} g.</p>}
      {groups.length > 0 && (
        <ul>
          {groups.map(g => (
            <li key={g.report_id + g.facility}>
              <b>{g.n}</b> {g.n === 1 ? 'row' : 'rows'} · {g.source_url ? <a href={g.source_url} target="_blank" rel="noreferrer">{g.report_id}</a> : g.report_id}
              {g.source_title ? ` — ${g.source_title}` : ''}. Facility: {g.facility}.
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
