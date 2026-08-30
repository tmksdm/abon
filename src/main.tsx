import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { CloudApp } from './cloud/CloudApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CloudApp />
  </StrictMode>,
)
