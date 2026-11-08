import { useMemo, useRef, useState } from 'react'
import { Link, navigate } from '../lib/router'
import { CATALOGS } from '../lib/catalog'
import { activityFeed, investigationNext, useWorkspace } from '../lib/workspace/WorkspaceContext'
import type { Investigation } from '../lib/workspace/logic'

const SIDE = [
  { to: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { to: '/simulator', label: 'Sandbox', icon: 'flame' },
  { to: '/predict', label: 'Evidence', icon: 'chart' },
  { to: '/learn', label: 'Learn', icon: 'book' },
  { to: '/ask', label: 'Ask', icon: 'chat' },
  { to: '/sources', label: 'Sources', icon: 'link' },
  { to: '/data', label: 'Model', icon: 'box' },
] as const

function Icon({ name }: { name: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      {name === 'grid' && <><rect {...common} x="4" y="4" width="6" height="6" rx="1.4" /><rect {...common} x="14" y="4" width="6" height="6" rx="1.4" /><rect {...common} x="4" y="14" width="6" height="6" rx="1.4" /><rect {...common} x="14" y="14" width="6" height="6" rx="1.4" /></>}
      {name === 'flame' && <path {...common} d="M12 3s5 4.2 5 8.2A5 5 0 0 1 7 12c0-1.4.7-2.4 1.6-3.2C8 11 9 12 10.2 12 10 8.5 12 6 12 3z" />}
      {name === 'chart' && <path {...common} d="M4 19h16M7 16v-4M12 16V8M17 16v-6" />}
      {name === 'book' && <path {...common} d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5zM5 5.5V21" />}
      {name === 'chat' && <path {...common} d="M6 16.5 4 20l4.2-1.4A8 8 0 1 0 6 16.5z" />}
      {name === 'link' && <path {...common} d="M10 13a5 5 0 0 0 7.1.1l1.4-1.5a5 5 0 0 0-7.1-7.1L10 6M14 11a5 5 0 0 0-7.1-.1L5.5 12.4a5 5 0 0 0 7.1 7.1L14 18" />}
      {name === 'box' && <path {...common} d="M4 8l8-4 8 4-8 4-8-4zM4 8v8l8 4 8-4V8M12 12v8" />}
      {name === 'home' && <path {...common} d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />}
    </svg>
  )
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function checklist(inv: Investigation) {
  return [!!inv.question.trim(), inv.scenarios.length > 0, inv.comparisons.length > 0, !!inv.notes.trim()]
}

function Ring({ fraction, label }: { fraction: number; label: string }) {
  const r = 26
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, fraction))
  return (
    <figure className="desk-ring">
      <svg viewBox="0 0 72 72" role="img" aria-label={`${Math.round(pct * 100)} percent, ${label}`}>
        <circle cx="36" cy="36" r={r} className="track" />
        <circle cx="36" cy="36" r={r} className="val" strokeDasharray={`${c * pct} ${c}`} />
      </svg>
      <figcaption><b>{Math.round(pct * 100)}%</b><span>{label}</span></figcaption>
    </figure>
  )
}

export default function Dashboard() {
  const ws = useWorkspace()
  const file = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [importNote, setImportNote] = useState<string | null>(null)
  const [sideOpen, setSideOpen] = useState(false)
  const investigations = useMemo(
    () => [...ws.doc.investigations].sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1),
    [ws.doc.investigations],
  )
  const query = q.trim().toLowerCase()
  const shown = query
    ? investigations.filter(inv => `${inv.title} ${inv.question}`.toLowerCase().includes(query))
    : investigations
  const focus = investigations[0]
  const step = focus ? investigationNext(focus) : null
  const activity = activityFeed(ws.doc)
  const total = investigations.length
  const share = (pick: (inv: Investigation) => boolean) => total ? investigations.filter(pick).length / total : 0
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const bars = investigations.slice(0, 7)

  function startGuided() {
    const id = ws.createInvestigation({ title: 'Untitled investigation', question: '', mode: 'guided' })
    if (id) navigate(`/workspace?id=${id}`)
  }

  return (
    <div className="desk">
      <aside className={'desk-side' + (sideOpen ? ' open' : '')} aria-label="Workspace">
        <Link to="/" className="desk-brand"><img src="/logo.svg" alt="" width={28} height={28} />IGNITE-AI</Link>
        <nav>
          {SIDE.map(item => (
            <Link key={item.to} to={item.to} className={item.to === '/dashboard' ? 'on' : ''} aria-current={item.to === '/dashboard' ? 'page' : undefined} onClick={() => setSideOpen(false)}>
              <Icon name={item.icon} />{item.label}
            </Link>
          ))}
        </nav>
        <Link to="/" className="desk-leave" onClick={() => setSideOpen(false)}><Icon name="home" />Public page</Link>
      </aside>

      <div className="desk-body">
        <header className="desk-top">
          <button className="desk-menu" aria-label="Open workspace menu" aria-expanded={sideOpen} onClick={() => setSideOpen(o => !o)}><span /><span /><span /></button>
          <label className="desk-search">
            <span className="sr-only">Search saved investigations</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search saved investigations" />
          </label>
          <div className="desk-top-actions">
            <button className="desk-iconbtn" onClick={() => download(`ignite-workspace-${ws.doc.owner.id.slice(0, 8)}.json`, ws.exportFull())}>Backup</button>
            <button className="desk-iconbtn" onClick={() => file.current?.click()}>Import</button>
            <input ref={file} className="sr-only" type="file" accept="application/json,.json" aria-label="Import workspace JSON" onChange={async e => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              const error = ws.importText(await f.text())
              setImportNote(error || 'Import finished. Skipped rows, if any, are listed here.')
            }} />
            <div className="desk-user" title="Guest on this browser. Not an account and not synced.">
              <img src="/logo.svg" alt="" width={32} height={32} />
              <span><b>Guest</b><small>{ws.persistence === 'saved' ? 'This browser' : ws.persistence === 'held' ? 'Save held' : 'Not saved'}</small></span>
            </div>
          </div>
        </header>

        {(ws.actionError || importNote || ws.message) && (
          <div className="desk-alert" role="status">{ws.actionError || importNote || ws.message}</div>
        )}

        <div className="desk-grid">
          <div className="desk-maincol">
            <section className="desk-hello">
              <div>
                <h1>Hello, guest</h1>
                <p>{total === 0
                  ? 'No investigations are saved in this browser yet. Start with one question, or explore the sandbox and save a point.'
                  : `You have ${total} investigation${total === 1 ? '' : 's'} on this computer. ${step ? step.detail : ''}`}</p>
                <div className="desk-hello-actions">
                  {focus ? <Link to={`/workspace?id=${focus.id}`} className="desk-link">Continue “{focus.title}”</Link> : <button className="desk-link" onClick={startGuided}>Start a guided investigation</button>}
                  <Link to="/simulator" className="desk-link quiet">Open the sandbox</Link>
                </div>
              </div>
              <img src="/logo.svg" alt="" className="desk-hello-mark" width={96} height={96} />
            </section>

            <section className="desk-block">
              <header className="desk-block-head">
                <h2>This browser</h2>
                <span className="desk-chip">{today}</span>
              </header>
              <div className="desk-metrics">
                <article className="desk-card">
                  <h3>Checklist progress</h3>
                  <p className="desk-lead"><b>{total}</b> saved investigation{total === 1 ? '' : 's'}</p>
                  <p className="desk-note">Each bar is how many of four pieces exist: a question, a scenario, a comparison, and a note. It is not a model score.</p>
                  {bars.length === 0 && <p className="desk-empty">Bars appear after the first investigation is created.</p>}
                  <div className="desk-bars" aria-hidden={bars.length === 0}>
                    {bars.map(inv => {
                      const done = checklist(inv).filter(Boolean).length
                      return (
                        <div key={inv.id} className="desk-bar" title={`${inv.title}: ${done} of 4`}>
                          <div style={{ height: `${18 + done * 18}px` }} />
                          <span>{inv.title}</span>
                        </div>
                      )
                    })}
                  </div>
                </article>
                <article className="desk-card">
                  <h3>What is filled in</h3>
                  <div className="desk-rings">
                    <Ring fraction={share(i => !!i.question.trim())} label="Have a question" />
                    <Ring fraction={share(i => i.scenarios.length > 0)} label="Have a scenario" />
                    <Ring fraction={share(i => i.comparisons.length > 0)} label="Have a comparison" />
                    <Ring fraction={share(i => !!i.notes.trim())} label="Have notes" />
                  </div>
                  <p className="desk-note">Percents are shares of the investigations in this browser. With none saved, every ring stays at 0. They are not accuracy and not a risk score.</p>
                </article>
              </div>
            </section>

            <section className="desk-block" id="saved">
              <header className="desk-block-head">
                <h2>Saved investigations</h2>
                <button className="desk-textbtn" onClick={startGuided}>New investigation</button>
              </header>
              {shown.length === 0 && <p className="desk-empty">{query ? 'No saved investigation matches that search.' : 'None yet. A new investigation starts empty. Conditions are stored only after you save a scenario.'}</p>}
              <div className="desk-invs">
                {shown.map(inv => {
                  const n = investigationNext(inv)
                  const scenario = inv.scenarios.find(s => s.id === inv.activeScenarioId) ?? inv.scenarios[inv.scenarios.length - 1]
                  return (
                    <article key={inv.id} className="desk-inv">
                      <img src="/logo.svg" alt="" width={36} height={36} />
                      <div>
                        <h3>{inv.title}</h3>
                        <p>{inv.question || 'No question yet.'}</p>
                        <p className="desk-meta">{scenario ? `${scenario.conditions.envId} · ${scenario.conditions.oxygen_pct}% O₂ · ${scenario.conditions.material}` : 'No scenario saved'} · Next: {n.title}</p>
                      </div>
                      <div className="desk-inv-actions">
                        <Link to={`/workspace?id=${inv.id}`}>Open</Link>
                        {pendingDelete === inv.id
                          ? <button onClick={() => { ws.deleteInvestigation(inv.id); setPendingDelete(null) }}>Confirm</button>
                          : <button onClick={() => setPendingDelete(inv.id)}>Delete</button>}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            <section className="desk-block">
              <header className="desk-block-head"><h2>Data loaded for this workspace</h2></header>
              <div className="desk-sources">
                {CATALOGS.map(c => (
                  <article key={c.id} className="desk-inv">
                    <span className={'desk-dot' + (c.state === 'loaded' ? ' on' : '')} aria-hidden="true" />
                    <div>
                      <h3>{c.title}</h3>
                      <p>{c.state === 'loaded' ? 'Loaded in this build' : 'Not loaded'}. {c.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
              <p className="desk-note">Research and education aid. This dashboard does not certify a material, and a missing estimate is not a finding that a condition is safe.</p>
            </section>
          </div>

          <aside className="desk-rail">
            <section className="desk-today">
              <span className="desk-chip">Today</span>
              <h2>{today}</h2>
              <article className="desk-next">
                <b>{step ? step.title : 'Start with one question'}</b>
                <p>{step && focus ? `In “${focus.title}”. ${step.detail}` : 'Write the condition you want to investigate, then save it in this browser.'}</p>
                {focus ? <Link to={`/workspace?id=${focus.id}`}>Open</Link> : <button onClick={startGuided}>Start</button>}
              </article>
              <p className="desk-note">Guest id {ws.doc.owner.id.slice(0, 8)}. Stored only in this browser. Export a backup before you rely on it.</p>
            </section>
            <section className="desk-block">
              <header className="desk-block-head"><h2>Recent activity</h2></header>
              {activity.length === 0 && <p className="desk-empty">Activity appears when you create an investigation, save a scenario, compare materials, or update notes.</p>}
              <ul className="desk-events">
                {activity.map(item => {
                  const inv = ws.doc.investigations.find(i => i.id === item.investigationId)
                  const when = item.at.replace('T', ' ').slice(0, 16)
                  return (
                    <li key={item.id}>
                      <img src="/logo.svg" alt="" width={28} height={28} />
                      <div>
                        <b>{inv ? inv.title : 'Investigation'}</b>
                        <span>{item.summary}</span>
                        <time dateTime={item.at}>{when}</time>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
