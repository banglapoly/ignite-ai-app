import type { ModelCard } from '../lib/api'
import { Disclosure, Resources } from '../components/Sections'
import { NextLinks, PageHead } from '../components/Layout'

export default function SourcesPage({ card }: { card: ModelCard | null }) {
  return (
    <>
      <PageHead kicker="Sources & citations" title="Where every number comes from">
        NASA Physical Sciences Informatics (PSI) investigations, the NTRS reports behind the training rows, the environment and safety sources, the FLEX CO₂ data, and how AI was (and was not) used.
      </PageHead>
      <Resources card={card} />
      <Disclosure />
      <NextLinks path="/sources" />
    </>
  )
}
