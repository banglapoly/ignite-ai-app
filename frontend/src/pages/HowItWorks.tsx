import type { ModelCard } from '../lib/api'
import { Link } from '../lib/router'
import { PageHead } from '../components/Layout'

export default function HowItWorks({ card }: { card: ModelCard | null }) {
  const n = card?.model.n_train
  const reports = card?.model.n_sources
  const cv = card ? `${(card.metrics.cv_accuracy * 100).toFixed(1)}%` : null
  const base = card ? `${(card.metrics.majority_baseline_accuracy * 100).toFixed(1)}%` : null
  return (
    <>
      <PageHead kicker="How it works" title="A short guide to IGNITE-AI">
        IGNITE-AI is a place to investigate how flames behave when gravity is very small, and how that compares with normal gravity. It is a learning and research aid. It does not certify a material or clear a vehicle.
      </PageHead>
      <section className="section wide how-page">
        <ol className="how-steps">
          <li>
            <h2>1. Start a new investigation</h2>
            <p>Use <b>New investigation</b> in the top bar, or start from <Link to="/dashboard">Today</Link>. Give it a title and the question you want to answer.</p>
          </li>
          <li>
            <h2>2. Choose guided or sandbox</h2>
            <p>Guided walks through the question, the conditions, the evidence, a comparison, and notes. Sandbox opens the controls first so you can explore, then save a point.</p>
          </li>
          <li>
            <h2>3. Set the conditions</h2>
            <p>Each control is one input. The green band is the lowest and highest value tested for that input alone. It is not a box of combinations that were all tested together.</p>
            <ul>
              <li><b>Gravity.</b> Earth is 1 g. The Moon preset is 0.165 g. Mars is 0.38 g. The ISS and a coasting transit cabin are about 0 g. A preset is not proof of a habitat test.</li>
              <li><b>Oxygen.</b> Percent of the atmosphere, marked %.</li>
              <li><b>Cabin pressure.</b> Kilopascals, marked kPa.</li>
              <li><b>Ventilation.</b> Air speed at the sample, centimetres per second, marked cm/s.</li>
              <li><b>Flow direction.</b> Concurrent, opposed, or quiescent (no flow).</li>
              <li><b>Gas mix.</b> The model covers oxygen/nitrogen only. Other mixes are shown as not modelled.</li>
              <li><b>Material or surface.</b> The name of the sample in the loaded tests.</li>
            </ul>
          </li>
          <li>
            <h2>4. Read the result</h2>
            <p>If the point is inside the loaded tests, the model estimates spread, marginal spread, or no spread. The percentages are uncalibrated class shares. They are not a confidence score and not a risk score. If the point is outside the loaded tests, there is no estimate.</p>
          </li>
          <li>
            <h2>5. Compare materials</h2>
            <p>Keep oxygen, pressure, airflow, gravity, and gas mix the same, and swap the material. Each alternative is recomputed. A combination with no loaded tests stays visible as a limitation.</p>
          </li>
          <li>
            <h2>6. Look at the evidence</h2>
            <p>The nearest published experiments are ranked by a stated distance and linked to their reports. That list is the evidence. The 3D flame is only an illustration. It is not a measurement and not flame physics.</p>
          </li>
          <li>
            <h2>7. Save notes and the record</h2>
            <p>Notes stay in this browser. A full backup file includes them. A parameter link and a parameter file leave the notes out.</p>
          </li>
          <li>
            <h2>8. Come back on Today</h2>
            <p>Saved investigations, the next missing step, and recent activity are on the <Link to="/dashboard">Today</Link> page. Nothing is synced to another device.</p>
          </li>
          <li>
            <h2>9. Switch light or dark</h2>
            <p>The top bar has Light, Dark, and System. System follows this computer. The choice is saved in this browser and applied before the page paints.</p>
          </li>
        </ol>

        <section className="course-card">
          <h2>What the model is</h2>
          {card ? (
            <p>The classifier is trained on <b>{n}</b> flame-spread rows from <b>{reports}</b> NASA reports in this build. Stratified cross-validated accuracy is <b>{cv}</b>. A majority-class baseline on the same rows is <b>{base}</b>. Those figures are read from the model card shipped with this build.</p>
          ) : <p>The model card is still loading. The counts on this page are read from that card, not typed in by hand.</p>}
          <p>Use it to study the loaded record. Do not use it as a safety certification.</p>
          <p><Link to="/data">Open the model card</Link> · <Link to="/sources">Open the sources</Link></p>
        </section>

        <svg className="how-diagram" viewBox="0 0 720 88" role="img" aria-label="Flow from question to saved record">
          {['Question', 'Conditions', 'Estimate', 'Evidence', 'Save'].map((label, i) => (
            <g key={label} transform={`translate(${i * 144},0)`}>
              <rect x="4" y="16" width="120" height="48" fill="var(--surface)" stroke="var(--primary)" />
              <text x="64" y="46" textAnchor="middle" fill="var(--fg)" fontSize="14">{label}</text>
              {i < 4 && <path d="M128 40h12" stroke="var(--fg-soft)" fill="none" />}
            </g>
          ))}
        </svg>
      </section>
    </>
  )
}
