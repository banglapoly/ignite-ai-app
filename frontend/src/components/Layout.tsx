import { useEffect, useRef, useState } from 'react'
import { FLOW, Link, PAGES, navigate } from '../lib/router'
import { isStaticMode, onModeChange } from '../lib/api'
import { useWorkspace } from '../lib/workspace/WorkspaceContext'
import { applyTheme, readChoice, saveChoice, type ThemeChoice } from '../lib/theme'

type Item = { href: string; label: string }
type Entry = Item | { label: string; id: string; items: Item[] }

const ENTRIES: Entry[] = [
  { href: '/dashboard', label: 'Today' },
  { href: '/simulator', label: 'Conditions' },
  { label: 'Evidence', id: 'evidence', items: [
    { href: '/predict', label: 'Nearest tests' },
    { href: '/ask', label: 'Ask the record' },
  ] },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/learn', label: 'Learn' },
  { label: 'Record', id: 'record', items: [
    { href: '/sources', label: 'Sources' },
    { href: '/data', label: 'Model' },
    { href: '/safety', label: 'Safety notes' },
  ] },
]

function active(path: string, href: string) {
  if (href === '/dashboard') return path === '/dashboard' || path === '/workspace'
  return path === href
}

export function Nav({ path }: { path: string }) {
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState<string | null>(null)
  const navRef = useRef<HTMLElement | null>(null)
  const ws = useWorkspace()
  useEffect(() => { setOpen(false); setMenu(null) }, [path])
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => { if (navRef.current && !navRef.current.contains(e.target as Node)) setMenu(null) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menu])
  const close = () => { setOpen(false); setMenu(null) }
  function start() {
    const id = ws.createInvestigation({ title: 'Untitled investigation', question: '', mode: 'guided' })
    close()
    if (id) navigate(`/workspace?id=${id}`)
  }
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="brand" onClick={close}><img src="/logo.svg" className="brand-logo" alt="" width={28} height={28} /><span className="brand__text">IGNITE-AI</span></Link>
        <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="primary-nav" onClick={() => setOpen(v => !v)}>{open ? 'Close' : 'Menu'}</button>
        <nav ref={navRef} id="primary-nav" className={open ? 'is-open' : ''} aria-label="Primary">
          {ENTRIES.map(entry => {
            if ('href' in entry) {
              const on = active(path, entry.href)
              return <Link key={entry.href} to={entry.href} aria-current={on ? 'page' : undefined} onClick={close}>{entry.label}</Link>
            }
            const expanded = menu === entry.id
            const on = entry.items.some(item => active(path, item.href))
            return (
              <div key={entry.id} className={'nav-menu' + (expanded ? ' is-open' : '')}>
                <button type="button" className={'nav-menu__trigger' + (on ? ' is-active' : '')} aria-expanded={expanded} aria-controls={`nav-menu-${entry.id}`} onClick={() => setMenu(expanded ? null : entry.id)}>
                  {entry.label}<span className="nav-menu__caret" aria-hidden="true">{expanded ? '\u2212' : '+'}</span>
                </button>
                <div id={`nav-menu-${entry.id}`} className="nav-menu__panel" hidden={!expanded}>
                  {entry.items.map(item => <Link key={item.href} to={item.href} aria-current={active(path, item.href) ? 'page' : undefined} onClick={close}>{item.label}</Link>)}
                </div>
              </div>
            )
          })}
        </nav>
        <div className="header-actions">
          <ThemeSwitch />
          <span className="user-chip" title="Guest on this browser. Not an account and not synced.">{ws.persistence === 'saved' ? 'Guest' : ws.persistence === 'held' ? 'Guest, save held' : 'Guest, not saved'}</span>
          <button type="button" className="btn btn--solid" onClick={start}>New investigation</button>
        </div>
      </div>
    </header>
  )
}

function ThemeSwitch() {
  const [choice, setChoice] = useState<ThemeChoice>(() => readChoice())
  useEffect(() => {
    applyTheme(choice)
    if (choice !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme('system')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [choice])
  const pick = (next: ThemeChoice) => setChoice(saveChoice(next))
  return (
    <div className="theme-switch" role="group" aria-label="Colour theme">
      {(['light', 'dark', 'system'] as const).map(id => (
        <button key={id} type="button" aria-pressed={choice === id} onClick={() => pick(id)}>{id === 'light' ? 'Light' : id === 'dark' ? 'Dark' : 'System'}</button>
      ))}
    </div>
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
