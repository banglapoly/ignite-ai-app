import { useSim } from '../lib/sim'

export const TAB_ICON: Record<string, string> = { earth: '🌍', moon: '🌕', mars: '🔴', iss: '🛰️', transit: '🚀' }

export default function EnvTabs({ sticky = true }: { sticky?: boolean }) {
  const { envs, envId, setEnvId } = useSim()
  return (
    <nav className={'tabs' + (sticky ? '' : ' static')} role="tablist" aria-label="Environment">
      {envs.map(e => (
        <button key={e.id} role="tab" aria-selected={e.id === envId} className={e.id === envId ? 'on' : ''} onClick={() => setEnvId(e.id)}>
          <span className="tab-ico">{TAB_ICON[e.id]}</span><span className="tab-name">{e.short}</span><span className="tab-n">{e.dataset.n} tests</span>
        </button>
      ))}
    </nav>
  )
}
