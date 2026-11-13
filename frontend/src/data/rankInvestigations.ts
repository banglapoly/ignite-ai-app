import type { PsiInvestigation } from './psi24'

export interface RankQuery {
  gravityG: number
  flowCmS: number
  flowDirection: string
  material: string
}

export interface RankHit {
  score: number
  matches: string[]
}

/** Words taken from the material label. A hit counts only when that word is in the PSI text. */
const MATERIAL_WORDS: Record<string, string[]> = {
  SIBAL_fabric: ['sibal', 'cotton', 'fiberglass', 'fabric'],
  cellulose_thin: ['cellulose', 'kimwipe', 'kimwipes'],
  cellulose_double: ['cellulose', 'kimwipe', 'kimwipes'],
  filter_paper: ['filter paper', 'paper'],
  PMMA_thick: ['pmma', 'acrylic'],
  cotton_jersey: ['cotton', 'jersey', 'fabric'],
  'Nomex_HT90-40': ['nomex'],
  Ultem_1000: ['ultem'],
  Mylar_G: ['mylar'],
  silicone: ['silicone'],
}

function textOf(card: PsiInvestigation) {
  return [card.title, card.acronym, card.objectives, card.keywords, card.platform, card.projectType, card.subarea, card.hardware].join('\n')
}

function hasPhrase(text: string, phrase: string) {
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^a-z0-9])${esc}(?:[^a-z0-9]|$)`, 'i').test(text)
}

/**
 * Rank is a sum of word matches between the current conditions and fields that
 * exist on the PSI record. It is not a flammability score.
 * Gravity, material, and flow matches are 2 points. Oxygen is 1 point.
 */
export function rankInvestigation(card: PsiInvestigation, query: RankQuery): RankHit {
  const text = textOf(card)
  const found: { label: string; points: number }[] = []
  const add = (label: string, points: number, ok: boolean) => { if (ok) found.push({ label, points }) }

  if (query.gravityG <= 0.01) add('microgravity', 2, hasPhrase(text, 'microgravity') || hasPhrase(text, 'micro-gravity'))
  else if (query.gravityG >= 0.99) add('ground investigation', 2, hasPhrase(text, 'ground investigation') || hasPhrase(text, 'normal gravity'))
  else add('partial gravity', 2, hasPhrase(text, 'partial gravity') || hasPhrase(text, 'partial-gravity') || hasPhrase(text, 'lunar') || hasPhrase(text, 'martian'))

  for (const word of MATERIAL_WORDS[query.material] ?? []) add(word, 2, hasPhrase(text, word))

  if (query.flowCmS > 0.5) {
    const flow = hasPhrase(text, 'flow') || hasPhrase(text, 'coflow') || hasPhrase(text, 'co-flow') || hasPhrase(text, 'velocity')
    add('flow', 2, flow)
  }
  if (query.flowDirection === 'quiescent') add('quiescent', 2, hasPhrase(text, 'quiescent') || hasPhrase(text, 'still air'))
  if (query.flowDirection === 'concurrent') add('concurrent', 2, hasPhrase(text, 'concurrent'))
  if (query.flowDirection === 'opposed') add('opposed', 2, hasPhrase(text, 'opposed'))
  add('oxygen', 1, hasPhrase(text, 'oxygen') || hasPhrase(text, 'o2'))

  return { score: found.reduce((sum, hit) => sum + hit.points, 0), matches: found.map(hit => hit.label) }
}
