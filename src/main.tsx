import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { APP_VERSION } from './truth.config'

// Dynamically set the document title using APP_VERSION
document.title = `DEMO Dispatch App v${APP_VERSION}`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)