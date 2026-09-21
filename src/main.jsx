import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/archivo/600.css'
import '@fontsource/archivo/700.css'
import '@fontsource/archivo/800.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './index.css'
import App from './App.jsx'

document.getElementById('app-splash')?.remove()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
