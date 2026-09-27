import AskPanel from '../components/AskPanel'
import { NextLinks, PageHead } from '../components/Layout'
import { useSim } from '../lib/sim'

export default function AskPage() {
  const { env } = useSim()
  return (
    <>
      <PageHead kicker="Ask IGNITE-AI" title="Ask the NASA combustion knowledge base">
        A local question-answering assistant over NASA report abstracts (NTRS), NASA PSI investigation metadata and experimental tables, the 144 experiment rows and NASA mission pages. Answers are <b>verbatim quotes with links</b> to the source. Nothing is sent to a cloud service, and the assistant <b>declines</b> when nothing relevant is retrieved.
      </PageHead>
      <section className="section wide page-body"><AskPanel envName={env?.name || 'ISS'} /></section>
      <section className="section wide how-rag">
        <div className="cards three">
          <article className="card"><h3>1 · Retrieve</h3><p>TF-IDF (1–2-word terms) over about 1,500 passages, with a small fixed synonym list (for example Moon ↔ lunar) and at most three passages per source.</p></article>
          <article className="card"><h3>2 · Quote</h3><p>The best-matching sentences are shown word for word, each with a numbered link. Lines built from real table rows are marked <b>DATA</b>. Naming two investigations gives a side-by-side table from PSI metadata.</p></article>
          <article className="card"><h3>3 · Or decline</h3><p>If the best match is weak, the question has no fire or space term, or its key words are missing from the passages, it says it can't answer. Optional local Ollama generation is off by default.</p></article>
        </div>
      </section>
      <NextLinks path="/ask" />
    </>
  )
}
