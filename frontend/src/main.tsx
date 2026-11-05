import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import '@fontsource-variable/geist/index.css';
import '@fontsource-variable/bricolage-grotesque/index.css';
import '@fontsource-variable/manrope/index.css';
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
