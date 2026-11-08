/** Guest investigation records, validation, and evidence wording.
 *  Pure data: no browser APIs. A later authenticated store can keep these types
 *  and replace only the persistence adapter. */

export const WORKSPACE_SCHEMA = 'ignite.workspace'
export const PARAMETERS_SCHEMA = 'ignite.parameters'
export const SCHEMA_VERSION = 1
export const STORAGE_KEY = 'ignite.workspace.v1'
export const QUARANTINE_KEY = 'ignite.workspace.quarantine'

export const LIMITS = {
  investigations: 30,
  scenarios: 20,
  comparisons: 10,
  activity: 25,
  title: 120,
  question: 800,
  notes: 4000,
  label: 80,
  material: 60,
  importChars: 400_000,
} as const

/** Gravity values of the environment presets. A preset selects a gravity context;
 *  it is not itself a test record. */
export const ENV_GRAVITY: Record<string, number> = {
  earth: 1,
  moon: 0.165,
  mars: 0.38,
  iss: 0,
  transit: 0,
}

export const FLOW_DIRECTIONS = ['concurrent', 'opposed', 'quiescent'] as const
export type FlowDirection = (typeof FLOW_DIRECTIONS)[number]

export const STEPS = ['question', 'conditions', 'evidence', 'compare', 'notes'] as const
export type StepId = (typeof STEPS)[number]
export type WorkMode = 'guided' | 'sandbox'

export const STORAGE_NOTICE =
  'Guest mode on this browser. Investigations stay in this browser’s local storage under a guest id. This is not an account, not access control, and not synced to another device. The browser can wipe it. Download a backup before you rely on it.'

export const RANKING_HELP =
  'Nearest tests are ranked by Euclidean distance over oxygen, pressure, and airflow, each divided by the full range of that input in the loaded dataset, plus 1 if the material differs, plus 1 if the gravity level differs, and plus 0.25 if the flow direction differs. Similarity = 1 / (1 + distance). The score ranks distance. It is not a probability that two tests are the same case.'

export const JOINT_TOLERANCE = {
  oxygen_pct: 0.2,
  pressure_kpa: 1,
  flow_cm_s: 1,
  gravity_g: 0.001,
} as const

export type ScenarioConditions = {
  envId: string
  gravity_g: number
  oxygen_pct: number
  pressure_kpa: number
  flow_cm_s: number
  material: string
  flow_direction: FlowDirection
  gas_mix: string
}

export type SharedConditions = Omit<ScenarioConditions, 'material'>

export type Scenario = {
  id: string
  label: string
  savedAt: string
  conditions: ScenarioConditions
}

export type MaterialComparison = {
  id: string
  savedAt: string
  label: string
  kind: 'materials'
  shared: SharedConditions
  materials: string[]
}

export type ActivityKind = 'created' | 'question' | 'scenario' | 'comparison' | 'notes' | 'imported' | 'exported'

export type Activity = {
  id: string
  at: string
  investigationId: string
  kind: ActivityKind
  summary: string
}

export type Investigation = {
  id: string
  ownerId: string
  importedFromOwnerId?: string
  title: string
  question: string
  notes: string
  mode: WorkMode
  step: StepId
  createdAt: string
  updatedAt: string
  scenarios: Scenario[]
  activeScenarioId: string | null
  comparisons: MaterialComparison[]
  activity: Activity[]
}

export type GuestOwner = {
  id: string
  kind: 'guest'
  label: string
  createdAt: string
}

export type WorkspaceDocument = {
  schema: typeof WORKSPACE_SCHEMA
  schemaVersion: number
  owner: GuestOwner
  lastOpenedId: string | null
  investigations: Investigation[]
  notice: string
}

export type Deps = { now: () => string; id: () => string }

export function liveDeps(): Deps {
  return {
    now: () => new Date().toISOString(),
    id: () => globalThis.crypto.randomUUID(),
  }
}

const ID_RE = /^[A-Za-z0-9_-]{8,80}$/
const MATERIAL_RE = /^[A-Za-z0-9][A-Za-z0-9_ .+-]{0,59}$/
const GAS_RE = /^[a-z0-9_-]{1,32}$/

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const clean = value.replace(/\u0000/g, '').trim()
  if (clean.length > max) return null
  return clean
}

function finite(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}

export function isConditions(value: unknown): value is ScenarioConditions {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  const envId = v.envId
  if (typeof envId !== 'string' || !(envId in ENV_GRAVITY)) return false
  const gravity = finite(v.gravity_g)
  if (gravity === null || Math.abs(gravity - ENV_GRAVITY[envId]) > JOINT_TOLERANCE.gravity_g) return false
  const oxygen = finite(v.oxygen_pct)
  const pressure = finite(v.pressure_kpa)
  const flow = finite(v.flow_cm_s)
  if (oxygen === null || oxygen < 0 || oxygen > 100) return false
  if (pressure === null || pressure < 0 || pressure > 500) return false
  if (flow === null || flow < 0 || flow > 500) return false
  if (typeof v.material !== 'string' || !MATERIAL_RE.test(v.material)) return false
  if (typeof v.flow_direction !== 'string' || !FLOW_DIRECTIONS.includes(v.flow_direction as FlowDirection)) return false
  if (typeof v.gas_mix !== 'string' || !GAS_RE.test(v.gas_mix)) return false
  return true
}

export function asConditions(value: unknown): ScenarioConditions | null {
  if (!isConditions(value)) return null
  return {
    envId: value.envId,
    gravity_g: ENV_GRAVITY[value.envId],
    oxygen_pct: round(value.oxygen_pct, 4),
    pressure_kpa: round(value.pressure_kpa, 4),
    flow_cm_s: round(value.flow_cm_s, 4),
    material: value.material,
    flow_direction: value.flow_direction,
    gas_mix: value.gas_mix,
  }
}

function round(n: number, d: number) {
  const p = 10 ** d
  return Math.round(n * p) / p
}

export function blankDocument(deps: Deps): WorkspaceDocument {
  const now = deps.now()
  return {
    schema: WORKSPACE_SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    owner: { id: deps.id(), kind: 'guest', label: 'Guest on this browser', createdAt: now },
    lastOpenedId: null,
    investigations: [],
    notice: STORAGE_NOTICE,
  }
}

function activity(inv: Investigation, deps: Deps, kind: ActivityKind, summary: string): Activity {
  return { id: deps.id(), at: deps.now(), investigationId: inv.id, kind, summary }
}

function pushActivity(inv: Investigation, item: Activity): Activity[] {
  return [...inv.activity, item].slice(-LIMITS.activity)
}

export function addInvestigation(
  doc: WorkspaceDocument,
  input: { title?: string; question?: string; mode?: WorkMode; scenario?: ScenarioConditions | null },
  deps: Deps,
): { doc: WorkspaceDocument; id: string } | { error: string } {
  if (doc.investigations.length >= LIMITS.investigations) return { error: `This browser workspace holds ${LIMITS.investigations} investigations. Export a backup and delete one before adding another.` }
  const title = text(input.title ?? 'Untitled investigation', LIMITS.title)
  const question = text(input.question ?? '', LIMITS.question)
  if (title === null || question === null) return { error: 'Title or question is empty, not text, or too long.' }
  const now = deps.now()
  const id = deps.id()
  const scenario = input.scenario ? asConditions(input.scenario) : null
  if (input.scenario && !scenario) return { error: 'The scenario conditions are not a valid preset and numeric range.' }
  const scenarios: Scenario[] = scenario
    ? [{ id: deps.id(), label: 'Saved from the sandbox', savedAt: now, conditions: scenario }]
    : []
  const inv: Investigation = {
    id,
    ownerId: doc.owner.id,
    title: title || 'Untitled investigation',
    question,
    notes: '',
    mode: input.mode ?? (scenario ? 'sandbox' : 'guided'),
    step: scenario ? 'evidence' : 'question',
    createdAt: now,
    updatedAt: now,
    scenarios,
    activeScenarioId: scenarios[0]?.id ?? null,
    comparisons: [],
    activity: [],
  }
  inv.activity = pushActivity(inv, activity(inv, deps, 'created', scenario ? 'Investigation created from sandbox conditions' : 'Investigation created'))
  return { doc: { ...doc, lastOpenedId: id, investigations: [inv, ...doc.investigations] }, id }
}

export function patchInvestigation(
  doc: WorkspaceDocument,
  id: string,
  patch: Partial<Pick<Investigation, 'title' | 'question' | 'notes' | 'mode' | 'step'>>,
  deps: Deps,
  log?: { kind: ActivityKind; summary: string },
): WorkspaceDocument | { error: string } {
  const inv = doc.investigations.find(i => i.id === id)
  if (!inv) return { error: 'That investigation is not in this browser workspace.' }
  const next: Investigation = { ...inv, updatedAt: deps.now() }
  if (patch.title !== undefined) {
    const title = text(patch.title, LIMITS.title)
    if (!title) return { error: `Give the investigation a title of 1–${LIMITS.title} characters.` }
    next.title = title
  }
  if (patch.question !== undefined) {
    const question = text(patch.question, LIMITS.question)
    if (question === null) return { error: `The question must be text under ${LIMITS.question} characters.` }
    next.question = question
  }
  if (patch.notes !== undefined) {
    const notes = text(patch.notes, LIMITS.notes)
    if (notes === null) return { error: `Notes must be text under ${LIMITS.notes} characters. Shorten them or keep the rest in your backup file.` }
    next.notes = notes
  }
  if (patch.mode !== undefined) {
    if (patch.mode !== 'guided' && patch.mode !== 'sandbox') return { error: 'Mode must be guided or sandbox.' }
    next.mode = patch.mode
  }
  if (patch.step !== undefined) {
    if (!STEPS.includes(patch.step)) return { error: 'Unknown workflow step.' }
    next.step = patch.step
  }
  if (log) next.activity = pushActivity(next, activity(next, deps, log.kind, log.summary))
  return { ...doc, lastOpenedId: id, investigations: doc.investigations.map(i => i.id === id ? next : i) }
}

export function addScenario(
  doc: WorkspaceDocument,
  id: string,
  conditions: ScenarioConditions,
  label: string,
  deps: Deps,
): WorkspaceDocument | { error: string } {
  const inv = doc.investigations.find(i => i.id === id)
  if (!inv) return { error: 'That investigation is not in this browser workspace.' }
  if (inv.scenarios.length >= LIMITS.scenarios) return { error: `An investigation can keep ${LIMITS.scenarios} saved scenarios. Delete the investigation’s older points from a backup if you need room.` }
  const clean = asConditions(conditions)
  if (!clean) return { error: 'Those conditions are outside the values this workspace can store.' }
  const name = text(label, LIMITS.label) || `Scenario ${inv.scenarios.length + 1}`
  const scenario: Scenario = { id: deps.id(), label: name, savedAt: deps.now(), conditions: clean }
  const next: Investigation = {
    ...inv,
    updatedAt: deps.now(),
    scenarios: [...inv.scenarios, scenario],
    activeScenarioId: scenario.id,
    step: inv.step === 'question' || inv.step === 'conditions' ? 'evidence' : inv.step,
  }
  next.activity = pushActivity(next, activity(next, deps, 'scenario', `Saved scenario “${name}”`))
  return { ...doc, lastOpenedId: id, investigations: doc.investigations.map(i => i.id === id ? next : i) }
}

export function activateScenario(doc: WorkspaceDocument, id: string, scenarioId: string, deps: Deps): WorkspaceDocument | { error: string } {
  const inv = doc.investigations.find(i => i.id === id)
  if (!inv) return { error: 'That investigation is not in this browser workspace.' }
  if (!inv.scenarios.some(s => s.id === scenarioId)) return { error: 'That scenario is not in this investigation.' }
  const next = { ...inv, activeScenarioId: scenarioId, updatedAt: deps.now() }
  return { ...doc, lastOpenedId: id, investigations: doc.investigations.map(i => i.id === id ? next : i) }
}

export function addMaterialComparison(
  doc: WorkspaceDocument,
  id: string,
  materials: string[],
  shared: SharedConditions,
  label: string,
  deps: Deps,
): WorkspaceDocument | { error: string } {
  const inv = doc.investigations.find(i => i.id === id)
  if (!inv) return { error: 'That investigation is not in this browser workspace.' }
  if (inv.comparisons.length >= LIMITS.comparisons) return { error: `An investigation can keep ${LIMITS.comparisons} comparisons.` }
  const unique = [...new Set(materials.map(m => m.trim()))]
  if (unique.length < 2 || unique.length > 6) return { error: 'Compare two to six materials under the same other conditions.' }
  if (unique.some(m => !MATERIAL_RE.test(m))) return { error: 'A material id is empty or uses unsupported characters.' }
  const base = asConditions({ ...shared, material: unique[0] })
  if (!base) return { error: 'The shared conditions are not valid.' }
  const { material: _material, ...sharedClean } = base
  const name = text(label, LIMITS.label) || `Comparison ${inv.comparisons.length + 1}`
  const comparison: MaterialComparison = {
    id: deps.id(),
    savedAt: deps.now(),
    label: name,
    kind: 'materials',
    shared: sharedClean,
    materials: unique,
  }
  const next: Investigation = {
    ...inv,
    updatedAt: deps.now(),
    comparisons: [...inv.comparisons, comparison],
    step: inv.step === 'compare' ? 'notes' : inv.step,
  }
  next.activity = pushActivity(next, activity(next, deps, 'comparison', `Compared ${unique.length} materials under shared conditions`))
  return { ...doc, lastOpenedId: id, investigations: doc.investigations.map(i => i.id === id ? next : i) }
}

export function removeInvestigation(doc: WorkspaceDocument, id: string): WorkspaceDocument {
  return {
    ...doc,
    lastOpenedId: doc.lastOpenedId === id ? null : doc.lastOpenedId,
    investigations: doc.investigations.filter(i => i.id !== id),
  }
}

export type NextStep = { id: string; title: string; detail: string }

export function nextStep(inv: Investigation): NextStep {
  if (!inv.question.trim()) {
    return { id: 'question', title: 'Write the question', detail: 'State the combustion condition you want to investigate. The question is kept in a full backup and left out of a parameter-only link.' }
  }
  if (inv.scenarios.length === 0) {
    return { id: 'conditions', title: 'Save a scenario', detail: 'Set gravity, oxygen, pressure, airflow, gas mix, and material, then save that point. The history is what you can reload.' }
  }
  if (inv.comparisons.length === 0) {
    return { id: 'compare', title: 'Compare alternatives', detail: 'Run at least two materials at the same oxygen, pressure, airflow, gravity, and gas mix. Unsupported combinations stay visible as limitations.' }
  }
  if (!inv.notes.trim()) {
    return { id: 'notes', title: 'Write a private note', detail: 'Record what the cited tests support and where the loaded record stops. Notes stay on this browser and in full backups only.' }
  }
  return { id: 'backup', title: 'Export a backup', detail: 'This investigation has a question, a saved scenario, a comparison, and notes. Download a full backup. This browser is not a durable archive.' }
}

export function recentActivity(doc: WorkspaceDocument, limit = 8): Activity[] {
  return doc.investigations.flatMap(i => i.activity).sort((a, b) => a.at < b.at ? 1 : a.at > b.at ? -1 : 0).slice(0, limit)
}

export function shareQuery(conditions: ScenarioConditions): string {
  const q = new URLSearchParams({
    share: '1',
    env: conditions.envId,
    o2: String(conditions.oxygen_pct),
    p: String(conditions.pressure_kpa),
    v: String(conditions.flow_cm_s),
    mat: conditions.material,
    dir: conditions.flow_direction,
    gas: conditions.gas_mix,
  })
  return `/workspace?${q.toString()}`
}

export function parseShare(search: string): { ok: true; conditions: ScenarioConditions } | { ok: false; error: string } {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (q.get('share') !== '1') return { ok: false, error: 'Not a parameter link.' }
  const conditions = asConditions({
    envId: q.get('env'),
    gravity_g: q.get('env') && ENV_GRAVITY[q.get('env') as string] !== undefined ? ENV_GRAVITY[q.get('env') as string] : q.get('env'),
    oxygen_pct: q.get('o2'),
    pressure_kpa: q.get('p'),
    flow_cm_s: q.get('v'),
    material: q.get('mat'),
    flow_direction: q.get('dir'),
    gas_mix: q.get('gas') || 'air',
  })
  if (!conditions) return { ok: false, error: 'This parameter link is incomplete or outside the values the workspace accepts. Notes are never read from a link.' }
  return { ok: true, conditions }
}

export function parameterDocument(inv: Investigation, exportedAt: string) {
  return {
    schema: PARAMETERS_SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    includesPrivateNotes: false as const,
    includesQuestion: false as const,
    title: inv.title,
    conditions: inv.scenarios.map(s => ({ label: s.label, savedAt: s.savedAt, ...s.conditions })),
    comparisons: inv.comparisons.map(c => ({
      label: c.label,
      savedAt: c.savedAt,
      materials: c.materials,
      shared: c.shared,
    })),
  }
}

export function fullDocument(doc: WorkspaceDocument, exportedAt: string) {
  return {
    schema: WORKSPACE_SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    kind: 'guest-backup' as const,
    ownerId: doc.owner.id,
    notice: STORAGE_NOTICE,
    investigations: doc.investigations,
  }
}

type Warning = string

function pickInvestigation(value: unknown, ownerId: string, deps: Deps): { inv: Investigation; warnings: Warning[] } | { error: string } {
  if (!value || typeof value !== 'object') return { error: 'An investigation was not an object.' }
  const v = value as Record<string, unknown>
  const title = text(v.title, LIMITS.title)
  const question = text(typeof v.question === 'string' ? v.question : '', LIMITS.question)
  const notes = text(typeof v.notes === 'string' ? v.notes : '', LIMITS.notes)
  if (!title || question === null || notes === null) return { error: 'An investigation has a missing title or oversized text.' }
  if (!Array.isArray(v.scenarios) || v.scenarios.length > LIMITS.scenarios) return { error: 'An investigation has an invalid scenario list.' }
  if (!Array.isArray(v.comparisons) || v.comparisons.length > LIMITS.comparisons) return { error: 'An investigation has an invalid comparison list.' }
  const warnings: Warning[] = []
  const scenarios: Scenario[] = []
  for (const raw of v.scenarios) {
    if (!raw || typeof raw !== 'object') { warnings.push('A scenario was skipped because it was not an object.'); continue }
    const s = raw as Record<string, unknown>
    const conditions = asConditions(s.conditions)
    if (!conditions) { warnings.push('A scenario was skipped because its conditions were invalid.'); continue }
    const label = text(typeof s.label === 'string' ? s.label : 'Scenario', LIMITS.label) || 'Scenario'
    const savedAt = text(typeof s.savedAt === 'string' ? s.savedAt : deps.now(), 40) || deps.now()
    const id = typeof s.id === 'string' && ID_RE.test(s.id) ? s.id : deps.id()
    scenarios.push({ id, label, savedAt, conditions })
  }
  const comparisons: MaterialComparison[] = []
  for (const raw of v.comparisons) {
    if (!raw || typeof raw !== 'object') { warnings.push('A comparison was skipped.'); continue }
    const c = raw as Record<string, unknown>
    const materials = Array.isArray(c.materials) ? [...new Set(c.materials.filter((m): m is string => typeof m === 'string'))] : []
    if (materials.length < 2 || materials.some(m => !MATERIAL_RE.test(m))) { warnings.push('A comparison was skipped because it did not name two valid materials.'); continue }
    const shared = asConditions({ ...(c.shared as object), material: materials[0] })
    if (!shared) { warnings.push('A comparison was skipped because the shared conditions were invalid.'); continue }
    const { material: _m, ...rest } = shared
    comparisons.push({
      id: typeof c.id === 'string' && ID_RE.test(c.id) ? c.id : deps.id(),
      savedAt: text(typeof c.savedAt === 'string' ? c.savedAt : deps.now(), 40) || deps.now(),
      label: text(typeof c.label === 'string' ? c.label : 'Comparison', LIMITS.label) || 'Comparison',
      kind: 'materials',
      shared: rest,
      materials,
    })
  }
  const previous = typeof v.ownerId === 'string' && ID_RE.test(v.ownerId) ? v.ownerId : undefined
  const mode: WorkMode = v.mode === 'sandbox' ? 'sandbox' : 'guided'
  const step: StepId = STEPS.includes(v.step as StepId) ? v.step as StepId : 'question'
  const id = typeof v.id === 'string' && ID_RE.test(v.id) ? v.id : deps.id()
  const active = typeof v.activeScenarioId === 'string' && scenarios.some(s => s.id === v.activeScenarioId) ? v.activeScenarioId : scenarios[0]?.id ?? null
  const inv: Investigation = {
    id,
    ownerId,
    ...(previous && previous !== ownerId ? { importedFromOwnerId: previous } : {}),
    title,
    question,
    notes,
    mode,
    step,
    createdAt: text(typeof v.createdAt === 'string' ? v.createdAt : deps.now(), 40) || deps.now(),
    updatedAt: deps.now(),
    scenarios,
    activeScenarioId: active,
    comparisons,
    activity: [activity({ id } as Investigation, deps, 'imported', 'Imported into this browser’s guest workspace')],
  }
  return { inv, warnings }
}

export function adoptImport(doc: WorkspaceDocument, raw: string, deps: Deps): { doc: WorkspaceDocument; warnings: string[] } | { error: string; warnings: string[] } {
  if (typeof raw !== 'string' || raw.length > LIMITS.importChars) return { error: 'That file is empty or larger than this workspace will import.', warnings: [] }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return { error: 'That file is not valid JSON. Nothing was changed.', warnings: [] } }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { error: 'The file is not an IGNITE-AI workspace or parameter document.', warnings: [] }
  const body = parsed as Record<string, unknown>
  if (body.schemaVersion !== SCHEMA_VERSION) return { error: `This build reads schema version ${SCHEMA_VERSION} only. The file was not imported.`, warnings: [] }
  const warnings: string[] = []
  if (body.schema === PARAMETERS_SCHEMA) {
    const conditions = Array.isArray(body.conditions) ? body.conditions : null
    if (!conditions) return { error: 'The parameter file has no conditions list.', warnings }
    const title = text(typeof body.title === 'string' ? body.title : 'Imported conditions', LIMITS.title) || 'Imported conditions'
    const scenarios: ScenarioConditions[] = []
    for (const item of conditions) {
      const c = asConditions(item)
      if (!c) warnings.push('A parameter row was skipped.')
      else scenarios.push(c)
    }
    if (!scenarios.length) return { error: 'No valid conditions were found in the parameter file.', warnings }
    let next = doc
    let firstId = ''
    scenarios.forEach((scenario, index) => {
      if (index === 0) {
        const created = addInvestigation(next, { title, mode: 'sandbox', scenario }, deps)
        if ('error' in created) { warnings.push(created.error); return }
        next = created.doc
        firstId = created.id
      } else if (firstId) {
        const added = addScenario(next, firstId, scenario, `Imported ${index + 1}`, deps)
        if ('error' in added) warnings.push(added.error)
        else next = added
      }
    })
    const comps = Array.isArray(body.comparisons) ? body.comparisons : []
    for (const rawComp of comps) {
      if (!firstId || !rawComp || typeof rawComp !== 'object') continue
      const c = rawComp as Record<string, unknown>
      const materials = Array.isArray(c.materials) ? c.materials.filter((m): m is string => typeof m === 'string') : []
      const shared = c.shared
      if (!shared || typeof shared !== 'object') continue
      const added = addMaterialComparison(next, firstId, materials, shared as SharedConditions, typeof c.label === 'string' ? c.label : 'Imported comparison', deps)
      if ('error' in added) warnings.push(added.error)
      else next = added
    }
    warnings.push('Parameter import stores conditions only. It does not restore private notes or the written question.')
    return { doc: next, warnings }
  }
  if (body.schema !== WORKSPACE_SCHEMA) return { error: 'Unrecognized file. Expected an IGNITE-AI workspace backup or a parameter file.', warnings }
  const list = Array.isArray(body.investigations) ? body.investigations : null
  if (!list) return { error: 'The backup has no investigations list.', warnings }
  let next = doc
  let kept = 0
  for (const item of list) {
    if (next.investigations.length >= LIMITS.investigations) { warnings.push('Further investigations were skipped because this workspace is full.'); break }
    const picked = pickInvestigation(item, doc.owner.id, deps)
    if ('error' in picked) { warnings.push(picked.error); continue }
    warnings.push(...picked.warnings)
    if (next.investigations.some(i => i.id === picked.inv.id)) picked.inv = { ...picked.inv, id: deps.id() }
    next = { ...next, lastOpenedId: picked.inv.id, investigations: [picked.inv, ...next.investigations] }
    kept += 1
  }
  if (!kept) return { error: 'No investigation in that backup could be read.', warnings }
  warnings.push('Imported records now belong to this browser’s guest id. A previous owner id is provenance only and does not grant access.')
  return { doc: next, warnings }
}

export type JointRow = {
  oxygen_pct: number
  pressure_kpa: number
  flow_cm_s: number
  material: string
  flow_direction: string
  gravity_g?: number
  gas_mix?: string
  row_id?: string
  report_id?: string
  source_location?: string
  distance?: number
}

export function findJointMatch<T extends JointRow>(input: { oxygen_pct: number; pressure_kpa: number; flow_cm_s: number; material: string; flow_direction: string; gravity_g: number; gas_mix?: string }, rows: T[]): T | null {
  if (input.gas_mix && input.gas_mix !== 'air') return null
  let best: T | null = null
  let bestD = Infinity
  for (const row of rows) {
    if (row.material !== input.material || row.flow_direction !== input.flow_direction) continue
    if (Math.abs((row.gravity_g ?? 0) - input.gravity_g) > JOINT_TOLERANCE.gravity_g) continue
    if (Math.abs(row.oxygen_pct - input.oxygen_pct) > JOINT_TOLERANCE.oxygen_pct) continue
    if (Math.abs(row.pressure_kpa - input.pressure_kpa) > JOINT_TOLERANCE.pressure_kpa) continue
    if (Math.abs(row.flow_cm_s - input.flow_cm_s) > JOINT_TOLERANCE.flow_cm_s) continue
    const d = row.distance ?? 0
    if (d < bestD) { best = row; bestD = d }
  }
  return best
}

export function coverageStatement(input: JointRow & { gravity_g: number }, rows: JointRow[], inRange: boolean): { kind: 'exact' | 'box' | 'unsupported'; text: string; match: JointRow | null } {
  if (input.gas_mix && input.gas_mix !== 'air') {
    return { kind: 'unsupported', match: null, text: 'The loaded flame-spread tests used oxygen/nitrogen atmospheres. This gas mix has no joint match in that set, and the model does not estimate a spread regime for it.' }
  }
  const match = findJointMatch(input, rows)
  if (match) {
    const who = match.report_id ? ` See ${match.report_id}${match.source_location ? ` (${match.source_location})` : ''}.` : ''
    return {
      kind: 'exact',
      match,
      text: `A loaded test matches this joint combination within the workspace tolerances (oxygen ±${JOINT_TOLERANCE.oxygen_pct} percentage points, pressure ±${JOINT_TOLERANCE.pressure_kpa} kPa, airflow ±${JOINT_TOLERANCE.flow_cm_s} cm/s, same material, gravity, and flow direction).${who}`,
    }
  }
  if (inRange) {
    return { kind: 'box', match: null, text: 'Each input sits inside the separate minimum and maximum published for this material and gravity, so the statistical model will estimate a class. Those extremes are not a jointly tested combination. Use the ranked experiments as the evidence.' }
  }
  return { kind: 'unsupported', match: null, text: 'These conditions are outside the loaded tests. There is no model estimate. Nearby experiments, when listed, are context only.' }
}

export type ProvenanceGroup = { report_id: string; facility: string; source_title: string; source_url: string; n: number }

export function provenanceByReport(rows: { gravity_g?: number; report_id: string; facility?: string; source_title?: string; source_url?: string }[], gravity: number): ProvenanceGroup[] {
  const map = new Map<string, ProvenanceGroup>()
  for (const row of rows) {
    if (Math.abs((row.gravity_g ?? 0) - gravity) > JOINT_TOLERANCE.gravity_g) continue
    const key = `${row.report_id}|${row.facility ?? ''}`
    const cur = map.get(key)
    if (cur) cur.n += 1
    else map.set(key, { report_id: row.report_id, facility: row.facility || 'Facility not recorded on the row', source_title: row.source_title || '', source_url: row.source_url || '', n: 1 })
  }
  return [...map.values()].sort((a, b) => b.n - a.n || a.report_id.localeCompare(b.report_id))
}

const ACTIVITY_KINDS: ActivityKind[] = ['created', 'question', 'scenario', 'comparison', 'notes', 'imported', 'exported']

/** Rebuild a document from storage. Drops records that fail validation.
 *  Returns an error when the shell is valid but every investigation is unreadable,
 *  so the caller can leave the original bytes in place. */
export function restoreDocument(value: unknown, deps: Deps): { doc: WorkspaceDocument; warnings: string[]; dropped: number } | { error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Workspace value is not an object.' }
  const body = value as Record<string, unknown>
  if (body.schema !== WORKSPACE_SCHEMA || body.schemaVersion !== SCHEMA_VERSION) return { error: 'Workspace schema is missing or not version 1.' }
  if (!Array.isArray(body.investigations)) return { error: 'Workspace investigations are missing.' }
  const fresh = blankDocument(deps)
  const ownerOk = body.owner && typeof body.owner === 'object' && (body.owner as GuestOwner).kind === 'guest' && typeof (body.owner as GuestOwner).id === 'string' && ID_RE.test((body.owner as GuestOwner).id)
  const owner = ownerOk
    ? { id: (body.owner as GuestOwner).id, kind: 'guest' as const, label: 'Guest on this browser', createdAt: text((body.owner as GuestOwner).createdAt, 40) || fresh.owner.createdAt }
    : fresh.owner
  const warnings: string[] = []
  if (!ownerOk) warnings.push('The guest record was incomplete, so a new guest id was created for this browser.')
  const investigations: Investigation[] = []
  let dropped = 0
  for (const item of body.investigations) {
    const restored = restoreInvestigation(item, owner.id, deps)
    if ('error' in restored) { dropped += 1; warnings.push(restored.error); continue }
    warnings.push(...restored.warnings)
    investigations.push(restored.inv)
  }
  if (body.investigations.length > 0 && investigations.length === 0) return { error: 'Every investigation in the saved workspace failed validation.' }
  const last = typeof body.lastOpenedId === 'string' && investigations.some(i => i.id === body.lastOpenedId) ? body.lastOpenedId : investigations[0]?.id ?? null
  return {
    doc: { schema: WORKSPACE_SCHEMA, schemaVersion: SCHEMA_VERSION, owner, lastOpenedId: last, investigations, notice: STORAGE_NOTICE },
    warnings,
    dropped,
  }
}

function restoreInvestigation(value: unknown, ownerId: string, deps: Deps): { inv: Investigation; warnings: string[] } | { error: string } {
  const picked = pickInvestigation(value, ownerId, deps)
  if ('error' in picked) return picked
  const raw = value as Record<string, unknown>
  const activityIn = Array.isArray(raw.activity) ? raw.activity : []
  const activityOut: Activity[] = []
  for (const item of activityIn) {
    if (!item || typeof item !== 'object') continue
    const a = item as Record<string, unknown>
    const summary = text(a.summary, 180)
    const at = text(a.at, 40)
    if (!summary || !at || typeof a.kind !== 'string' || !ACTIVITY_KINDS.includes(a.kind as ActivityKind)) continue
    activityOut.push({
      id: typeof a.id === 'string' && ID_RE.test(a.id) ? a.id : deps.id(),
      at,
      investigationId: picked.inv.id,
      kind: a.kind as ActivityKind,
      summary,
    })
  }
  return { inv: { ...picked.inv, activity: activityOut.slice(-LIMITS.activity), updatedAt: text(raw.updatedAt, 40) || picked.inv.updatedAt }, warnings: picked.warnings }
}

export function similarityPercent(distance: number): number {
  if (!Number.isFinite(distance) || distance < 0) return 0
  return Math.round(100 / (1 + distance))
}

export function evidenceQuestion(conditions: ScenarioConditions): string {
  const place = conditions.envId === 'moon' ? 'lunar gravity' : conditions.envId === 'mars' ? 'Martian gravity' : conditions.envId === 'earth' ? 'Earth gravity' : 'microgravity'
  return `What did published NASA combustion experiments report about ${conditions.material.replace(/_/g, ' ')} in ${place} near ${conditions.oxygen_pct}% oxygen?`
}
