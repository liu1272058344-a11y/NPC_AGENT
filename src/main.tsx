import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() { return this.state.error ? <main style={{ padding: 32, color: '#fff', background: '#080b12', minHeight: '100vh', fontFamily: 'system-ui' }}><h1>NPC Forge AI 暂时无法加载</h1><p>{this.state.error.message}</p><button onClick={() => location.reload()}>重新加载</button></main> : this.props.children }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
)
