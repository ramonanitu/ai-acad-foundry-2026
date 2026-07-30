import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { IconChat, IconChevron, IconMoon, IconSun } from './components'
import Agents from './views/Agents'
import Chat from './views/Chat'
import Knowledge from './views/Knowledge'
import Search from './views/Search'
import Status from './views/Status'
import Tools from './views/Tools'

// Chat is the product; everything else is the workbench behind it. Grouping them
// this way — instead of six equal tabs — is what keeps the console from reading as
// an API explorer that happens to also have a chat tab.
const PRIMARY = { id: 'chat', label: 'Libra Assist' }
const DEV_VIEWS = [
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'search', label: 'Retrieval' },
  { id: 'agents', label: 'Agents' },
  { id: 'tools', label: 'Tools' },
  { id: 'status', label: 'Status' },
]

export default function App() {
  const [view, setView] = useState('chat')
  const [devOpen, setDevOpen] = useState(false)
  const [agents, setAgents] = useState([])
  const [hostedOnly, setHostedOnly] = useState([])
  const [foundry, setFoundry] = useState(null)
  const [health, setHealth] = useState(null)
  const [azure, setAzure] = useState(null)
  const [theme, setTheme] = useState('light')

  const loadAgents = useCallback(() => {
    api.agents()
      .then((d) => { setAgents(d.personas || []); setHostedOnly(d.hosted_only || []); setFoundry(d.foundry) })
      .catch(() => { setAgents([]); setHostedOnly([]); setFoundry(null) })
  }, [])
  const loadHealth = useCallback(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [])
  const loadAzure = useCallback(() => {
    api.azure().then(setAzure).catch(() => setAzure(null))
  }, [])

  useEffect(() => { loadAgents(); loadHealth(); loadAzure() }, [loadAgents, loadHealth, loadAzure])
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  // Landing on a developer screen (a shared link, a refresh) should open the group
  // it lives in rather than hide the active view behind a collapsed toggle.
  useEffect(() => { if (DEV_VIEWS.some((v) => v.id === view)) setDevOpen(true) }, [view])

  const online = health?.status === 'ok'

  return (
    <div className="app">
      <aside className="side">
        <p className="brand"><span className="mark">L</span>Libra Assist
          <small>your banking questions, answered plainly</small>
        </p>

        <div style={{ marginTop: '.6rem' }}>
          <button className={`nav-item hero ${view === PRIMARY.id ? 'active' : ''}`} onClick={() => setView(PRIMARY.id)}>
            <IconChat /> {PRIMARY.label}
          </button>
        </div>

        <button className={`dev-toggle ${devOpen ? 'open' : ''}`} onClick={() => setDevOpen((o) => !o)}>
          <IconChevron className="chev" /> Developer tools
        </button>
        {devOpen && (
          <div className="nav-secondary">
            <div className="nav-group">Pipeline &amp; platform</div>
            {DEV_VIEWS.map((v) => (
              <button key={v.id} className={`nav-item ${view === v.id ? 'active' : ''}`} onClick={() => setView(v.id)}>
                <span className="dot" />{v.label}
              </button>
            ))}
          </div>
        )}

        <div className="side-foot">
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.4rem' }}>
            <span className="dot" style={{ width: 7, height: 7, borderRadius: '50%',
              background: online ? 'var(--c-teal)' : 'var(--c-crimson)', display: 'inline-block' }} />
            {online ? `${health.llm.provider} · ${health.llm.model}` : 'backend offline'}
          </div>
          {azure?.configured && (
            <div style={{ marginBottom: '.5rem' }} title={azure.auth === 'identity'
              ? 'Signed in with Microsoft Entra — the Agent Service and control plane are available'
              : 'Key authentication — the Agent Service and control plane cannot be queried'}>
              <span className={`badge ${azure.auth === 'identity' ? 'teal' : 'gold'}`}>
                {azure.auth === 'identity' ? 'Entra identity' : 'key auth'}
              </span>
            </div>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <IconSun /> : <IconMoon />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </aside>

      <main className="main">
        {view === 'chat' && <Chat agents={agents} hostedOnly={hostedOnly} foundry={foundry} />}
        {view === 'knowledge' && <Knowledge />}
        {view === 'search' && <Search />}
        {view === 'agents' && <Agents agents={agents} hostedOnly={hostedOnly} foundry={foundry}
                                      reload={loadAgents} azure={azure} />}
        {view === 'tools' && <Tools />}
        {view === 'status' && <Status health={health} reload={loadHealth}
                                      azure={azure} reloadAzure={loadAzure} />}
      </main>
    </div>
  )
}
