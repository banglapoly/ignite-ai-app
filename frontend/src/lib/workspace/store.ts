/** Browser persistence adapter for guest workspaces.
 *  The document shape lives in logic.ts. This file only reads and writes it.
 *  A future per-user server can implement the same load/persist pair. */

import {
  QUARANTINE_KEY,
  SCHEMA_VERSION,
  STORAGE_KEY,
  STORAGE_NOTICE,
  type Deps,
  type WorkspaceDocument,
  blankDocument,
  liveDeps,
  restoreDocument,
} from './logic.ts'

export interface Kv {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type Persistence = 'saved' | 'memory' | 'held'

export type LoadOutcome = {
  doc: WorkspaceDocument
  persistence: Persistence
  warnings: string[]
  message: string | null
}

export function memoryKv(init: Record<string, string> = {}, behavior?: { get?: 'throw'; set?: 'throw' | 'quota' }): Kv & { dump: () => Record<string, string> } {
  const data = { ...init }
  return {
    getItem(key) {
      if (behavior?.get === 'throw') throw new Error('storage blocked')
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null
    },
    setItem(key, value) {
      if (behavior?.set === 'throw') throw new Error('storage blocked')
      if (behavior?.set === 'quota') {
        const err = new Error('quota')
        err.name = 'QuotaExceededError'
        throw err
      }
      data[key] = value
    },
    removeItem(key) { delete data[key] },
    dump: () => ({ ...data }),
  }
}

export function browserKv(): Kv {
  return {
    getItem: key => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: key => localStorage.removeItem(key),
  }
}

function isQuota(error: unknown) {
  return error instanceof Error && (error.name === 'QuotaExceededError' || /quota/i.test(error.message))
}

export function persistDocument(kv: Kv, doc: WorkspaceDocument, opts?: { force?: boolean; held?: boolean }): { ok: true } | { ok: false; code: 'quota' | 'blocked' | 'held'; message: string } {
  if (opts?.held && !opts.force) {
    return { ok: false, code: 'held', message: 'Unreadable data is still in this browser. New work stays in memory until you choose to replace it.' }
  }
  const text = JSON.stringify(doc)
  try {
    kv.setItem(STORAGE_KEY, text)
    return { ok: true }
  } catch (error) {
    if (isQuota(error)) return { ok: false, code: 'quota', message: 'This browser refused to store more data (storage quota). Export a backup and delete an investigation, then try again. The last edit is only in memory.' }
    return { ok: false, code: 'blocked', message: 'This browser blocked local storage. You can keep working, but nothing will remain after you leave the page.' }
  }
}

export function loadDocument(kv: Kv, deps: Deps = liveDeps()): LoadOutcome {
  let raw: string | null
  try {
    raw = kv.getItem(STORAGE_KEY)
  } catch {
    return {
      doc: blankDocument(deps),
      persistence: 'memory',
      warnings: [],
      message: `${STORAGE_NOTICE} Storage is blocked in this browser, so this session cannot reload or save investigations.`,
    }
  }
  if (raw === null || raw === '') {
    const doc = blankDocument(deps)
    const wrote = persistDocument(kv, doc)
    if (!wrote.ok) {
      return { doc, persistence: 'memory', warnings: [], message: wrote.message }
    }
    return { doc, persistence: 'saved', warnings: [], message: null }
  }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { parsed = null }
  const restored = restoreDocument(parsed, deps)
  if ('error' in restored) {
    let archived = true
    try { kv.setItem(QUARANTINE_KEY, raw.slice(0, 400_000)) } catch { archived = false }
    return {
      doc: blankDocument(deps),
      persistence: 'held',
      warnings: [archived ? 'A copy of the unreadable value was also written to the quarantine key.' : 'The unreadable value could not be copied to the quarantine key. The original key was left as it was.'],
      message: `Saved workspace data could not be read (${restored.error}). It was not deleted. This session is empty and will not overwrite it until you choose Replace unreadable data.`,
    }
  }
  if (restored.dropped > 0) {
    const wrote = persistDocument(kv, restored.doc)
    return {
      doc: restored.doc,
      persistence: wrote.ok ? 'saved' : 'memory',
      warnings: restored.warnings,
      message: `${restored.dropped} saved investigation${restored.dropped === 1 ? '' : 's'} could not be read and ${wrote.ok ? 'were removed from the working copy' : 'are still only dropped in this session'}. ${restored.warnings.join(' ')}`,
    }
  }
  return { doc: restored.doc, persistence: 'saved', warnings: restored.warnings, message: restored.warnings.length ? restored.warnings.join(' ') : null }
}
