import { useState } from 'react'
import type { AskAnswer } from '../lib/api'
import { postJSON } from '../lib/api'

const SUGGEST = [
  'How do flames look in microgravity?',
  'Is lunar gravity more flammable than Earth?',
  'What does the crew do when a fire alarm goes off on the ISS?',
  'Compare FLEX and BASS-II',
  'What did FLEX find about CO2?',
  'Which fire extinguishers are used on the ISS?',
]

function linkify(text: string, cites: AskAnswer['citations']) {
  const parts = text.split(/(\[\d+\])/g)
  return parts.map((p, i) => {
    const m = p.match(/^\[(\d+)\]$/)
    if (!m) return <span key={i}>{p}</span>
    const c = cites.find(x => x.n === +m[1])
    return c ? <a key={i} className="cnum" href={c.url} target="_blank" rel="noreferrer" title={c.label}>[{m[1]}]</a> : <span key={i}>{p}</span>
  })
}

export default function AskPanel({ envName }: { envName: string }) {
  const [q, setQ] = useState('')
  const [a, setA] = useState<AskAnswer | null>(null)
  const [busy, setBusy] = useState(false)
  const [showP, setShowP] = useState(false)
  const ask = (question: string) => {
    if (!question.trim()) return
    setQ(question); setBusy(true); setShowP(false)
    postJSON<AskAnswer>('/ask', { question }).then(setA).catch(e => setA({ question, answered: false, answer: `API error: ${e}`, mode: '', generator: '', citations: [], passages: [] })).finally(() => setBusy(false))
  }
  return (
    <div className="panel ask" id="ask">
      <h3>Ask IGNITE-AI <span className="tag">local retrieval · verbatim NASA quotes · no paid API</span></h3>
      <p className="small muted">Questions are answered only from the IGNITE-AI knowledge base: NTRS report abstracts, NASA PSI investigation metadata and experimental tables, the curated experiment rows, and NASA mission pages. Every sentence links to its source; if nothing relevant is retrieved, the assistant says so.</p>
      <form onSubmit={e => { e.preventDefault(); ask(q) }} className="ask-form">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={`e.g. How is fire different on the ${envName}?`} maxLength={500} aria-label="Question" />
        <button className="btn" disabled={busy}>{busy ? 'Searching…' : 'Ask'}</button>
      </form>
      <div className="chips">{SUGGEST.map(s => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div>
      {a && (
        <div className={`answer ${a.answered ? '' : 'declined'}`}>
          {!a.answered ? <p>🛈 {a.answer}</p> : (
            <>
              <div className="answer-head">From the retrieved NASA sources <span className="tag">{a.generator}</span></div>
              <ul className="bullets">
                {(a.bullets || []).map((b, i) => (
                  <li key={i}>{b.verbatim ? <q>{b.text}</q> : <span><b className="datatag">DATA</b> {b.text}</span>} {linkify(`[${b.n}]`, a.citations)}</li>
                ))}
              </ul>
              {a.generator.startsWith('ollama') && <pre className="gen">{linkify(a.answer, a.citations)}</pre>}
              {a.comparison && a.comparison.length >= 2 && (
                <div className="dt-scroll"><table className="cmp"><thead><tr><th></th>{a.comparison.map(c => <th key={c.name}><a href={c.url} target="_blank" rel="noreferrer">{c.name}</a></th>)}</tr></thead>
                  <tbody>
                    <tr><td>Title</td>{a.comparison.map(c => <td key={c.name}>{c.title}</td>)}</tr>
                    <tr><td>Platform</td>{a.comparison.map(c => <td key={c.name}>{c.platform || '—'}</td>)}</tr>
                    <tr><td>Hardware</td>{a.comparison.map(c => <td key={c.name}>{c.hardware || '—'}</td>)}</tr>
                    <tr><td>Dates (PSI)</td>{a.comparison.map(c => <td key={c.name}>{c.dates || '—'}</td>)}</tr>
                    <tr><td>Objective (verbatim, first sentence)</td>{a.comparison.map(c => <td key={c.name}><q>{c.objective}</q></td>)}</tr>
                    <tr><td>PSI experimental tables</td>{a.comparison.map(c => <td key={c.name}>{c.tables.length ? c.tables.join('; ') : '—'}</td>)}</tr>
                    <tr><td>Publications listed</td>{a.comparison.map(c => <td key={c.name}>{c.n_publications ?? '—'}</td>)}</tr>
                  </tbody></table></div>
              )}
              <ol className="cites-list">{a.citations.map(c => <li key={c.n} value={c.n}><a href={c.url} target="_blank" rel="noreferrer">{c.label}</a> <span className="muted small">({c.kind}, score {c.score})</span></li>)}</ol>
              <button className="btn ghost small" onClick={() => setShowP(s => !s)}>{showP ? 'Hide' : 'Show'} retrieved passages ({a.passages.length})</button>
              {showP && <div className="passages">{a.passages.map((p, i) => <div key={i} className="passage"><b>{p.n ? `[${p.n}] ` : ''}{p.source}</b> <span className="muted small">score {p.score}</span><div className="small">{p.text}</div></div>)}</div>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
