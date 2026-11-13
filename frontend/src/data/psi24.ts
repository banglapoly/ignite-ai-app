import data from './psi24.json'

export interface PsiInvestigation {
  accession: string
  acronym: string
  title: string
  objectives: string
  keywords: string
  platform: string
  projectType: string
  subarea: string
  hardware: string
  url: string
}

export interface OfficialResource {
  group: string
  title: string
  url: string
  note: string
  primary: boolean
}

export const PSI24 = data.investigations as PsiInvestigation[]
export const OFFICIAL_RESOURCES = data.officialResources as OfficialResource[]
export const TRAINING_LINK = data.trainingLink as Record<string, string>
export const TRAINING_LINK_DEFAULT = data.trainingLinkDefault as string

export function trainingNote(accession: string) {
  return TRAINING_LINK[accession] ?? TRAINING_LINK_DEFAULT
}

export function objectiveSummary(text: string, max = 320) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const dot = cut.lastIndexOf('. ')
  return dot > 80 ? cut.slice(0, dot + 1) : `${cut.trimEnd()}...`
}
