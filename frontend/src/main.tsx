import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/didact-gothic/400.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import './styles.css'
import './theme.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
