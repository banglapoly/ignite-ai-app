/** Dataset catalogs this build knows about.
 *  The workspace and the model read the bundled snapshot only.
 *  A later official release is a new catalog entry, not a guessed result. */

export type CatalogSource = {
  id: string
  title: string
  state: 'loaded' | 'not-loaded'
  detail: string
}

export const CATALOGS: CatalogSource[] = [
  {
    id: 'bundled-nasa-snapshot',
    title: 'Bundled NASA snapshot',
    state: 'loaded',
    detail: 'Flame-spread rows, the model card, environment notes, PSI metadata, and Ask passages shipped in static-api. Counts in the interface are read from those files.',
  },
  {
    id: 'official-release',
    title: 'Forthcoming official data',
    state: 'not-loaded',
    detail: 'Not connected. This prototype does not fill, estimate, or describe results from a data release that has not been ingested. Register it later by exporting a new snapshot into the same files.',
  },
]
