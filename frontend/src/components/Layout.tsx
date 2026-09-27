import { useEffect, useState } from 'react'
import { Link, PAGES } from '../lib/router'
import { isStaticMode, onModeChange } from '../lib/api'

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
        {PAGES.map(p => (
          <Link key={p.path} to={p.path} className={'navlink' + (p.path === path ? ' active' : '')} aria-current={p.path === path ? 'page' : undefined}>{p.label}</Link>
        ))}
      </nav>
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
      <nav className="foot-links">{PAGES.map(p => <Link key={p.path} to={p.path}>{p.label}</Link>)}</nav>
      <span>Data: NASA PSI (psi.nasa.gov) and NASA Technical Reports Server. NASA does not endorse this project. <a href="/llms.txt">llms.txt</a> · <a href="/static-api/experiments.csv">experiments.csv</a>{!st && <> · <a href="/docs">API</a></>}</span>
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
export function NextLinks({ path }: { path: string }) {
  const i = PAGES.findIndex(p => p.path === path)
  const prev = PAGES[i - 1], next = PAGES[i + 1]
  return (
    <div className="nextlinks section wide">
      {prev ? <Link to={prev.path} className="btn ghost">← {prev.label}</Link> : <span />}
      {next && <Link to={next.path} className="btn">{next.label} →</Link>}
    </div>
  )
}
