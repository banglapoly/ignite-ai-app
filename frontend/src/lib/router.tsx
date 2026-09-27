import { useEffect, useState } from 'react'

/** Minimal client-side router. Every page path is also a real server route (with its own
 *  prerendered text), so deep links and refreshes work. */
export const PAGES = [
  { path: '/', label: 'Home', title: 'IGNITE-AI · Predictive Fire Safety Analytics for Space Station Orbit & Rocket Transit' },
  { path: '/simulator', label: '3D Simulator', title: 'IGNITE-AI · 3D Flame Simulator' },
  { path: '/predict', label: 'Prediction', title: 'IGNITE-AI · Prediction & Experiments' },
  { path: '/ask', label: 'Ask IGNITE-AI', title: 'IGNITE-AI · Ask IGNITE-AI' },
  { path: '/safety', label: 'Safety', title: 'IGNITE-AI · Fire Safety Measures' },
  { path: '/data', label: 'Data & Model', title: 'IGNITE-AI · Data & Model' },
  { path: '/sources', label: 'Sources', title: 'IGNITE-AI · Sources & Citations' },
]
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
export function Link({ to, className, children, onClick, ...rest }: { to: string; className?: string; children: React.ReactNode; onClick?: () => void } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'onClick'>) {
  return <a href={to} className={className} {...rest} onClick={e => { onClick?.(); if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); navigate(to) }}>{children}</a>
}
