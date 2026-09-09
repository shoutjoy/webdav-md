import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ShareViewer from './components/ShareViewer.jsx'
import './pwa.js'

const shareParams = new URLSearchParams(window.location.search)
const shareId = shareParams.get('pwShare') || shareParams.get('openShare')

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>{shareId ? <ShareViewer shareId={shareId} /> : <App />}</StrictMode>,
)
