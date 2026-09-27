export type Outcome = 'no_spread' | 'marginal_spread' | 'spread'
export const OUTCOMES: Outcome[] = ['no_spread', 'marginal_spread', 'spread']
export const OUTCOME_LABEL: Record<Outcome, string> = {
  no_spread: 'No spread',
  marginal_spread: 'Marginal spread',
  spread: 'Sustained spread',
}
export const OUTCOME_COLOR: Record<Outcome, string> = {
  no_spread: '#4cc9f0',
  marginal_spread: '#f9c74f',
  spread: '#ff5d3a',
}

export interface Experiment {
  row_id: string
  oxygen_pct: number
  pressure_kpa: number
  flow_cm_s: number
  flow_direction: string
  material: string
  material_detail: string
  geometry?: string
  facility: string
  outcome: Outcome
  outcome_detail: string
  report_id: string
  source_url: string
  source_title: string
  source_location: string
  quote: string
  notes?: string
  extra_sources?: string
  distance?: number
  gravity_g?: number
}

export interface MaterialEnv {
  oxygen_pct: [number, number]
  pressure_kpa: [number, number]
  flow_cm_s: [number, number]
  flow_directions: string[]
  n: number
  outcomes: Record<string, number>
}

export interface ModelCard {
  model: { type: string; estimator: string; features: string[]; classes: string[]; n_train: number; n_sources: number; cv_accuracy: number; sklearn_version: string; n_by_gravity?: Record<string, number>; oof_accuracy_by_gravity?: Record<string, { n: number; accuracy: number }> }
  metrics: {
    cv_scheme: string
    cv_accuracy: number
    cv_balanced_accuracy: number
    repeated_cv_accuracy_mean: number
    repeated_cv_accuracy_std: number
    repeated_cv_scheme: string
    leave_reports_out_accuracy: number
    leave_reports_out_scheme: string
    majority_baseline_accuracy: number
    confusion_matrix: { labels: Outcome[]; matrix: number[][]; note: string }
    per_class: Record<string, Record<string, number>>
    oof_accuracy_by_gravity: Record<string, { n: number; accuracy: number }>
  }
  class_counts: Record<string, number>
  training_range: { global: Record<string, [number, number]>; gravity_levels: string[]; materials: Record<string, MaterialEnv & { by_gravity: Record<string, MaterialEnv> }> }
  trained_at: string
}

export interface Prediction {
  inputs: { oxygen_pct: number; pressure_kpa: number; flow_cm_s: number; material: string; flow_direction: string; gravity_g: number; gas_mix: string }
  in_training_range: boolean
  prediction: Outcome | null
  probabilities: Record<Outcome, number> | null
  model: ModelCard['model']
  range_violations?: string[]
  nearest_experiments: Experiment[]
  supporting_experiment?: Experiment | null
  contrast_experiment?: Experiment | null
  uncertainty?: { max_probability: number; margin_to_second: number; nearest_distance: number; neighbours_agreeing: number; level: string; note: string } | null
  related_reports: { report_id: string; title: string; date: string; source_url: string; score: number; abstract_snippet: string }[]
  cited_abstracts: { ntrs_id: string; title: string; abstract: string }[]
  explanation: { source: string; text: string }
}

export interface Fact { label: string; value: string; kind: 'sourced' | 'estimate' | 'definition'; quote: string; note: string; source: { label: string; url: string } | null }
export interface Inputs { oxygen_pct: number; pressure_kpa: number; flow_cm_s: number; material: string; flow_direction: string }
export interface EnvData {
  id: 'earth' | 'moon' | 'mars' | 'iss' | 'transit'; name: string; short: string; gravity_g: number; tagline: string; facts: Fact[]; data_note: string; default: Inputs
  dataset: { n: number; outcomes: Record<string, number>; reports: string[]; materials: Record<string, MaterialEnv>; oof_accuracy: { n: number; accuracy: number } | null }
}
export interface GasMix { id: string; label: string; modelled: boolean; note: string; source?: { label: string; url: string } }
export interface SafetySection { id: string; title: string; icon: string; applies: string[]; items: Fact[] }
export interface AskAnswer {
  question: string; answered: boolean; answer: string; mode: string; generator: string; top_score?: number; coverage?: number
  bullets?: { text: string; n: number; verbatim: boolean }[]
  citations: { n: number; label: string; url: string; kind: string; score: number }[]
  comparison?: { name: string; title: string; platform: string; hardware: string; dates: string; area: string; objective: string; tables: string[]; n_publications: number | null; url: string }[] | null
  passages: { n: number | null; title: string; text: string; url: string; source: string; kind: string; score: number }[]
}
export interface PsiInfo {
  investigations: { acronym: string; psi: string; title: string; url: string; platform: string; hardware: string; start: string; end: string; objective: string; doi: string; license: string; n_files: number; file_types: Record<string, number>; n_publications: number; tables: string[] }[]
  links: { label: string; url: string }[]
  tables: { psi: string; acronym: string; file_name: string; n_rows: number; columns: string[]; url: string }[]
  sources: Record<string, { label: string; url: string }>
}
export interface FlexSummary {
  available: boolean; source: { label: string; url: string }; n_tests: number; fuels: Record<string, number>; test_end_counts: Record<string, number>
  n_with_co2: number; co2_max_mole_fraction: number; n_with_helium: number; o2_range: [number, number]; pressure_kpa_range: [number, number]
  by_co2: { fuel: string; co2_bin: string; n: number; mean_extinction_diameter_mm: number; mean_burn_time_s: number; extinctions: number }[]
  notes: string[]
}
export async function postJSON<T>(path: string, body: object): Promise<T> {
  const r = await apiFetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${r.status} ${path}`)
  return r.json()
}

export interface Boundary {
  x: string; y: string; third: string; third_value: number
  xs: number[]; ys: number[]; z: (Outcome | null)[][]; confidence: number[][]
  points: Experiment[]
  envelope: MaterialEnv
}

const BASE = '/api'

/* When the site is hosted statically (Netlify) the API runs on a free Render instance that
   sleeps when idle and takes up to about a minute to wake. apiFetch retries gateway errors
   and network failures with backoff, and reports "waking" so the UI can say what's happening. */
type WakeListener = (waking: boolean) => void
const wakeListeners = new Set<WakeListener>()
let slowCount = 0
function setSlow(delta: number) {
  const before = slowCount > 0
  slowCount = Math.max(0, slowCount + delta)
  if (before !== slowCount > 0) wakeListeners.forEach(f => f(slowCount > 0))
}
export function onBackendWaking(f: WakeListener) { wakeListeners.add(f); return () => { wakeListeners.delete(f) } }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const delays = [2000, 4000, 8000, 12000, 16000]
  let slow = false
  const timer = setTimeout(() => { slow = true; setSlow(1) }, 4000)
  try {
    for (let i = 0; ; i++) {
      try {
        const r = await fetch(url, init)
        if (![502, 503, 504].includes(r.status) || i >= delays.length) return r
      } catch (e) {
        if (i >= delays.length) throw e
      }
      if (!slow) { slow = true; setSlow(1) }
      await sleep(delays[i])
    }
  } finally {
    clearTimeout(timer)
    if (slow) setSlow(-1)
  }
}

export async function getJSON<T>(path: string): Promise<T> {
  const r = await apiFetch(BASE + path)
  if (!r.ok) throw new Error(`${r.status} ${path}`)
  return r.json()
}
export async function postPredict(body: object): Promise<Prediction> {
  const r = await apiFetch(BASE + '/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${r.status} predict`)
  return r.json()
}

export const MATERIAL_LABEL: Record<string, string> = {
  SIBAL_fabric: 'SIBAL cotton-fiberglass fabric',
  cellulose_thin: 'Thin cellulose (Kimwipes, 0.0076 cm)',
  cellulose_double: 'Thin cellulose, double (0.0152 cm)',
  filter_paper: 'Ashless filter paper (SSCE)',
  PMMA_thick: 'Thick PMMA (acrylic) slab',
  cotton_jersey: 'Cotton jersey fabric',
  'Nomex_HT90-40': 'Nomex HT90-40 fabric',
  Ultem_1000: 'Ultem 1000 film',
  Mylar_G: 'Mylar G film',
  silicone: 'Silicone sheet',
}
export const GRAVITY_LABEL: Record<string, string> = { '0': 'µg (~0 g)', '0.165': 'Moon 0.165 g', '0.38': 'Mars 0.38 g', '1': 'Earth 1 g' }
export const gkey = (g: number) => String(+g.toFixed(3))
export const DIRECTION_LABEL: Record<string, string> = {
  concurrent: 'Concurrent (flow with the flame)',
  opposed: 'Opposed (flow against the flame)',
  quiescent: 'Quiescent (no flow)',
}
