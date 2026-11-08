import { useEffect, useState } from 'react'
import { FLOW, Link, NAV, PAGES } from '../lib/router'
import { isStaticMode, onModeChange } from '../lib/api'
import { useWorkspace } from '../lib/workspace/WorkspaceContext'

export function Nav({ path }: { path: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [path])
  return (
    <header className="nav">
      <Link to="/" className="brand"><img src="/logo.svg" className="brand-logo" alt="" width={32} height={32} />IGNITE-AI</Link>
      <button className="nav-toggle" aria-label="Menu" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(o => !o)}>
        <span /><span /><span />
      </button>
      <nav id="site-nav" className={open ? 'open' : ''} aria-label="Pages">
        {NAV.map(p => {
          const on = p.path === path || (p.path === '/dashboard' && path === '/workspace')
          return <Link key={p.path} to={p.path} className={'navlink' + (on ? ' active' : '')} aria-current={on ? 'page' : undefined}>{p.label}</Link>
        })}
      </nav>
      <GuestPill />
    </header>
  )
}

function useStaticMode() {
  const [st, setSt] = useState(isStaticMode())
  useEffect(() => onModeChange(m => setSt(m === 'static')), [])
  return st
}

export function Footer() {
  const st = useStaticMode()
  return (
    <footer className="footer">
      <span><b>IGNITE-AI</b> · Apache-2.0 · runs locally, open-source only</span>
      <nav className="foot-links">{FLOW.map(path => { const p = PAGES.find(x => x.path === path)!; return <Link key={p.path} to={p.path}>{p.label}</Link> })}</nav>
      <span>Data: NASA PSI (psi.nasa.gov) and NASA Technical Reports Server. NASA does not endorse this project. Research and education aid, not a flight-safety certification. <a href="/llms.txt">llms.txt</a> · <a href="/static-api/experiments.csv">experiments.csv</a> · <a href="https://github.com/banglapoly/ignite-ai-app" target="_blank" rel="noreferrer">GitHub</a>{!st && <> · <a href="/docs">API</a></>}</span>
      {st && <span className="static-note">Static version: no server is running, so predictions, the decision map and Ask IGNITE-AI are computed in your browser from the same trained model and NASA sources.</span>}
    </footer>
  )
}

/** Page heading band used by every inner page, with a short "what this page is" line. */
export function PageHead({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="pagehead">
      <div className="pagehead-kicker">{kicker}</div>
      <h1>{title}</h1>
      {children && <div className="pagehead-sub">{children}</div>}
    </div>
  )
}

/** "Next page" links at the bottom of inner pages. */
function GuestPill() {
  const ws = useWorkspace()
  const label = ws.persistence === 'memory' ? 'Unsaved' : ws.persistence === 'held' ? 'Held' : 'Guest'
  return <span className="guest-pill" title="Guest on this browser. Not an account. Investigations stay in this browser until you export a backup.">{label}</span>
}

export function StorageBanner() {
  const ws = useWorkspace()
  if (!ws.ready) return null
  const loud = ws.persistence !== 'saved' || !!ws.message
  return (
    <div className={loud ? 'storage-banner warn' : 'storage-banner'} role={loud ? 'alert' : 'note'}>
      <p>{ws.message || 'Guest workspace on this browser. Not an account and not synced. Export a backup from the dashboard to keep it.'}</p>
      {ws.persistence === 'held' && <button className="btn small" onClick={ws.replaceUnreadable}>Replace unreadable data</button>}
    </div>
  )
}

export function NextLinks({ path }: { path: string }) {
  const flow = FLOW.map(p => PAGES.find(x => x.path === p)!)
  const i = flow.findIndex(p => p.path === path)
  const prev = flow[i - 1], next = flow[i + 1]
  return (
    <div className="nextlinks section wide">
      {prev ? <Link to={prev.path} className="btn ghost">← {prev.label}</Link> : <span />}
      {next && <Link to={next.path} className="btn">{next.label} →</Link>}
    </div>
  )
}
