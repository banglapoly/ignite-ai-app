import { Fragment, useEffect, useMemo, useState } from 'react'
import type { Experiment } from '../lib/api'
import { GRAVITY_LABEL, MATERIAL_LABEL, OUTCOME_COLOR, OUTCOME_LABEL, getJSON, gkey } from '../lib/api'

export default function DataTable() {
  const [rows, setRows] = useState<Experiment[]>([])
  const [q, setQ] = useState('')
  const [mat, setMat] = useState('')
  const [out, setOut] = useState('')
  const [grav, setGrav] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => { getJSON<{ rows: Experiment[] }>('/experiments').then(d => setRows(d.rows)).catch(() => {}) }, [])
  const mats = useMemo(() => Array.from(new Set(rows.map(r => r.material))).sort(), [rows])
  const shown = rows.filter(r => (!mat || r.material === mat) && (!out || r.outcome === out) && (!grav || gkey(r.gravity_g ?? 0) === grav) &&
    (!q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())))
  return (
    <div className="datatable">
      <div className="dt-controls">
        <input placeholder="Search (report id, quote, facility…)" value={q} onChange={e => setQ(e.target.value)} />
        <select value={mat} onChange={e => setMat(e.target.value)}><option value="">All materials</option>{mats.map(m => <option key={m} value={m}>{MATERIAL_LABEL[m] || m}</option>)}</select>
        <select value={grav} onChange={e => setGrav(e.target.value)}><option value="">All gravity levels</option>{Object.entries(GRAVITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={out} onChange={e => setOut(e.target.value)}><option value="">All outcomes</option>{Object.keys(OUTCOME_LABEL).map(o => <option key={o} value={o}>{OUTCOME_LABEL[o as keyof typeof OUTCOME_LABEL]}</option>)}</select>
        <span className="muted">{shown.length} / {rows.length} rows</span>
        <a className="btn ghost small" href="/static-api/experiments.csv" download="experiments.csv">Download CSV</a>
      </div>
      <div className="dt-scroll">
        <table>
          <thead><tr><th>ID</th><th>g</th><th>O₂ %</th><th>kPa</th><th>cm/s</th><th>Direction</th><th>Material</th><th>Outcome</th><th>Source</th><th>Where</th></tr></thead>
          <tbody>
            {shown.map(r => (
              <Fragment key={r.row_id}>
                <tr onClick={() => setOpen(open === r.row_id ? null : r.row_id)} className="clickable">
                  <td>{r.row_id}</td><td>{r.gravity_g}</td><td>{r.oxygen_pct}</td><td>{r.pressure_kpa}</td><td>{r.flow_cm_s}</td><td>{r.flow_direction}</td>
                  <td>{MATERIAL_LABEL[r.material] || r.material}</td>
                  <td><span className="pill" style={{ background: OUTCOME_COLOR[r.outcome] }}>{OUTCOME_LABEL[r.outcome]}</span></td>
                  <td><a href={r.source_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{r.report_id}</a></td>
                  <td className="muted">{r.source_location}</td>
                </tr>
                {open === r.row_id && (
                  <tr className="detail"><td colSpan={10}>
                    <div><b>Quote / value as printed:</b> “{r.quote}”</div>
                    <div><b>Outcome detail:</b> {r.outcome_detail}</div>
                    <div><b>Material:</b> {r.material_detail} · <b>Facility:</b> {r.facility}</div>
                    {r.notes && <div><b>Notes:</b> {r.notes}</div>}
                    {r.extra_sources && <div><b>Also cited:</b> {r.extra_sources}</div>}
                    <div className="muted">{r.source_title}</div>
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
