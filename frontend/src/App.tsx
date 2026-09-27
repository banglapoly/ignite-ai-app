import { useEffect, useState } from 'react'
import type { ModelCard } from './lib/api'
import { getJSON } from './lib/api'
import { PAGES, usePath } from './lib/router'
import { SimProvider } from './lib/sim'
import { Footer, Nav, WakeBanner } from './components/Layout'
import Landing from './pages/Landing'
import Simulator from './pages/Simulator'
import Predict from './pages/Predict'
import AskPage from './pages/AskPage'
import SafetyPage from './pages/SafetyPage'
import DataPage from './pages/DataPage'
import SourcesPage from './pages/SourcesPage'
import NotFound from './pages/NotFound'

export default function App() {
  const path = usePath()
  const [card, setCard] = useState<ModelCard | null>(null)
  useEffect(() => { getJSON<ModelCard>('/model').then(setCard).catch(() => {}) }, [])
  const page = PAGES.find(p => p.path === path)
  useEffect(() => { document.title = page?.title ?? 'IGNITE-AI · Page not found' }, [path])
  let body: React.ReactNode
  switch (path) {
    case '/': body = <Landing card={card} />; break
    case '/simulator': body = <Simulator card={card} />; break
    case '/predict': body = <Predict card={card} />; break
    case '/ask': body = <AskPage />; break
    case '/safety': body = <SafetyPage />; break
    case '/data': body = <DataPage card={card} />; break
    case '/sources': body = <SourcesPage card={card} />; break
    default: body = <NotFound />
  }
  return (
    <SimProvider path={path}>
      <Nav path={path} />
      <WakeBanner />
      <main key={path}>{body}</main>
      <Footer />
    </SimProvider>
  )
}
