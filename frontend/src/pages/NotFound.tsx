import { Link, PAGES } from '../lib/router'
import { PageHead } from '../components/Layout'

export default function NotFound() {
  return (
    <>
      <PageHead kicker="404" title="Page not found">That page doesn't exist. Try one of these:</PageHead>
      <section className="section narrow"><ul className="pagelist">{PAGES.map(p => <li key={p.path}><Link to={p.path}>{p.label}</Link></li>)}</ul></section>
    </>
  )
}
