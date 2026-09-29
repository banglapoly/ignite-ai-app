/* In-browser version of the backend's /api/predict and /api/boundary, used when no backend is
   reachable. It evaluates the SAME trained model (every tree of the gradient-boosting ensemble,
   exported to predictor.json) with the same range guard, nearest-experiment search, uncertainty
   rules and deterministic explanation as backend/src/compute/predict.py and explain.py. */
import type { Boundary, Experiment, ModelCard, Outcome, Prediction } from '../api'
import { MATERIAL_LABEL } from '../labels'
import { fmtG, isClose, round, staticJSON } from './data'

interface Tree { f: number[]; t: number[]; l: number[]; r: number[]; v: number[] }
interface Predictor {
  features: { numeric: string[]; categorical: Record<string, string[]> }
  classes: Outcome[]; learning_rate: number; init: number[]; trees: Tree[][]
  related: Record<string, [string, number][]>
  reports: Record<string, { title: string; date: string; source_url: string; abstract_snippet: string }>
  abstracts: Record<string, { title: string; abstract: string }>
}
type Row = Experiment & { gravity_g: number }
const CLASSES: Outcome[] = ['no_spread', 'marginal_spread', 'spread']
const NUMERIC = ['oxygen_pct', 'pressure_kpa', 'flow_cm_s'] as const
type Num = typeof NUMERIC[number]

async function load() {
  const [pm, card, ex] = await Promise.all([
    staticJSON<Predictor>('predictor'), staticJSON<ModelCard>('model'), staticJSON<{ rows: Row[] }>('experiments'),
  ])
  return { pm, card, rows: ex.rows }
}

/** predict_proba of the exported pipeline: one-hot encode, walk each tree (float32 inputs, like sklearn), softmax. */
function proba(pm: Predictor, r: Record<string, any>): number[] {
  const x: number[] = pm.features.numeric.map(c => Math.fround(+r[c]))
  for (const [c, vals] of Object.entries(pm.features.categorical)) for (const v of vals) x.push(r[c] === v ? 1 : 0)
  const raw = pm.init.slice()
  for (const stage of pm.trees) {
    for (let k = 0; k < stage.length; k++) {
      const t = stage[k]
      let n = 0
      while (t.l[n] !== -1) n = x[t.f[n]] <= t.t[n] ? t.l[n] : t.r[n]
      raw[k] += pm.learning_rate * t.v[n]
    }
  }
  const m = Math.max(...raw)
  const e = raw.map(v => Math.exp(v - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map(v => v / s)
}

const gkey = (g: number) => fmtG(+g)
const GRAVITY_NAMES: Record<string, string> = { '0': 'microgravity (~0 g)', '0.165': 'lunar gravity (0.165 g)', '0.38': 'Martian gravity (0.38 g)', '1': 'Earth gravity (1 g)' }

// Human-readable names for refusal messages and explanations (same text as backend/src/compute/predict.py).
const GAS_LABEL: Record<string, string> = { air: 'Normal air (O\u2082/N\u2082)', co2: 'Carbon dioxide build-up', methane: 'Methane leak' }
const QUANTITY: Record<Num, [string, string]> = { oxygen_pct: ['Oxygen', '%'], pressure_kpa: ['Pressure', ' kPa'], flow_cm_s: ['Airflow', ' cm/s'] }
const matLabel = (m: string) => MATERIAL_LABEL[m] ?? m
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function checkRange(inp: any, card: ModelCard): [boolean, string[]] {
  const reasons: string[] = []
  const gas = inp.gas_mix ?? 'air'
  const mat = matLabel(inp.material)
  if (gas !== 'air') reasons.push(`Gas mix \u201c${GAS_LABEL[gas] ?? gas}\u201d is not in the training data: every training experiment burned in oxygen/nitrogen atmospheres only, so the model cannot say anything about it.`)
  const menv = card.training_range.materials[inp.material]
  if (!menv) return [false, [...reasons, `Material \u201c${mat}\u201d is not in the training data.`]]
  const gk = gkey(inp.gravity_g ?? 0)
  const env = menv.by_gravity[gk]
  if (!env) {
    const tested = Object.keys(menv.by_gravity).map(k => GRAVITY_NAMES[k] ?? k + ' g').join(', ')
    return [false, [...reasons, `No real experiment with ${mat} exists at ${GRAVITY_NAMES[gk] ?? gk + ' g'}. This material was tested at: ${tested}. The model will not guess across gravity levels.`]]
  }
  for (const c of NUMERIC) {
    const [lo, hi] = env[c]
    const v = +inp[c]
    const [name, u] = QUANTITY[c]
    if (v < lo - 1e-9 || v > hi + 1e-9) reasons.push(`${name} ${fmtG(v)}${u} is outside the tested range of ${fmtG(lo)}${u} to ${fmtG(hi)}${u} for ${mat}.`)
  }
  if (!env.flow_directions.includes(inp.flow_direction)) reasons.push(`${cap(inp.flow_direction)} flow was never tested for ${mat} (tested: ${env.flow_directions.join(', ')}).`)
  const g0 = +(inp.gravity_g ?? 0) === 0
  if (g0 && +inp.flow_cm_s === 0 && inp.flow_direction !== 'quiescent') reasons.push('In microgravity, zero airflow means quiescent conditions: choose the quiescent (no flow) direction.')
  if (+inp.flow_cm_s > 0 && inp.flow_direction === 'quiescent') reasons.push('Quiescent (no flow) conditions need an airflow of 0 cm/s.')
  return [reasons.length === 0, reasons]
}

function distances(inp: any, rows: Row[], card: ModelCard): number[] {
  const g = card.training_range.global
  const s = Object.fromEntries(NUMERIC.map(c => [c, Math.max(g[c][1] - g[c][0], 1e-9)])) as Record<Num, number>
  return rows.map(r => {
    let d2 = 0
    for (const c of NUMERIC) d2 += ((+r[c] - +inp[c]) / s[c]) ** 2
    let d = Math.sqrt(d2)
    d += r.material === inp.material ? 0 : 1
    d += isClose(+r.gravity_g, +inp.gravity_g) ? 0 : 1
    d += r.flow_direction === inp.flow_direction ? 0 : 0.25
    return d
  })
}

function expRecord(r: Row, dist: number): Experiment {
  return {
    row_id: r.row_id, report_id: r.report_id, source_url: r.source_url, source_title: r.source_title, source_location: r.source_location,
    quote: r.quote, oxygen_pct: +r.oxygen_pct, pressure_kpa: +r.pressure_kpa, flow_cm_s: +r.flow_cm_s, flow_direction: r.flow_direction,
    gravity_g: +r.gravity_g, material: r.material, material_detail: r.material_detail, facility: r.facility, outcome: r.outcome,
    outcome_detail: r.outcome_detail, distance: round(dist, 4),
  }
}

/* ---- deterministic explanation (backend/src/compute/explain.py: template) ---- */
const NICE: Record<Outcome, string> = { no_spread: 'no spread', marginal_spread: 'marginal (near-limit) spread', spread: 'sustained spread' }
const GNAME: Record<string, string> = { '0': 'microgravity (~0 g)', '0.165': 'lunar gravity (0.165 g)', '0.38': 'Martian gravity (0.38 g)', '1': 'Earth gravity (1 g)' }
const expText = (e: Experiment) => `${e.report_id} (${fmtG(e.oxygen_pct)}% O\u2082, ${fmtG(e.pressure_kpa)} kPa, ${fmtG(e.flow_cm_s)} cm/s ${e.flow_direction}, ${matLabel(e.material)}): observed ${NICE[e.outcome]} - ${e.outcome_detail}`

function template(p: any): { source: string; text: string } {
  const i = p.inputs
  const g = +(i.gravity_g ?? 0)
  const gas = i.gas_mix ?? 'air'
  const cond = `${GNAME[fmtG(round(g, 3))] ?? `${fmtG(g)} g`}, oxygen ${fmtG(i.oxygen_pct)}%, pressure ${fmtG(i.pressure_kpa)} kPa, airflow ${fmtG(i.flow_cm_s)} cm/s ${i.flow_direction}, ${matLabel(i.material)}` + (gas === 'air' ? '' : `, gas mix ${GAS_LABEL[gas] ?? gas}`)
  const m = p.model
  if (!p.in_training_range) {
    const lines = [`No prediction. The requested conditions (${cond}) are outside the published experimental envelope used to train this model.`,
      ...(p.range_violations ?? []).map((r: string) => `\u2022 ${r}`),
      'A fire-safety tool must not guess outside its evidence. The closest real experiments are listed for reference only.']
    return { source: 'template', text: lines.join('\n') }
  }
  const pr = p.probabilities[p.prediction]
  const lines = [`At ${cond}, the model predicts ${NICE[p.prediction as Outcome]} (probability ${fmtG(pr)}).`,
    `Model: ${String(m.type).replace(/_/g, '-')} classifier trained on ${m.n_train} published tests across gravity levels (0, 0.165, 0.38 and 1 g); stratified cross-validated accuracy ${fmtG(m.cv_accuracy)}.`]
  if (p.supporting_experiment) lines.push('Evidence on the predicted side: ' + expText(p.supporting_experiment) + '.')
  if (p.contrast_experiment) lines.push('Nearest evidence on the other side of the boundary: ' + expText(p.contrast_experiment) + '.')
  const u = p.uncertainty
  if (u) lines.push(`Confidence: ${u.level} (top probability ${fmtG(u.max_probability)}, ${u.neighbours_agreeing} of 3 nearest experiments agree).`)
  const accG = (m.oof_accuracy_by_gravity ?? {})[gkey(g)]
  if (g > 0 && accG) lines.push(`Caution: only ${accG.n} real experiments exist at this gravity level, so this output is essentially a lookup of the nearest published test (out-of-fold accuracy at this gravity ${fmtG(accG.accuracy)}).`)
  if (u?.level === 'low') lines.push('Treat this as a flag for testing, not as a clearance: the nearest published data disagree or are sparse.')
  return { source: 'template', text: lines.join('\n') }
}

export async function localPredict(body: any, k = 3): Promise<Prediction> {
  const { pm, card, rows } = await load()
  const fc = +body.flow_cm_s
  const inp = {
    oxygen_pct: +body.oxygen_pct, pressure_kpa: +body.pressure_kpa, flow_cm_s: fc, material: body.material,
    flow_direction: body.flow_direction || (fc === 0 ? 'quiescent' : 'concurrent'),
    gravity_g: +(body.gravity_g || 0), gas_mix: body.gas_mix || 'air',
  }
  const [ok, reasons] = checkRange(inp, card)
  const d = distances(inp, rows, card)
  const order = d.map((_, i) => i).sort((a, b) => d[a] - d[b])
  const nearest = order.slice(0, k).map(i => expRecord(rows[i], d[i]))
  const model = { ...card.model, oof_accuracy_by_gravity: card.metrics.oof_accuracy_by_gravity ?? {} }
  let out: any = { inputs: inp, in_training_range: ok, model }
  if (!ok) {
    out = { ...out, prediction: null, probabilities: null, range_violations: reasons, nearest_experiments: nearest,
      contrast_experiment: null, uncertainty: null, explanation_facts: { refused: true } }
  } else {
    const pr = proba(pm, inp)
    const probs = Object.fromEntries(CLASSES.map(c => [c, round(pr[pm.classes.indexOf(c)], 3)])) as Record<Outcome, number>
    let pred: Outcome = CLASSES[0]
    for (const c of CLASSES) if (probs[c] > probs[pred]) pred = c
    const same = rows.map(r => r.material === inp.material && isClose(+r.gravity_g, inp.gravity_g))
    const ci = order.find(i => same[i] && rows[i].outcome !== pred)
    const si = order.find(i => same[i] && rows[i].outcome === pred)
    const top = Object.values(probs).sort((a, b) => b - a)
    const nearD = d[order[0]]
    const agree = nearest.filter(e => e.outcome === pred).length
    let level = 'low'
    if (top[0] >= 0.8 && nearD < 0.08 && agree >= 2) level = 'high'
    else if (top[0] >= 0.6 && nearD < 0.2) level = 'medium'
    out = { ...out, prediction: pred, probabilities: probs, nearest_experiments: nearest,
      supporting_experiment: si === undefined ? null : expRecord(rows[si], d[si]),
      contrast_experiment: ci === undefined ? null : expRecord(rows[ci], d[ci]),
      uncertainty: { max_probability: top[0], margin_to_second: round(top[0] - top[1], 3), nearest_distance: round(nearD, 4),
        neighbours_agreeing: agree, level,
        note: 'Distance is Euclidean over range-normalised O2, pressure and flow (+1 for a different material, +1 for a different gravity level).' } }
  }
  // related NTRS reports: precomputed with the server's TF-IDF index for these query words
  const key = `${inp.material}|${inp.flow_direction}|${inp.flow_cm_s < 10 ? 1 : 0}|${inp.pressure_kpa < 95 ? 1 : 0}|${out.prediction ?? ''}`
  out.related_reports = (pm.related[key] ?? []).map(([id, score]) => ({ report_id: id, ...pm.reports[id], score }))
  const cited: Prediction['cited_abstracts'] = []
  for (const e of [...out.nearest_experiments, ...(out.contrast_experiment ? [out.contrast_experiment] : [])]) {
    const rid = e.report_id.replace('NTRS ', '')
    if (!cited.some(c => c.ntrs_id === rid) && pm.abstracts[rid]) cited.push({ ntrs_id: rid, ...pm.abstracts[rid] })
  }
  out.cited_abstracts = cited
  out.explanation = template(out)
  return out as Prediction
}

// numpy.linspace: start + i * step, with the last point set exactly to stop
const linspace = (a: number, b: number, n: number) => { const step = (b - a) / (n - 1); return n === 1 ? [a] : Array.from({ length: n }, (_, i) => i === n - 1 ? b : i * step + a) }

export async function localBoundary(q: URLSearchParams): Promise<Boundary> {
  const { pm, card, rows } = await load()
  const material = q.get('material') ?? '', flow_direction = q.get('flow_direction') ?? ''
  const x = (q.get('x') ?? 'oxygen_pct') as Num, y = (q.get('y') ?? 'flow_cm_s') as Num
  const gravity_g = +(q.get('gravity_g') ?? 0)
  const nx = Math.min(+(q.get('nx') ?? 60), 120), ny = Math.min(+(q.get('ny') ?? 50), 120)
  const env = card.training_range.materials[material]?.by_gravity?.[gkey(gravity_g)]
  if (!env || !NUMERIC.includes(x) || !NUMERIC.includes(y) || x === y) throw new Error('400 no data for this material at this gravity level, or bad axes')
  const third = NUMERIC.find(c => c !== x && c !== y)!
  if (q.get(third) === null) throw new Error(`400 provide ${third}`)
  const tv = +q.get(third)!
  const xs = env[x][1] > env[x][0] ? linspace(env[x][0], env[x][1], nx) : [env[x][0]]
  const ys = env[y][1] > env[y][0]
    ? (y === 'flow_cm_s' ? linspace(Math.sqrt(env[y][0]), Math.sqrt(env[y][1]), ny).map(v => v ** 2) : linspace(env[y][0], env[y][1], ny))
    : [env[y][0]]
  const z: (Outcome | null)[][] = [], conf: number[][] = []
  for (const yv of ys) {
    const zr: (Outcome | null)[] = [], cr: number[] = []
    for (const xv of xs) {
      const r: any = { [x]: xv, [y]: yv, [third]: tv, gravity_g, material, flow_direction }
      const p = proba(pm, r)
      let bi = 0
      for (let i = 1; i < p.length; i++) if (p[i] > p[bi]) bi = i
      zr.push(checkRange(r, card)[0] ? pm.classes[bi] : null)
      cr.push(round(p[bi], 3))
    }
    z.push(zr); conf.push(cr)
  }
  const points = rows.filter(r => r.material === material && isClose(+r.gravity_g, gravity_g)).map(r => ({
    row_id: r.row_id, oxygen_pct: r.oxygen_pct, pressure_kpa: r.pressure_kpa, flow_cm_s: r.flow_cm_s,
    flow_direction: r.flow_direction, outcome: r.outcome, report_id: r.report_id, source_url: r.source_url,
  })) as unknown as Experiment[]
  return { x, y, third, third_value: tv, gravity_g, xs, ys, z, confidence: conf, points, envelope: env } as Boundary
}
