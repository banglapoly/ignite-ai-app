import { isClose, staticJSON } from './offline/data'
import { localBoundary, localPredict } from './offline/predict'

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
export interface Boundary {
  x: string; y: string; third: string; third_value: number
  xs: number[]; ys: number[]; z: (Outcome | null)[][]; confidence: number[][]
  points: Experiment[]
  envelope: MaterialEnv
}

/* ---------------------------------------------------------------------------------------------
   Data access. Works with the FastAPI backend (local start.bat, or a hosted API behind a proxy)
   AND on a static host with no backend at all (e.g. Netlify):
   * Snapshot data (model card, environments, experiments, safety, FLEX, PSI) is read from
     /static-api/*.json, exported from the same API code by backend/scripts/export_static.py.
   * Predictions, the decision map and Ask IGNITE-AI call the API; if there is no API (pages
     prerendered for static hosting say so with <meta name="ignite-api" content="off">, or the
     request fails) they run in the browser on the exported model and knowledge base.
   --------------------------------------------------------------------------------------------- */
const BASE = '/api'
type Mode = 'server' | 'static'
let mode: Mode = typeof document !== 'undefined' && document.querySelector('meta[name="ignite-api"]')?.getAttribute('content') === 'off' ? 'static' : 'server'
const modeListeners = new Set<(m: Mode) => void>()
export const isStaticMode = () => mode === 'static'
export function onModeChange(f: (m: Mode) => void) { modeListeners.add(f); return () => { modeListeners.delete(f) } }
function goStatic() { if (mode !== 'static') { mode = 'static'; modeListeners.forEach(f => f(mode)) } }

class HttpError extends Error { constructor(public status: number, msg: string) { super(msg) } }
async function server<T>(path: string, init?: RequestInit): Promise<T> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 12000)
  try {
    const r = await fetch(BASE + path, { ...init, signal: ctl.signal })
    if (!r.ok) throw new HttpError(r.status, `${r.status} ${path}`)
    return await r.json()
  } finally { clearTimeout(timer) }
}
/** Use the API when there is one; otherwise (or if it is unreachable) compute the same answer locally. */
async function withFallback<T>(call: () => Promise<T>, local: () => Promise<T>): Promise<T> {
  if (mode === 'static') return local()
  try {
    return await call()
  } catch (e) {
    if (e instanceof HttpError && (e.status === 400 || e.status === 422)) throw e   // a real API rejected the request
    goStatic()
    return local()
  }
}

const STATIC_GET: Record<string, (q: URLSearchParams) => Promise<any>> = {
  '/model': () => staticJSON('model'),
  '/environments': () => staticJSON('environments'),
  '/flex': () => staticJSON('flex'),
  '/psi': () => staticJSON('psi'),
  '/experiments': async q => {
    let rows = (await staticJSON<{ rows: Experiment[] }>('experiments')).rows
    const m = q.get('material'), g = q.get('gravity_g')
    if (m) rows = rows.filter(r => r.material === m)
    if (g !== null) rows = rows.filter(r => isClose(+(r.gravity_g ?? 0), +g))
    return { n: rows.length, rows }
  },
  '/safety': async q => {
    const secs = (await staticJSON<{ sections: SafetySection[] }>('safety')).sections
    const env = q.get('env')
    return { env, sections: env ? secs.filter(s => s.applies.includes(env)) : secs }
  },
}

export async function getJSON<T>(path: string): Promise<T> {
  const [p, qs = ''] = path.split('?')
  const q = new URLSearchParams(qs)
  if (STATIC_GET[p]) {
    try { return await STATIC_GET[p](q) } catch (e) { if (mode === 'static') throw e }   // no static copy: ask the API
    return server<T>(path)
  }
  if (p === '/boundary') return withFallback(() => server<T>(path), () => localBoundary(q) as Promise<T>)
  return server<T>(path)
}
const post = (body: object): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
export async function postJSON<T>(path: string, body: object): Promise<T> {
  if (path === '/ask') return withFallback(() => server<T>(path, post(body)),
    async () => (await import('./offline/ask')).localAsk((body as { question: string }).question) as Promise<T>)
  return server<T>(path, post(body))
}
export async function postPredict(body: object): Promise<Prediction> {
  return withFallback(() => server<Prediction>('/predict', post(body)), () => localPredict(body))
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
