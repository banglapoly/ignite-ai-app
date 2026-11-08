import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  addInvestigation,
  addMaterialComparison,
  addScenario,
  activateScenario,
  adoptImport,
  blankDocument,
  liveDeps,
  nextStep,
  parameterDocument,
  patchInvestigation,
  recentActivity,
  removeInvestigation,
  type Investigation,
  type MaterialComparison,
  type ScenarioConditions,
  type SharedConditions,
  type StepId,
  type WorkMode,
  type WorkspaceDocument,
} from './logic'
import { browserKv, loadDocument, persistDocument, type Persistence } from './store'

type Api = {
  ready: boolean
  doc: WorkspaceDocument
  persistence: Persistence
  message: string | null
  warnings: string[]
  actionError: string | null
  clearActionError: () => void
  replaceUnreadable: () => void
  createInvestigation: (input: { title?: string; question?: string; mode?: WorkMode; scenario?: ScenarioConditions | null }) => string | null
  updateInvestigation: (id: string, patch: Partial<Pick<Investigation, 'title' | 'question' | 'notes' | 'mode' | 'step'>>, log?: { kind: 'question' | 'notes'; summary: string }) => boolean
  saveScenario: (id: string, conditions: ScenarioConditions, label: string) => boolean
  selectScenario: (id: string, scenarioId: string) => boolean
  saveComparison: (id: string, materials: string[], shared: SharedConditions, label: string) => boolean
  deleteInvestigation: (id: string) => void
  markOpened: (id: string) => void
  importText: (raw: string) => string | null
  exportFull: () => string
  exportParameters: (id: string) => string | null
}

const Ctx = createContext<Api | null>(null)
export function useWorkspace() {
  const value = useContext(Ctx)
  if (!value) throw new Error('WorkspaceProvider missing')
  return value
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const deps = useMemo(() => liveDeps(), [])
  const kv = useMemo(() => browserKv(), [])
  const [doc, setDoc] = useState<WorkspaceDocument | null>(null)
  const [persistence, setPersistence] = useState<Persistence>('memory')
  const [message, setMessage] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const held = useRef(false)
  const ready = useRef(false)

  useEffect(() => {
    const loaded = loadDocument(kv, deps)
    held.current = loaded.persistence === 'held'
    setDoc(loaded.doc)
    setPersistence(loaded.persistence)
    setMessage(loaded.message)
    setWarnings(loaded.warnings)
    ready.current = true
  }, [kv, deps])

  useEffect(() => {
    if (!ready.current || !doc) return
    const wrote = persistDocument(kv, doc, { held: held.current })
    if (!wrote.ok) {
      setPersistence(wrote.code === 'held' ? 'held' : 'memory')
      if (wrote.code !== 'held') setMessage(wrote.message)
      return
    }
    held.current = false
    setPersistence('saved')
  }, [doc, kv])

  const api = useMemo<Api>(() => {
    const current = doc ?? blankDocument(deps)
    const fail = (error: string) => { setActionError(error); return false }
    return {
      ready: doc !== null,
      doc: current,
      persistence,
      message,
      warnings,
      actionError,
      clearActionError: () => setActionError(null),
      replaceUnreadable: () => {
        if (!doc) return
        held.current = false
        const wrote = persistDocument(kv, doc, { held: true, force: true })
        if (!wrote.ok) { setMessage(wrote.message); setPersistence('memory'); return }
        setPersistence('saved')
        setMessage('The unreadable saved value was replaced by this guest workspace.')
      },
      createInvestigation: input => {
        if (!doc) return null
        const result = addInvestigation(doc, input, deps)
        if ('error' in result) { setActionError(result.error); return null }
        setDoc(result.doc)
        setActionError(null)
        return result.id
      },
      updateInvestigation: (id, patch, log) => {
        if (!doc) return fail('Workspace is still loading.')
        const result = patchInvestigation(doc, id, patch, deps, log)
        if ('error' in result) return fail(result.error)
        setDoc(result)
        setActionError(null)
        return true
      },
      saveScenario: (id, conditions, label) => {
        if (!doc) return fail('Workspace is still loading.')
        const result = addScenario(doc, id, conditions, label, deps)
        if ('error' in result) return fail(result.error)
        setDoc(result)
        setActionError(null)
        return true
      },
      selectScenario: (id, scenarioId) => {
        if (!doc) return fail('Workspace is still loading.')
        const result = activateScenario(doc, id, scenarioId, deps)
        if ('error' in result) return fail(result.error)
        setDoc(result)
        return true
      },
      saveComparison: (id, materials, shared, label) => {
        if (!doc) return fail('Workspace is still loading.')
        const result = addMaterialComparison(doc, id, materials, shared, label, deps)
        if ('error' in result) return fail(result.error)
        setDoc(result)
        setActionError(null)
        return true
      },
      deleteInvestigation: id => { if (doc) setDoc(removeInvestigation(doc, id)) },
      markOpened: id => { if (doc) setDoc({ ...doc, lastOpenedId: id }) },
      importText: raw => {
        if (!doc) return 'Workspace is still loading.'
        const result = adoptImport(doc, raw, deps)
        if ('error' in result) { setActionError(result.error); return result.error }
        setDoc(result.doc)
        setWarnings(result.warnings)
        setActionError(null)
        setMessage(result.warnings.join(' '))
        return null
      },
      exportFull: () => JSON.stringify(requireFull(current), null, 2),
      exportParameters: id => {
        const inv = current.investigations.find(i => i.id === id)
        if (!inv) return null
        const stamped = patchInvestigation(current, id, {}, deps, { kind: 'exported', summary: 'Parameter file exported' })
        if (!('error' in stamped)) setDoc(stamped)
        return JSON.stringify(parameterDocument(inv, new Date().toISOString()), null, 2)
      },
    }
  }, [doc, persistence, message, warnings, actionError, deps, kv])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

function requireFull(doc: WorkspaceDocument) {
  return {
    schema: doc.schema,
    schemaVersion: doc.schemaVersion,
    exportedAt: new Date().toISOString(),
    kind: 'guest-backup',
    ownerId: doc.owner.id,
    notice: doc.notice,
    investigations: doc.investigations,
  }
}

export function investigationNext(inv: Investigation) { return nextStep(inv) }
export function activityFeed(doc: WorkspaceDocument) { return recentActivity(doc) }
export type { StepId, MaterialComparison }
