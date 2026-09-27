import type { ModelCard } from '../lib/api'
import { ModelSection } from '../components/Sections'
import { NextLinks, PageHead } from '../components/Layout'

export default function DataPage({ card }: { card: ModelCard | null }) {
  return (
    <>
      <PageHead kicker="Data & model" title="The dataset and the honest model card">
        {card ? <>{card.model.n_train} real flame-spread experiments from {card.model.n_sources} NASA reports, each with its verbatim quote and page reference. Cross-validated accuracy {(card.metrics.cv_accuracy * 100).toFixed(1)}% against a {(card.metrics.majority_baseline_accuracy * 100).toFixed(1)}% majority-class baseline, broken down by gravity level.</> : 'Loading…'}
      </PageHead>
      <ModelSection card={card} />
      <NextLinks path="/data" />
    </>
  )
}
