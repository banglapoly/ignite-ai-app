import { OFFICIAL_RESOURCES } from '../data/psi24'

const GROUPS = ['Data', 'Guides', 'Fire history', 'Earth benefits']

export default function NasaSources({ compact = false }: { compact?: boolean }) {
  return (
    <div className="nasa-grid">
      {GROUPS.map(group => (
        <section key={group} className="nasa-group">
          <h3>{group}</h3>
          <ul className="refs">
            {OFFICIAL_RESOURCES.filter(item => item.group === group).map(item => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
                {item.primary && <span className="muted"> · primary data source</span>}
                {!compact && <div className="small muted">{item.note}</div>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
