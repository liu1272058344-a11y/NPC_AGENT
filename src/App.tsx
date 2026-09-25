import { useState } from 'react'
import './App.css'

const navItems = ['Overview', 'NPC Creation', 'Character Studio']

function App() {
  const [active, setActive] = useState('Overview')
  const [generated, setGenerated] = useState(false)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">NPC FORGE</div>
        <div className="product-label">AI WORKBENCH</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map((item) => (
            <button className={`nav-item ${active === item ? 'is-active' : ''}`} key={item} type="button" onClick={() => setActive(item)}>
              {item}
            </button>
          ))}
        </nav>
        <div className="version">v0.1 MVP</div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <h1>{active === 'Overview' ? 'Landing Page' : active}</h1>
          <span className="search-hint">⌘ K&nbsp;&nbsp; Search workspace</span>
        </header>

        <div className="content">
          <section className="hero-card">
            <div>
              <h2>Forge characters that feel alive</h2>
              <p>Prompt → Persona → Memory → Export</p>
            </div>
            <button className="primary-button" type="button" onClick={() => setGenerated(true)}>
              {generated ? 'NPC READY' : 'Generate NPC'}
            </button>
          </section>

          <section className="workspace panel">
            <div className="panel-label">WORKSPACE</div>
            <div className="workspace-card">
              <div><strong>{generated ? 'Rook-07 is ready' : 'Create your first NPC'}</strong><span>{generated ? 'A starter character profile has been generated.' : 'Start with a role, motive, and visual anchor.'}</span></div>
              <span className={`status-dot ${generated ? 'is-ready' : ''}`} aria-label={generated ? 'Ready' : 'Not started'} />
            </div>
            <div className="mvp-note">MVP preview · generation is currently simulated</div>
          </section>

          <div className="status-row">
            <div className="status-chip primary">SYNCED</div>
            <div className="status-chip">MEMORY 84%</div>
            <div className="status-chip">GODOT READY</div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
