import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  ENV_GRAVITY,
  JOINT_TOLERANCE,
  LIMITS,
  PARAMETERS_SCHEMA,
  SCHEMA_VERSION,
  QUARANTINE_KEY,
  STORAGE_KEY,
  WORKSPACE_SCHEMA,
  activateScenario,
  addInvestigation,
  addMaterialComparison,
  addScenario,
  adoptImport,
  blankDocument,
  coverageStatement,
  evidenceQuestion,
  findJointMatch,
  fullDocument,
  nextStep,
  parameterDocument,
  parseShare,
  patchInvestigation,
  provenanceByReport,
  removeInvestigation,
  shareQuery,
  similarityPercent,
  type Deps,
  type ScenarioConditions,
} from '../src/lib/workspace/logic.ts'
import { loadDocument, memoryKv, persistDocument } from '../src/lib/workspace/store.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

function deps(): Deps {
  let n = 0
  return {
    now: () => `2026-11-09T00:00:${String(n).padStart(2, '0')}Z`,
    id: () => `id-${String(++n).padStart(8, '0')}`,
  }
}

const moon: ScenarioConditions = {
  envId: 'moon',
  gravity_g: 0.165,
  oxygen_pct: 21,
  pressure_kpa: 101.3,
  flow_cm_s: 5,
  material: 'SIBAL_fabric',
  flow_direction: 'concurrent',
  gas_mix: 'air',
}

test('saved investigation reloads from the storage adapter', () => {
  const d = deps()
  const kv = memoryKv()
  const loaded = loadDocument(kv, d)
  assert.equal(loaded.persistence, 'saved')
  const created = addInvestigation(loaded.doc, { title: 'Cabin oxygen question', question: 'Which tests are near 21% oxygen at lunar g?', mode: 'guided' }, d)
  assert.ok(!('error' in created))
  if ('error' in created) return
  const withScenario = addScenario(created.doc, created.id, moon, 'Lunar SIBAL', d)
  assert.ok(!('error' in withScenario))
  if ('error' in withScenario) return
  assert.equal(persistDocument(kv, withScenario).ok, true)
  const again = loadDocument(kv, deps())
  assert.equal(again.persistence, 'saved')
  assert.equal(again.doc.investigations.length, 1)
  const inv = again.doc.investigations[0]
  assert.equal(inv.title, 'Cabin oxygen question')
  assert.equal(inv.question, 'Which tests are near 21% oxygen at lunar g?')
  assert.equal(inv.scenarios.length, 1)
  assert.equal(inv.scenarios[0].conditions.material, 'SIBAL_fabric')
  assert.equal(inv.scenarios[0].conditions.gravity_g, ENV_GRAVITY.moon)
  assert.equal(inv.ownerId, again.doc.owner.id)
})

test('corrupt storage is kept and not overwritten until forced', () => {
  const kv = memoryKv({ [STORAGE_KEY]: '{not json' })
  const loaded = loadDocument(kv, deps())
  assert.equal(loaded.persistence, 'held')
  assert.match(loaded.message || '', /not deleted/i)
  assert.equal(kv.dump()[STORAGE_KEY], '{not json')
  assert.equal(kv.dump()[QUARANTINE_KEY], '{not json')
  const blocked = persistDocument(kv, loaded.doc, { held: true })
  assert.equal(blocked.ok, false)
  if (blocked.ok) return
  assert.equal(blocked.code, 'held')
  assert.equal(kv.dump()[STORAGE_KEY], '{not json')
  const replaced = persistDocument(kv, loaded.doc, { held: true, force: true })
  assert.equal(replaced.ok, true)
  const parsed = JSON.parse(kv.dump()[STORAGE_KEY])
  assert.equal(parsed.schema, WORKSPACE_SCHEMA)
  assert.equal(parsed.schemaVersion, SCHEMA_VERSION)
})

test('blocked storage stays in memory', () => {
  const kv = memoryKv({}, { get: 'throw' })
  const loaded = loadDocument(kv, deps())
  assert.equal(loaded.persistence, 'memory')
  assert.match(loaded.message || '', /blocked/i)
})

test('quota failure is reported and does not claim the write succeeded', () => {
  const d = deps()
  const kv = memoryKv({}, { set: 'quota' })
  const loaded = loadDocument(kv, d)
  assert.equal(loaded.persistence, 'memory')
  const created = addInvestigation(loaded.doc, { title: 'Quota case', question: 'Does storage fail closed?', mode: 'guided' }, d)
  assert.ok(!('error' in created))
  if ('error' in created) return
  const wrote = persistDocument(kv, created.doc)
  assert.equal(wrote.ok, false)
  if (wrote.ok) return
  assert.equal(wrote.code, 'quota')
})

test('invalid and oversized imports are rejected', () => {
  const d = deps()
  const doc = blankDocument(d)
  const bad = adoptImport(doc, '{"schema":"ignite.workspace","schemaVersion":2,"investigations":[]}', d)
  assert.ok('error' in bad)
  const junk = adoptImport(doc, '[]', d)
  assert.ok('error' in junk)
  const huge = adoptImport(doc, '{"schema":"ignite.workspace"}'.padEnd(LIMITS.importChars + 1, ' '), d)
  assert.ok('error' in huge)
  const brokenInv = adoptImport(doc, JSON.stringify({ schema: WORKSPACE_SCHEMA, schemaVersion: 1, investigations: [{ title: 'ok' }, { title: '' }] }), d)
  assert.ok('error' in brokenInv)
})

test('full backup round-trips notes; parameter export and share links omit them', () => {
  const d = deps()
  let doc = blankDocument(d)
  const created = addInvestigation(doc, { title: 'Notes case', question: 'Is the joint combination tested?', mode: 'guided' }, d)
  assert.ok(!('error' in created))
  if ('error' in created) return
  doc = created.doc
  const noted = patchInvestigation(doc, created.id, { notes: 'PRIVATE-NOTE-XYZ only on this browser' }, d, { kind: 'notes', summary: 'Private notes updated' })
  assert.ok(!('error' in noted))
  if ('error' in noted) return
  const saved = addScenario(noted, created.id, moon, 'Point A', d)
  assert.ok(!('error' in saved))
  if ('error' in saved) return
  const compared = addMaterialComparison(saved, created.id, ['SIBAL_fabric', 'Mylar_G'], moon, 'Two materials', d)
  assert.ok(!('error' in compared))
  if ('error' in compared) return
  const inv = compared.investigations[0]
  const full = JSON.stringify(fullDocument(compared, '2026-11-09T00:00:00Z'))
  assert.match(full, /PRIVATE-NOTE-XYZ/)
  const params = parameterDocument(inv, '2026-11-09T00:00:00Z')
  const paramText = JSON.stringify(params)
  assert.equal(params.schema, PARAMETERS_SCHEMA)
  assert.equal(params.includesPrivateNotes, false)
  assert.equal(paramText.includes('PRIVATE-NOTE-XYZ'), false)
  assert.equal(paramText.includes(inv.question), false)
  assert.equal(params.conditions.length, 1)
  assert.deepEqual(params.comparisons[0].materials, ['SIBAL_fabric', 'Mylar_G'])
  assert.equal(params.comparisons[0].shared.oxygen_pct, moon.oxygen_pct)
  assert.equal('material' in params.comparisons[0].shared, false)
  const link = shareQuery(inv.scenarios[0].conditions)
  assert.equal(link.includes('PRIVATE-NOTE-XYZ'), false)
  assert.equal(link.includes('question'), false)
  assert.match(link, /share=1/)
  assert.match(link, /mat=SIBAL_fabric/)
  const parsed = parseShare(link.split('?')[1])
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.conditions.envId, 'moon')
  assert.equal(parsed.conditions.gravity_g, 0.165)
  const rewritten = JSON.parse(full) as { investigations: { ownerId: string }[] }
  rewritten.investigations[0].ownerId = 'id-99999999'
  const imported = adoptImport(blankDocument(deps()), JSON.stringify(rewritten), deps())
  assert.ok(!('error' in imported))
  if ('error' in imported) return
  assert.equal(imported.doc.investigations[0].notes, 'PRIVATE-NOTE-XYZ only on this browser')
  assert.equal(imported.doc.investigations[0].ownerId, imported.doc.owner.id)
  assert.equal(imported.doc.investigations[0].importedFromOwnerId, 'id-99999999')
  assert.notEqual(imported.doc.investigations[0].ownerId, 'id-99999999')
  const paramImport = adoptImport(blankDocument(deps()), paramText, deps())
  assert.ok(!('error' in paramImport))
  if ('error' in paramImport) return
  assert.equal(paramImport.doc.investigations[0].notes, '')
  assert.equal(paramImport.doc.investigations[0].question, '')
  assert.equal(paramImport.doc.investigations[0].scenarios.length, 1)
})

test('a single bad investigation is dropped and the valid one reloads', () => {
  const d = deps()
  const doc = blankDocument(d)
  const created = addInvestigation(doc, { title: 'Keep me', question: 'Valid', mode: 'guided' }, d)
  assert.ok(!('error' in created))
  if ('error' in created) return
  const raw = fullDocument(created.doc, d.now())
  raw.investigations.push({ title: 12 } as never)
  const kv = memoryKv({ [STORAGE_KEY]: JSON.stringify(raw) })
  const loaded = loadDocument(kv, deps())
  assert.equal(loaded.doc.investigations.length, 1)
  assert.equal(loaded.doc.investigations[0].title, 'Keep me')
  assert.match(loaded.message || '', /could not be read/)
})

test('next step follows question, scenario, comparison, notes, then backup', () => {
  const d = deps()
  const created = addInvestigation(blankDocument(d), { title: 'Flow', question: '', mode: 'guided' }, d)
  assert.ok(!('error' in created))
  if ('error' in created) return
  let doc = created.doc
  let inv = doc.investigations[0]
  assert.equal(nextStep(inv).id, 'question')
  const asked = patchInvestigation(doc, inv.id, { question: 'What is near this point?' }, d, { kind: 'question', summary: 'Question updated' })
  assert.ok(!('error' in asked))
  if ('error' in asked) return
  doc = asked
  inv = doc.investigations[0]
  assert.equal(nextStep(inv).id, 'conditions')
  const saved = addScenario(doc, inv.id, moon, 'A', d)
  assert.ok(!('error' in saved))
  if ('error' in saved) return
  doc = saved
  inv = doc.investigations[0]
  assert.equal(nextStep(inv).id, 'compare')
  const one = addMaterialComparison(doc, inv.id, ['SIBAL_fabric'], moon, 'Too few', d)
  assert.ok('error' in one)
  const compared = addMaterialComparison(doc, inv.id, ['SIBAL_fabric', 'Mylar_G'], moon, 'Pair', d)
  assert.ok(!('error' in compared))
  if ('error' in compared) return
  doc = compared
  inv = doc.investigations[0]
  assert.equal(inv.comparisons[0].shared.oxygen_pct, moon.oxygen_pct)
  assert.equal(inv.comparisons[0].shared.pressure_kpa, moon.pressure_kpa)
  assert.equal(inv.comparisons[0].shared.flow_cm_s, moon.flow_cm_s)
  assert.equal(inv.comparisons[0].shared.gravity_g, moon.gravity_g)
  assert.equal(nextStep(inv).id, 'notes')
  const noted = patchInvestigation(doc, inv.id, { notes: 'The box is not a joint test.' }, d, { kind: 'notes', summary: 'Private notes updated' })
  assert.ok(!('error' in noted))
  if ('error' in noted) return
  assert.equal(nextStep(noted.investigations[0]).id, 'backup')
  const removed = removeInvestigation(noted, inv.id)
  assert.equal(removed.investigations.length, 0)
})

test('joint matches, unsupported gas, and min/max boxes are distinguished', () => {
  const rows = [
    { ...moon, row_id: 'E1', report_id: 'NTRS 1', source_location: 'Table 1', distance: 0.01, outcome: 'spread' },
    { ...moon, oxygen_pct: 34, row_id: 'E2', report_id: 'NTRS 2', distance: 0.4 },
  ]
  const exact = findJointMatch(moon, rows)
  assert.equal(exact?.row_id, 'E1')
  const near = coverageStatement(moon, rows, true)
  assert.equal(near.kind, 'exact')
  const off = coverageStatement({ ...moon, oxygen_pct: moon.oxygen_pct + JOINT_TOLERANCE.oxygen_pct + 0.05 }, rows, true)
  assert.equal(off.kind, 'box')
  assert.match(off.text, /not a jointly tested combination/)
  const gas = coverageStatement({ ...moon, gas_mix: 'co2' }, rows, false)
  assert.equal(gas.kind, 'unsupported')
  assert.equal(gas.match, null)
  const outside = coverageStatement({ ...moon, material: 'unobtainium' }, [], false)
  assert.equal(outside.kind, 'unsupported')
  assert.equal(similarityPercent(0), 100)
  assert.equal(similarityPercent(1), 50)
})

test('parameter links cannot smuggle a gravity that the preset does not have', () => {
  const bad = parseShare('share=1&env=moon&o2=21&p=101&v=5&mat=SIBAL_fabric&dir=concurrent&gas=air')
  assert.equal(bad.ok, true)
  if (!bad.ok) return
  assert.equal(bad.conditions.gravity_g, ENV_GRAVITY.moon)
  const refused = parseShare('share=1&env=pluto&o2=21&p=101&v=5&mat=SIBAL_fabric&dir=concurrent&gas=air')
  assert.equal(refused.ok, false)
})

test('activating a scenario and the retrieval prompt stay on conditions', () => {
  const d = deps()
  const created = addInvestigation(blankDocument(d), { title: 'History', question: 'Reload', scenario: moon, mode: 'sandbox' }, d)
  assert.ok(!('error' in created))
  if ('error' in created) return
  const second = addScenario(created.doc, created.id, { ...moon, oxygen_pct: 18 }, 'Lower oxygen', d)
  assert.ok(!('error' in second))
  if ('error' in second) return
  const active = second.investigations[0].scenarios[0].id
  const back = activateScenario(second, created.id, active, d)
  assert.ok(!('error' in back))
  if ('error' in back) return
  assert.equal(back.investigations[0].activeScenarioId, active)
  const q = evidenceQuestion(moon)
  assert.match(q, /SIBAL fabric/)
  assert.match(q, /lunar gravity/)
  assert.equal(q.includes('PRIVATE'), false)
})

test('loaded partial-gravity rows cite facilities and environment presets match the logic map', () => {
  const root = path.resolve(here, '..')
  const experiments = JSON.parse(fs.readFileSync(path.join(root, 'public/static-api/experiments.json'), 'utf8'))
  const environments = JSON.parse(fs.readFileSync(path.join(root, 'public/static-api/environments.json'), 'utf8'))
  const model = JSON.parse(fs.readFileSync(path.join(root, 'public/static-api/model.json'), 'utf8'))
  const rows = experiments.rows as { gravity_g: number; report_id: string; facility: string; source_url: string; source_title: string; quote: string }[]
  assert.equal(model.model.n_train, rows.length)
  assert.equal(model.model.n_sources, new Set(rows.map(r => r.report_id)).size)
  assert.ok(rows.every(r => r.quote && r.source_url.startsWith('https://ntrs.nasa.gov') && r.facility))
  for (const env of environments.environments) {
    assert.equal(env.gravity_g, ENV_GRAVITY[env.id as keyof typeof ENV_GRAVITY])
  }
  const lunar = provenanceByReport(rows, 0.165)
  const mars = provenanceByReport(rows, 0.38)
  assert.ok(lunar.length >= 1)
  assert.ok(mars.length >= 1)
  assert.equal(lunar.reduce((n, g) => n + g.n, 0), rows.filter(r => Math.abs(r.gravity_g - 0.165) < 0.001).length)
  const facilities = [...lunar, ...mars].map(g => g.facility.toLowerCase()).join(' ')
  assert.match(facilities, /drop tower|centrifuge|parabolic|shepard|white sands|rocket/)
  assert.equal(/lunar surface habitat/.test(facilities), false)
})

test('PSI investigation rank uses only words present in the metadata', async () => {
  const { rankInvestigation } = await import('../src/data/rankInvestigations.ts')
  const micro = {
    accession: 'PSI-1', acronym: 'BASS-II', title: 'Burning and Suppression of Solids',
    objectives: 'Map flame spread over a fabric in microgravity with an imposed flow.',
    keywords: 'cotton fabric', platform: 'International Space Station (ISS)', projectType: 'Microgravity Investigation',
    subarea: 'Spacecraft Fire Safety', hardware: 'Microgravity Science Glovebox', url: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-1',
  }
  const ground = { ...micro, accession: 'PSI-2', objectives: 'A ground investigation of counterflow flames.', projectType: 'Ground Investigation', keywords: '', title: 'Counterflow flames' }
  const lowG = rankInvestigation(micro, { gravityG: 0, flowCmS: 5, flowDirection: 'concurrent', material: 'SIBAL_fabric' })
  const earth = rankInvestigation(ground, { gravityG: 1, flowCmS: 0, flowDirection: 'quiescent', material: 'PMMA_thick' })
  const moon = rankInvestigation(micro, { gravityG: 0.165, flowCmS: 0, flowDirection: 'quiescent', material: 'PMMA_thick' })
  assert.ok(lowG.matches.includes('microgravity'))
  assert.ok(lowG.matches.includes('fabric'))
  assert.ok(lowG.matches.includes('flow'))
  assert.ok(earth.matches.includes('ground investigation'))
  assert.equal(earth.matches.includes('microgravity'), false)
  assert.equal(moon.matches.includes('partial gravity'), false)
  assert.equal(moon.score, 0)
  const catalog = JSON.parse(fs.readFileSync(path.join(here, '../src/data/psi24.json'), 'utf8'))
  assert.equal(catalog.investigations.length, 24)
  assert.equal(catalog.officialResources.length, 10)
  assert.match(catalog.trainingLink['PSI-25'], /143 training rows/)
  assert.match(catalog.trainingLink['PSI-99'], /PSI-99/)
  assert.match(catalog.trainingLinkDefault, /Not yet linked/)
  const partial = catalog.investigations.map((row: { objectives: string; title: string; keywords: string }) => `${row.title} ${row.objectives} ${row.keywords}`.toLowerCase()).join('\n')
  assert.equal(partial.includes('partial gravity'), false)
  assert.equal(partial.includes('lunar'), false)
})
