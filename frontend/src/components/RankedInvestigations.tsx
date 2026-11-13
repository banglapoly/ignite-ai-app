import { useMemo, useState } from 'react'
import { PSI24, objectiveSummary, trainingNote, type PsiInvestigation } from '../data/psi24'
import { rankInvestigation, type RankQuery } from '../data/rankInvestigations'

type SortKey = 'relevance' | 'title' | 'accession'

function accessionNumber(id: string) {
  return Number(id.replace('PSI-', '')) || 0
}

export default function RankedInvestigations({ query }: { query: RankQuery }) {
  const [sort, setSort] = useState<SortKey>('relevance')
  const ranked = useMemo(() => PSI24.map(card => ({ card, hit: rankInvestigation(card, query) })), [query])
  const rows = [...ranked].sort((a, b) => {
    if (sort === 'title') return a.card.title.localeCompare(b.card.title)
    if (sort === 'accession') return accessionNumber(a.card.accession) - accessionNumber(b.card.accession)
    return b.hit.score - a.hit.score || a.card.title.localeCompare(b.card.title)
  })
  return (
    <div>
      <div className="rank-bar">
        <label htmlFor="psi-sort">Sort</label>
        <select id="psi-sort" value={sort} onChange={e => setSort(e.target.value as SortKey)}>
          <option value="relevance">Relevance to these conditions</option>
          <option value="title">Title</option>
          <option value="accession">Accession</option>
        </select>
        <span className="small muted">{rows.length} Combustion Science investigations</span>
      </div>
      <p className="small">
        Rank adds 2 points for a gravity, material, or flow word that appears in the title, acronym, objectives, keywords, platform, project type, sub-area, or hardware name. Oxygen adds 1 point when the record says oxygen or O2. The score is a word match. It is not a flammability score and not a model estimate. Most of these records mention microgravity, so that word rarely changes the order by itself. Moon and Mars presets look for partial gravity, lunar, or Martian in the same fields. None of these 24 records contain those words.
      </p>
      <div className="psi-list">
        {rows.map(({ card, hit }) => <Card key={card.accession} card={card} score={hit.score} matches={hit.matches} showScore={sort === 'relevance'} />)}
      </div>
    </div>
  )
}

function Card({ card, score, matches, showScore }: { card: PsiInvestigation; score: number; matches: string[]; showScore: boolean }) {
  const acronym = card.acronym || 'No acronym in the PSI record'
  return (
    <article className="psi-card">
      <h3>{acronym}</h3>
      <p>{card.title}</p>
      <p className="psi-meta">
        <span>{card.accession}</span>
        {showScore && <span>Rank {score}{matches.length ? `: ${matches.join(', ')}` : ': no condition words matched'}</span>}
      </p>
      {card.objectives && <p className="small">{objectiveSummary(card.objectives)}</p>}
      <p className="small"><b>Training rows: </b>{trainingNote(card.accession)}</p>
      <p className="small"><a href={card.url} target="_blank" rel="noopener noreferrer">PSI page for {card.accession}</a></p>
    </article>
  )
}
