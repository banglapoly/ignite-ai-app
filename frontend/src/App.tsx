import { useEffect, useState } from 'react'
import type { ModelCard } from './lib/api'
import { getJSON } from './lib/api'
import { PAGES, usePath } from './lib/router'
import { SimProvider } from './lib/sim'
import { Footer, Nav, StorageBanner } from './components/Layout'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Simulator from './pages/Simulator'
import Workspace from './pages/Workspace'
import Learn from './pages/Learn'
import Predict from './pages/Predict'
import AskPage from './pages/AskPage'
import SafetyPage from './pages/SafetyPage'
import DataPage from './pages/DataPage'
import SourcesPage from './pages/SourcesPage'
import NotFound from './pages/NotFound'
import { WorkspaceProvider } from './lib/workspace/WorkspaceContext'

export default function App() {
  const path = usePath()
  const [card, setCard] = useState<ModelCard | null>(null)
  useEffect(() => { getJSON<ModelCard>('/model').then(setCard).catch(() => {}) }, [])
  const page = PAGES.find(p => p.path === path)
  useEffect(() => { document.title = page?.title ?? 'IGNITE-AI · Page not found' }, [path])
  let body: React.ReactNode
  switch (path) {
    case '/': body = <Landing card={card} />; break
    case '/dashboard': body = <Dashboard />; break
    case '/simulator': body = <Simulator card={card} />; break
    case '/workspace': body = <Workspace card={card} />; break
    case '/learn': body = <Learn />; break
    case '/predict': body = <Predict card={card} />; break
    case '/ask': body = <AskPage />; break
    case '/safety': body = <SafetyPage />; break
    case '/data': body = <DataPage card={card} />; break
    case '/sources': body = <SourcesPage card={card} />; break
    default: body = <NotFound />
  }
  return (
    <WorkspaceProvider>
      <SimProvider path={path}>
        <Nav path={path} />
        <StorageBanner />
        <main key={path}>{body}</main>
        <Footer />
      </SimProvider>
    </WorkspaceProvider>
  )
}
