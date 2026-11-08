import type { ModelCard } from '../lib/api'
import { ModelSection } from '../components/Sections'
import { NextLinks, PageHead } from '../components/Layout'
import { CATALOGS } from '../lib/catalog'
import Disclaimer from '../components/Disclaimer'

export default function DataPage({ card }: { card: ModelCard | null }) {
  return (
    <>
      <PageHead kicker="Data & model" title="The dataset and the honest model card">
        {card ? <>{card.model.n_train} real flame-spread experiments from {card.model.n_sources} NASA reports, each with its verbatim quote and page reference. Cross-validated accuracy {(card.metrics.cv_accuracy * 100).toFixed(1)}% against a {(card.metrics.majority_baseline_accuracy * 100).toFixed(1)}% majority-class baseline, broken down by gravity level.</> : 'Loading…'}
      </PageHead>
      <section className="section wide page-body">
        <Disclaimer compact />
        <div className="cards two">
          {CATALOGS.map(c => <article key={c.id} className="card"><h3>{c.title}</h3><p className="small"><b>{c.state === 'loaded' ? 'Loaded in this build' : 'Not loaded'}</b></p><p>{c.detail}</p></article>)}
        </div>
      </section>
      <ModelSection card={card} />
      <NextLinks path="/data" />
    </>
  )
}
