import { useRef, useState } from 'react'
import Disclaimer from '../components/Disclaimer'
import { PageHead } from '../components/Layout'
import { Link, navigate } from '../lib/router'
import { CATALOGS } from '../lib/catalog'
import { activityFeed, investigationNext, useWorkspace } from '../lib/workspace/WorkspaceContext'
import { STORAGE_NOTICE } from '../lib/workspace/logic'

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Dashboard() {
  const ws = useWorkspace()
  const file = useRef<HTMLInputElement>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [importNote, setImportNote] = useState<string | null>(null)
  const investigations = [...ws.doc.investigations].sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1)
  const focus = investigations[0]
  const step = focus ? investigationNext(focus) : null
  const activity = activityFeed(ws.doc)

  function startGuided() {
    const id = ws.createInvestigation({ title: 'Untitled investigation', question: '', mode: 'guided' })
    if (id) navigate(`/workspace?id=${id}`)
  }

  return (
    <>
      <PageHead kicker="Dashboard" title="Your combustion investigations">
        Saved questions, scenario history, and the next useful step. This is a guest workspace on this browser, for one person at this computer.
      </PageHead>
      <section className="section wide page-body">
        <Disclaimer />
        <p className="storage-inline">{STORAGE_NOTICE} Guest id <code>{ws.doc.owner.id.slice(0, 8)}</code>.</p>
        {ws.actionError && <div className="alert" role="alert">{ws.actionError}</div>}
        {importNote && <div className="caution" role="status">{importNote}</div>}

        <div className="next-callout">
          <div>
            <div className="pagehead-kicker">Next step</div>
            {step && focus ? (
              <>
                <h2>{step.title}</h2>
                <p>{step.detail}</p>
                <p className="small muted">In “{focus.title}”.</p>
              </>
            ) : (
              <>
                <h2>Start with one question</h2>
                <p>Write the condition you want to investigate, or open the sandbox and save a point once the oxygen, pressure, airflow, and material look right.</p>
              </>
            )}
          </div>
          <div className="cta">
            {focus ? <Link to={`/workspace?id=${focus.id}`} className="btn">Continue “{focus.title}”</Link> : <button className="btn" onClick={startGuided}>Start a guided investigation</button>}
            <Link to="/simulator" className="btn ghost">Open the sandbox</Link>
          </div>
        </div>

        <div className="dash-toolbar">
          <button className="btn" onClick={startGuided}>New guided investigation</button>
          <button className="btn ghost" onClick={() => download(`ignite-workspace-${ws.doc.owner.id.slice(0, 8)}.json`, ws.exportFull())}>Download full backup</button>
          <button className="btn ghost" onClick={() => file.current?.click()}>Import backup or parameters</button>
          <input ref={file} className="sr-only" type="file" accept="application/json,.json" aria-label="Import workspace JSON" onChange={async e => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            const error = ws.importText(await f.text())
            setImportNote(error || 'Import finished. Check the notice above for anything that was skipped.')
          }} />
        </div>

        <h2>Saved investigations</h2>
        {investigations.length === 0 && <p className="muted">None yet. A new investigation starts empty. Conditions are stored only after you save a scenario.</p>}
        <div className="cards inv-grid">
          {investigations.map(inv => {
            const n = investigationNext(inv)
            const scenario = inv.scenarios.find(s => s.id === inv.activeScenarioId) ?? inv.scenarios[inv.scenarios.length - 1]
            return (
              <article key={inv.id} className="card inv-card">
                <h3>{inv.title}</h3>
                <p>{inv.question || <span className="muted">No question yet.</span>}</p>
                <p className="small muted">{inv.scenarios.length} saved scenario{inv.scenarios.length === 1 ? '' : 's'} · {inv.comparisons.length} comparison{inv.comparisons.length === 1 ? '' : 's'} · {inv.mode === 'sandbox' ? 'Sandbox layout' : 'Guided steps'}</p>
                {scenario && <p className="small">{scenario.conditions.envId} · {scenario.conditions.oxygen_pct}% O₂ · {scenario.conditions.material}</p>}
                <p className="small"><b>Next:</b> {n.title}</p>
                <div className="cta">
                  <Link to={`/workspace?id=${inv.id}`} className="btn small">Open</Link>
                  {pendingDelete === inv.id
                    ? <button className="btn ghost small" onClick={() => { ws.deleteInvestigation(inv.id); setPendingDelete(null) }}>Confirm delete</button>
                    : <button className="btn ghost small" onClick={() => setPendingDelete(inv.id)}>Delete</button>}
                </div>
              </article>
            )
          })}
        </div>

        <h2>Recent activity</h2>
        {activity.length === 0 && <p className="muted">Activity appears when you create an investigation, save a scenario, compare materials, or update notes.</p>}
        <ul className="activity">
          {activity.map(item => {
            const inv = ws.doc.investigations.find(i => i.id === item.investigationId)
            return <li key={item.id}><time dateTime={item.at}>{item.at.replace('T', ' ').slice(0, 16)}</time> · {inv ? inv.title : 'Investigation'} · {item.summary}</li>
          })}
        </ul>

        <h2>Data this dashboard can use</h2>
        <div className="cards two">
          {CATALOGS.map(c => (
            <article key={c.id} className="card">
              <h3>{c.title}</h3>
              <p className="small"><b>{c.state === 'loaded' ? 'Loaded' : 'Not loaded'}</b></p>
              <p>{c.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
