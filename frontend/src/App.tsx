import { useEffect, useState } from 'react'
import type { ModelCard } from './lib/api'
import { getJSON } from './lib/api'
import { usePath } from './lib/router'
import Landing from './pages/Landing'
import Demo from './pages/Demo'

export default function App() {
  const path = usePath()
  const [card, setCard] = useState<ModelCard | null>(null)
  useEffect(() => { getJSON<ModelCard>('/model').then(setCard).catch(() => {}) }, [])
  useEffect(() => { document.title = path.startsWith('/demo') ? 'IGNITE-AI · Space Fire Safety Tool' : 'IGNITE-AI · Predictive Fire Safety Analytics for Space Station Orbit & Rocket Transit' }, [path])
  return path.startsWith('/demo') ? <Demo card={card} /> : <Landing card={card} />
}
