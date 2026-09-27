/* In-browser version of Ask IGNITE-AI (backend/src/compute/kb.py), used when no backend is reachable.
   Same knowledge base (every passage exported to kb.json), same TF-IDF settings (1-2 grams,
   sublinear tf, English stop words, smooth idf, l2 norm), same query expansion, decline rules
   and extractive answer: only verbatim quotes and real table rows, each with a numbered NASA source. */
import type { AskAnswer } from '../api'
import { staticJSON } from './data'

type Span = [number, number] | string | null
interface KB {
  settings: { min_score: number; min_coverage: number; stop_words: string[] }
  acronyms: Record<string, string>; domain: string[]; generic: string[]; expand: Record<string, string>
  compare: Record<string, NonNullable<AskAnswer['comparison']>[number]>
  passages: [string, string, string, string, string, string, Span, Span][]
}
interface Passage { id: string; kind: string; title: string; text: string; url: string; source: string; quote: string | null; data: string | null }
type Vec = Map<string, number>

const TOKEN = /(?<![\p{L}\p{N}_])[\p{L}\p{N}_](?:[\p{L}\p{N}_-]*[\p{L}\p{N}_])?/gu   // sklearn (?u)\b[\w][\w\-]*\b

class Index {
  ps: Passage[]; stop: Set<string>; idf = new Map<string, number>(); docs: Vec[] = []; maxIdf = 0
  constructor(public kb: KB) {
    const span = (t: string, s: Span) => s === null ? null : typeof s === 'string' ? s : t.slice(s[0], s[1])
    this.ps = kb.passages.map(([id, kind, title, text, url, source, q, d]) => ({ id, kind, title, text, url, source, quote: span(text, q), data: span(text, d) }))
    this.stop = new Set(kb.settings.stop_words)
    const tfs = this.ps.map(p => this.counts(p.title + '. ' + p.text))
    const df = new Map<string, number>()
    for (const tf of tfs) for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1)
    const n = tfs.length
    for (const [t, c] of df) { const v = Math.log((1 + n) / (1 + c)) + 1; this.idf.set(t, v); if (v > this.maxIdf) this.maxIdf = v }
    this.docs = tfs.map(tf => this.weigh(tf))
  }
  counts(text: string): Map<string, number> {
    const toks = (text.toLowerCase().match(TOKEN) ?? []).filter(t => !this.stop.has(t))
    const c = new Map<string, number>()
    for (let i = 0; i < toks.length; i++) {
      c.set(toks[i], (c.get(toks[i]) ?? 0) + 1)
      if (i + 1 < toks.length) { const b = toks[i] + ' ' + toks[i + 1]; c.set(b, (c.get(b) ?? 0) + 1) }
    }
    return c
  }
  /** sublinear tf * idf, l2-normalised; terms outside the fitted vocabulary are ignored (like transform) */
  weigh(tf: Map<string, number>): Vec {
    const v: Vec = new Map()
    let norm = 0
    for (const [t, c] of tf) {
      const idf = this.idf.get(t)
      if (idf === undefined) continue
      const w = (1 + Math.log(c)) * idf
      v.set(t, w); norm += w * w
    }
    norm = Math.sqrt(norm)
    if (norm > 0) for (const [t, w] of v) v.set(t, w / norm)
    return v
  }
  vec(text: string): Vec { return this.weigh(this.counts(text)) }
}
const dot = (a: Vec, b: Vec) => { let s = 0; const [x, y] = a.size < b.size ? [a, b] : [b, a]; for (const [t, w] of x) { const u = y.get(t); if (u) s += w * u } return s }

let indexP: Promise<Index> | null = null
const getIndex = () => (indexP ??= staticJSON<KB>('kb').then(kb => new Index(kb)))

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export async function localAsk(question: string, k = 6): Promise<AskAnswer> {
  const ix = await getIndex()
  const kb = ix.kb
  const MIN_SCORE = kb.settings.min_score, MIN_COVERAGE = kb.settings.min_coverage
  const q = (question || '').trim().slice(0, 500)
  const base = { question: q, mode: 'extractive', generator: 'none (extractive quotes)' }
  if (q.length < 3) return { ...base, answered: false, answer: 'Please type a question.', citations: [], passages: [] }

  const expand = (s: string) => s + ' ' + (s.toLowerCase().match(/[a-z0-9-]+/g) ?? []).filter(t => t in kb.expand).map(t => kb.expand[t]).join(' ')
  const qv = ix.vec(expand(q))

  // retrieve (kb.retrieve): weighted cosine, top k*3, at most 3 passages per source URL
  const sims = ix.docs.map((d, i) => {
    const p = ix.ps[i]
    return dot(qv, d) * (p.kind === 'fact' ? 1.25 : (p.id.endsWith('-meta') || p.id.includes('-pubs-')) ? 0.8 : 1.0)
  })
  const order = sims.map((_, i) => i).sort((a, b) => sims[b] - sims[a]).slice(0, k * 3)
  let hits: (Passage & { score: number })[] = []
  const perSrc = new Map<string, number>()
  for (const i of order) {
    const p = ix.ps[i]
    if ((perSrc.get(p.url) ?? 0) >= 3) continue
    perSrc.set(p.url, (perSrc.get(p.url) ?? 0) + 1)
    hits.push({ ...p, score: Math.round(sims[i] * 1e4) / 1e4 })
    if (hits.length >= k) break
  }
  const top = hits.length ? hits[0].score : 0

  // coverage (kb._coverage)
  const generic = new Set(kb.generic)
  let cov = 0
  if (hits.length) {
    const toks = (q.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) ?? []).filter(t => !ix.stop.has(t) && !generic.has(t) && t.length > 2)
    const body = hits.slice(0, 4).map(h => (h.title + ' ' + h.text).toLowerCase()).join(' ')
    let tot = 0, got = 0
    for (const t of toks) {
      const w = ix.idf.get(t) ?? ix.maxIdf
      tot += w
      for (const a of [t, ...(kb.expand[t] ?? '').split(' ').filter(Boolean)]) {
        const stem = a.endsWith('s') && a.length > 4 ? a.slice(0, -1) : a
        if (new RegExp('(?<![a-z0-9])' + esc(stem)).test(body)) { got += w; break }
      }
    }
    cov = tot ? got / tot : 0
  }
  const coverage = Math.round(cov * 1000) / 1000

  // acronyms and domain check (kb._detect_acronyms, kb._is_domain)
  const keys: string[] = []
  let ql = ' ' + q.toLowerCase() + ' '
  for (const term of Object.keys(kb.acronyms).sort((a, b) => b.length - a.length)) {
    const re = new RegExp('(?<![\\w-])' + esc(term) + '(?![\\w-])', 'g')
    if (re.test(ql)) { const key = kb.acronyms[term]; if (!keys.includes(key)) keys.push(key); ql = ql.replace(re, ' ') }
  }
  const domain = new Set(kb.domain)
  const isDomain = (q.toLowerCase().match(/[a-z0-9-]+/g) ?? []).some(t => !ix.stop.has(t) && domain.has(t)) || keys.length > 0

  if (top < MIN_SCORE || !isDomain || cov < MIN_COVERAGE) {
    return { ...base, coverage, answered: false, top_score: top, citations: [], passages: [],
      answer: `I can't answer that from the IGNITE-AI knowledge base: nothing sufficiently relevant was retrieved (best match score ${top.toFixed(2)}, threshold ${MIN_SCORE}; share of your question's key words found ${Math.round(cov * 100)}%, need ${Math.round(MIN_COVERAGE * 100)}%). I only answer from NASA combustion and fire-safety sources (NTRS reports, PSI investigations and tables, the curated experiment rows).` }
  }
  hits = hits.filter(h => h.score >= MIN_SCORE * 0.6)

  // comparison table when two or more investigations are named (kb._compare)
  let comparison: AskAnswer['comparison'] = null
  if (keys.length >= 2) {
    comparison = []
    for (const key of keys) {
      if (kb.compare[key]) { comparison.push(kb.compare[key]); continue }
      const best = hits.find(h => (h.title + h.text).toLowerCase().includes(key))
      if (best) {
        const s = sentences(best.text)
        comparison.push({ name: key !== 'saffire' ? key.toUpperCase() : 'Saffire', title: best.title, platform: '', hardware: '', dates: '', area: '',
          objective: s.length ? s[0] : best.text.slice(0, 300), tables: [], n_publications: null, url: best.url })
      }
    }
  }

  // best sentences (kb._best_sentences)
  const wantsData = /\b(data|table|tests?|how many|number|rows?|rate|fast|speed|mm|kpa|percent|%)\b/.test(q.toLowerCase())
  const cands: [number, string, number, boolean][] = []
  hits.forEach((h, hi) => {
    const units: [string, boolean][] = h.quote ? sentences(h.quote).map(s => [s, true]) : []
    if (h.quote && !units.length && h.quote.length > 15) units.push([h.quote, true])
    if (h.data) units.push([h.data, false])
    for (const [s, verb] of units) {
      if (s.split(/\s+/).filter(Boolean).length < 6) continue
      let sc = dot(qv, ix.vec(s))
      const named = keys.some(kk => h.title.toLowerCase().includes(kk.toLowerCase()) || h.source.toLowerCase().includes(kk.toLowerCase()))
      if (!verb && !wantsData && !named) sc *= 0.6
      cands.push([sc + 0.15 * h.score, s, hi, verb])
    }
  })
  cands.sort((a, b) => b[0] - a[0])
  const picked: [string, number, boolean][] = []
  const usedSrc = new Map<number, number>(), seen = new Set<string>()
  for (const [sc, s, hi, verb] of cands) {
    const key = s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 90)
    if (seen.has(key) || (usedSrc.get(hi) ?? 0) >= 2 || sc <= 0.02) continue
    seen.add(key); usedSrc.set(hi, (usedSrc.get(hi) ?? 0) + 1)
    picked.push([s, hi, verb])
    if (picked.length >= 4) break
  }
  if (!picked.length) return { ...base, coverage, answered: false, top_score: top, citations: [], passages: [],
    answer: "I found related documents but no sentence in them answers this question directly, so I won't guess." }
  const used = [...new Set(picked.map(p => p[1]))].sort((a, b) => a - b)
  const renum = new Map(used.map((hi, n) => [hi, n + 1]))
  const bullets = picked.map(([s, hi, verb]) => verb ? `\u201c${s}\u201d [${renum.get(hi)}]` : `Data: ${s} [${renum.get(hi)}]`)
  return {
    ...base, coverage, answered: true, top_score: top,
    answer: "From the retrieved NASA sources (quotes are verbatim; 'Data' lines restate real table rows):\n" + bullets.map(b => '\u2022 ' + b).join('\n'),
    bullets: picked.map(([s, hi, verb]) => ({ text: s, n: renum.get(hi)!, verbatim: verb })),
    comparison,
    citations: used.map(hi => ({ n: renum.get(hi)!, label: hits[hi].source, url: hits[hi].url, kind: hits[hi].kind, score: hits[hi].score })),
    passages: hits.map((h, i) => ({ n: renum.get(i) ?? null, title: h.title, text: h.text.slice(0, 700), url: h.url, source: h.source, kind: h.kind, score: h.score })),
  }
}

/** kb._sentences */
function sentences(text: string): string[] {
  const t = (text || '').replace(/\s+/g, ' ').trim()
  return t.split(/(?<=[.!?])\s+(?=[A-Z0-9("'])/).map(p => p.trim()).filter(p => p.length > 25)
}
