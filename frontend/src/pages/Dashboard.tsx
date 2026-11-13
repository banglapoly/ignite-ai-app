import { useMemo, useRef, useState } from 'react'
import { Link, navigate } from '../lib/router'
import { CATALOGS } from '../lib/catalog'
import { IconChart, IconPage, IconPen, IconBook } from '../components/icons'
import { activityFeed, investigationNext, useWorkspace } from '../lib/workspace/WorkspaceContext'
import type { Investigation } from '../lib/workspace/logic'

const ENVS = [
  { id: 'iss', label: 'ISS ~0 g' },
  { id: 'moon', label: 'Moon 0.165 g' },
  { id: 'mars', label: 'Mars 0.38 g' },
  { id: 'earth', label: 'Earth 1 g' },
  { id: 'transit', label: 'Transit cabin' },
]

const PIECES: { key: 'question' | 'scenario' | 'compare' | 'notes'; label: string; Icon: typeof IconPage }[] = [
  { key: 'question', label: 'Question', Icon: IconPen },
  { key: 'scenario', label: 'Scenario', Icon: IconBook },
  { key: 'compare', label: 'Comparison', Icon: IconChart },
  { key: 'notes', label: 'Notes', Icon: IconPage },
]

function filled(inv: Investigation | undefined, key: (typeof PIECES)[number]['key']) {
  if (!inv) return false
  if (key === 'question') return !!inv.question.trim()
  if (key === 'scenario') return inv.scenarios.length > 0
  if (key === 'compare') return inv.comparisons.length > 0
  return !!inv.notes.trim()
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

export default function Dashboard() {
  const ws = useWorkspace()
  const file = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [envId, setEnvId] = useState('iss')
  const [mode, setMode] = useState<'guided' | 'sandbox'>('guided')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [importNote, setImportNote] = useState<string | null>(null)
  const investigations = useMemo(
    () => [...ws.doc.investigations].sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1),
    [ws.doc.investigations],
  )
  const query = q.trim().toLowerCase()
  const shown = query ? investigations.filter(inv => `${inv.title} ${inv.question}`.toLowerCase().includes(query)) : investigations
  const focus = investigations[0]
  const step = focus ? investigationNext(focus) : null
  const activity = activityFeed(ws.doc)
  const total = investigations.length
  const done = PIECES.filter(p => filled(focus, p.key)).length
  const share = (key: (typeof PIECES)[number]['key']) => total ? investigations.filter(inv => filled(inv, key)).length / total : 0
  const env = ENVS.find(e => e.id === envId) ?? ENVS[0]

  function start() {
    const id = ws.createInvestigation({ title: 'Untitled investigation', question: '', mode })
    if (id) navigate(mode === 'sandbox' ? `/simulator?env=${env.id}` : `/workspace?id=${id}`)
  }

  return (
    <div className="course-today">
      {(ws.actionError || importNote || ws.message) && <p className="course-notice" role="status">{ws.actionError || importNote || ws.message}</p>}
      <header className="course-card">
        <p className="eyebrow">Today</p>
        <h1 className="course-title">{step ? step.title : 'Start with one question'}</h1>
        <div className="engzy-bar" aria-label="Checklist pieces on the latest investigation"><i style={{ width: `${(done / 4) * 100}%` }} /></div>
        <p className="course-lede">{step ? step.detail : 'No investigations are saved in this browser yet. Write the condition you want to study, then save a scenario.'}</p>
        <p className="small muted">{done} of 4 pieces on {focus ? `"${focus.title}"` : 'a new investigation'}. Guest id {ws.doc.owner.id.slice(0, 8)}. Stored in this browser only. <Link to="/how-it-works">How it works</Link></p>
        <div className="engzy-switch" role="radiogroup" aria-label="How to start">
          <button type="button" role="radio" aria-checked={mode === 'guided'} className={'course-choice' + (mode === 'guided' ? ' is-on' : '')} onClick={() => setMode('guided')}><strong>Guided</strong><span>Question, then conditions, evidence, comparison, and notes.</span></button>
          <button type="button" role="radio" aria-checked={mode === 'sandbox'} className={'course-choice' + (mode === 'sandbox' ? ' is-on' : '')} onClick={() => setMode('sandbox')}><strong>Sandbox</strong><span>Set the controls first, then save a scenario.</span></button>
        </div>
        <div className="hp-hero__actions">
          <button type="button" className="btn btn--solid" onClick={start}>{mode === 'guided' ? 'Start an investigation' : 'Open the sandbox'}</button>
          {focus && <Link to={`/workspace?id=${focus.id}`} className="btn btn--ghost">Continue "{focus.title}"</Link>}
        </div>
      </header>

      <section className="perf" aria-label="What saved investigations contain">
        {PIECES.map(({ key, label, Icon }) => (
          <article key={key} className="perf__card">
            <header><span className="perf__icon"><Icon size={18} /></span><h3>{label}</h3></header>
            <p className={'perf__band' + (total === 0 ? ' is-empty' : '')}>{total === 0 ? 'None saved' : `${Math.round(share(key) * 100)}%`}</p>
            <div className="perf__meter" aria-hidden="true"><span style={{ width: `${share(key) * 100}%` }} /></div>
            <p className="perf__note">{total === 0 ? 'Counts appear after the first save.' : `${investigations.filter(inv => filled(inv, key)).length} of ${total}. Not a model score.`}</p>
          </article>
        ))}
      </section>

      <section className="course-card">
        <p className="eyebrow">Gravity preset</p>
        <div className="engzy-switch" role="radiogroup" aria-label="Gravity presets">
          {ENVS.map(item => (
            <button key={item.id} type="button" role="radio" aria-checked={item.id === env.id} className={'course-choice' + (item.id === env.id ? ' is-on' : '')} onClick={() => setEnvId(item.id)}><strong>{item.label}</strong><span>Opens the sandbox at this gravity.</span></button>
          ))}
        </div>
        <p className="small muted">A preset selects gravity. It is not evidence that a habitat was tested there. Loaded rows name their own facilities.</p>
      </section>

      <section className="path-stage">
        {PIECES.map((piece, index) => (
          <section key={piece.key} className="path-unit">
            <header className="path-unit__bar">
              <h2>{index + 1}. {piece.label}</h2>
              <p>{filled(focus, piece.key) ? 'Present on the latest investigation' : 'Not on the latest investigation yet'}</p>
            </header>
          </section>
        ))}
      </section>

      <section className="course-card" id="saved">
        <div className="lesson-topline">
          <h2>Saved in this browser</h2>
          <label className="zap-search"><span className="sr-only">Search saved investigations</span><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search investigations" /></label>
        </div>
        <div className="hp-hero__actions">
          <button type="button" className="btn btn--ghost" onClick={() => download(`ignite-workspace-${ws.doc.owner.id.slice(0, 8)}.json`, ws.exportFull())}>Backup</button>
          <button type="button" className="btn btn--ghost" onClick={() => file.current?.click()}>Import</button>
          <input ref={file} className="sr-only" type="file" accept="application/json,.json" aria-label="Import workspace JSON" onChange={async e => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            const error = ws.importText(await f.text())
            setImportNote(error || 'Import finished. Anything skipped is named in the notice above.')
          }} />
        </div>
        {shown.length === 0 && <p className="small muted">{query ? 'No saved investigation matches that search.' : 'None yet. A new investigation starts empty. Conditions are stored only after you save a scenario.'}</p>}
        <div className="zap-list">
          {shown.map(inv => {
            const n = investigationNext(inv)
            const scenario = inv.scenarios.find(s => s.id === inv.activeScenarioId) ?? inv.scenarios[inv.scenarios.length - 1]
            return (
              <article key={inv.id}>
                <div>
                  <h3>{inv.title}</h3>
                  <p>{inv.question || 'No question yet.'}</p>
                  <p className="small muted">{scenario ? `${scenario.conditions.envId} · ${scenario.conditions.oxygen_pct}% O2 · ${scenario.conditions.material}` : 'No scenario saved'}. Next: {n.title}</p>
                </div>
                <div className="zap-row">
                  <Link to={`/workspace?id=${inv.id}`}>Open</Link>
                  {pendingDelete === inv.id
                    ? <button type="button" onClick={() => { ws.deleteInvestigation(inv.id); setPendingDelete(null) }}>Confirm delete</button>
                    : <button type="button" onClick={() => setPendingDelete(inv.id)}>Delete</button>}
                </div>
              </article>
            )
          })}
        </div>
        <div className="perf">
          {CATALOGS.map(c => (
            <article key={c.id} className="perf__card">
              <h3>{c.title}</h3>
              <p className="perf__note"><b>{c.state === 'loaded' ? 'Loaded' : 'Not loaded'}.</b> {c.detail}</p>
            </article>
          ))}
        </div>
        <h2>Recent activity</h2>
        {activity.length === 0 && <p className="small muted">Activity appears when you create an investigation, save a scenario, compare materials, or update notes.</p>}
        <ul className="zap-activity">
          {activity.map(item => {
            const inv = ws.doc.investigations.find(i => i.id === item.investigationId)
            return <li key={item.id}><b>{inv ? inv.title : 'Investigation'}</b>. {item.summary}. <time dateTime={item.at}>{item.at.replace('T', ' ').slice(0, 16)}</time></li>
          })}
        </ul>
      </section>
    </div>
  )
}
