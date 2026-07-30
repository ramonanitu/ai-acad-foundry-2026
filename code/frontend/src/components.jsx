import { useState } from 'react'

/** Small inline-SVG icon set (no icon library in this project) — used in place of
 *  emoji/unicode glyphs so controls read as a designed product, not a text console. */
function Icon({ children, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}
export const IconChat = (p) => <Icon {...p}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></Icon>
export const IconSun = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </Icon>
)
export const IconMoon = (p) => <Icon {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></Icon>
export const IconSettings = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Icon>
)
export const IconTrash = (p) => (
  <Icon {...p}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
  </Icon>
)
export const IconVolume = (p) => (
  <Icon {...p}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </Icon>
)
export const IconPause = (p) => <Icon {...p}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></Icon>
export const IconMic = (p) => (
  <Icon {...p}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </Icon>
)
export const IconStop = (p) => (
  <Icon {...p} fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </Icon>
)
export const IconChevron = (p) => <Icon {...p}><polyline points="9 18 15 12 9 6" /></Icon>
export const IconPlus = (p) => <Icon {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>

/** A labeled on/off switch — used instead of a raw checkbox wherever the option
 *  needs to read as a deliberate, professional control rather than a form field. */
export function Switch({ checked, onChange, label, title }) {
  return (
    <label className="switch" title={title}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="switch-track"><span className="switch-thumb" /></span>
      <span className="switch-label">{label}</span>
    </label>
  )
}

export function Head({ title, children }) {
  return (
    <div className="head">
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </div>
  )
}

export function Err({ error }) {
  if (!error) return null
  return <div className="err" style={{ marginTop: '.8rem' }}><strong>Error:</strong> {error}</div>
}

/** A plain, visible admission — used wherever the app has nothing, refused, or is
 *  unsure, instead of a blank space that looks like a bug. */
export function Callout({ tone = 'info', title, children }) {
  return (
    <div className={`callout callout--${tone}`}>
      {title && <p style={{ fontWeight: 700, margin: '0 0 .25rem' }}>{title}</p>}
      <div>{children}</div>
    </div>
  )
}

export function Spinner({ label = 'working' }) {
  return <span className="muted" style={{ fontSize: '.85rem' }}><span className="spin" /> {label}…</span>
}

/** Collapsible raw JSON — the bridge between the GUI and what Swagger would show. */
export function RawJson({ data, label = 'raw response' }) {
  const [open, setOpen] = useState(false)
  if (!data) return null
  return (
    <div style={{ marginTop: '.8rem' }}>
      <button className="btn btn-outline btn-sm" onClick={() => setOpen(!open)}>
        {open ? 'hide' : 'show'} {label}
      </button>
      {open && <pre className="out" style={{ marginTop: '.5rem' }}>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  )
}

/** Where an agent can run — the four states, with the reason on hover. */
export const RUNS_ON = {
  local:   { label: 'local only',     tone: 'muted',   hint: 'A JSON file on disk. Runs in the backend process, with any provider.' },
  both:    { label: 'local + Foundry', tone: '',       hint: 'A JSON file here AND a hosted agent of the same name in Azure. Either lane works.' },
  foundry: { label: 'Foundry only',   tone: 'gold',    hint: 'Hosted in Azure with no local file — created in the portal, or its file was removed.' },
  unknown: { label: 'Foundry: unknown', tone: 'muted', hint: 'Could not ask the Agent Service, so hosted state is genuinely unknown.' },
}

export function RunsOnBadge({ runsOn, reason }) {
  const s = RUNS_ON[runsOn] || RUNS_ON.unknown
  return <span className={`badge ${s.tone}`} title={runsOn === 'unknown' && reason ? reason : s.hint}>{s.label}</span>
}

export function ChunkList({ chunks }) {
  if (!chunks?.length) return null
  return (
    <div>
      {chunks.map((c) => (
        <div className="chunk" key={c.index}>
          <div className="chunk-head">
            <span>chunk [{c.index}]</span>
            <span>{c.chars} chars · ~{c.approx_tokens} tokens</span>
          </div>
          {c.text}
        </div>
      ))}
    </div>
  )
}

export function Hits({ hits }) {
  if (!hits?.length) return <p className="faint">No hits.</p>
  return (
    <table>
      <thead>
        <tr><th style={{ width: '5.5rem' }}>score</th><th>chunk</th><th style={{ width: '7rem' }}>source</th></tr>
      </thead>
      <tbody>
        {hits.map((h) => (
          <tr key={h.id}>
            <td className="mono" style={{ color: 'var(--c-gold)' }}>{h.score.toFixed(4)}</td>
            <td>{h.text}</td>
            <td className="faint">{h.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
