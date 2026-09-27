import { useEffect, useState } from 'react'

/** Minimal client-side router: '/' and '/demo'. The server serves index.html for both. */
export function navigate(to: string) {
  history.pushState(null, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}
export function usePath() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => { const f = () => setPath(location.pathname); window.addEventListener('popstate', f); return () => window.removeEventListener('popstate', f) }, [])
  return path
}
export function Link({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  return <a href={to} className={className} onClick={e => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); navigate(to) }}>{children}</a>
}
