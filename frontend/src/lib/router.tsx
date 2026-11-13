import { useEffect, useState } from 'react'

/** Minimal client-side router. Every page path is also a real server route (with its own
 *  prerendered text), so deep links and refreshes work. */
export const PAGES = [
  { path: '/', label: 'Home', title: 'IGNITE-AI · Combustion investigation workspace' },
  { path: '/dashboard', label: 'Dashboard', title: 'IGNITE-AI · Investigation dashboard' },
  { path: '/simulator', label: 'Sandbox', title: 'IGNITE-AI · Condition sandbox' },
  { path: '/workspace', label: 'Investigation', title: 'IGNITE-AI · Investigation' },
  { path: '/how-it-works', label: 'How it works', title: 'IGNITE-AI · How it works' },
  { path: '/learn', label: 'Learn', title: 'IGNITE-AI · Learn' },
  { path: '/predict', label: 'Evidence', title: 'IGNITE-AI · Evidence and model estimate' },
  { path: '/ask', label: 'Ask', title: 'IGNITE-AI · Ask the knowledge base' },
  { path: '/safety', label: 'Safety notes', title: 'IGNITE-AI · Safety notes' },
  { path: '/data', label: 'Model', title: 'IGNITE-AI · Model and loaded data' },
  { path: '/sources', label: 'Sources', title: 'IGNITE-AI · Sources and citations' },
]
/** Primary navigation. Evidence, Ask, and Safety notes stay reachable from Learn, the footer, and the workspace. */
export const NAV = ['/', '/dashboard', '/simulator', '/learn', '/sources', '/data'].map(path => PAGES.find(p => p.path === path)!)
export const FLOW = ['/', '/how-it-works', '/dashboard', '/simulator', '/predict', '/learn', '/safety', '/ask', '/data', '/sources']
export function normPath(p: string) { const x = p.replace(/\/+$/, '') || '/'; return x === '/demo' ? '/simulator' : x }
export function navigate(to: string) {
  history.pushState(null, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}
export function usePath() {
  const [path, setPath] = useState(normPath(location.pathname))
  useEffect(() => { const f = () => setPath(normPath(location.pathname)); window.addEventListener('popstate', f); return () => window.removeEventListener('popstate', f) }, [])
  return path
}
export function useQuery() {
  const [search, setSearch] = useState(location.search)
  useEffect(() => { const f = () => setSearch(location.search); window.addEventListener('popstate', f); return () => window.removeEventListener('popstate', f) }, [])
  return new URLSearchParams(search)
}
export function Link({ to, className, children, onClick, ...rest }: { to: string; className?: string; children: React.ReactNode; onClick?: () => void } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'onClick'>) {
  return <a href={to} className={className} {...rest} onClick={e => { onClick?.(); if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); navigate(to) }}>{children}</a>
}
