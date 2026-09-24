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
  model: { type: string; estimator: string; features: string[]; classes: string[]; n_train: number; n_sources: number; cv_accuracy: number; sklearn_version: string }
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
  }
  class_counts: Record<string, number>
  training_range: { global: Record<string, [number, number]>; materials: Record<string, MaterialEnv> }
  trained_at: string
}

export interface Prediction {
  inputs: { oxygen_pct: number; pressure_kpa: number; flow_cm_s: number; material: string; flow_direction: string }
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

export interface Boundary {
  x: string; y: string; third: string; third_value: number
  xs: number[]; ys: number[]; z: (Outcome | null)[][]; confidence: number[][]
  points: Experiment[]
  envelope: MaterialEnv
}

const BASE = '/api'
export async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path)
  if (!r.ok) throw new Error(`${r.status} ${path}`)
  return r.json()
}
export async function postPredict(body: object): Promise<Prediction> {
  const r = await fetch(BASE + '/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
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
export const DIRECTION_LABEL: Record<string, string> = {
  concurrent: 'Concurrent (flow with the flame)',
  opposed: 'Opposed (flow against the flame)',
  quiescent: 'Quiescent (no flow)',
}
