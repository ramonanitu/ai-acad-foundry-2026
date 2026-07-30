import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { startRecording } from '../audio'
import { Callout, IconMic, IconPause, IconSettings, IconStop, IconVolume, Switch } from '../components'
import { loadConversations, saveConversation } from '../conversations'

const PROMPTS = [
  'My card got frozen — what do I do?',
  'Can I pay my mortgage back sooner?',
  'What happens if I break a term deposit early?',
]

// Tailored example questions per persona, keyed by the persona's file name (Persona.name).
// Personas without an entry here fall back to the generic PROMPTS above.
const AGENT_PROMPTS = {
  'ramona-nitu-agent': [
    "I was charged a fee I don't think is fair — can someone review it?",
    "My complaint from last month still hasn't been resolved.",
    'A branch employee gave me the wrong information and it cost me money.',
  ],
}

// `conversationId` is owned by App (it's what the sidebar's history list selects
// between); this component just loads/saves whatever is behind that id.
export default function Chat({ agents, hostedOnly = [], foundry, conversationId, onConversationsChanged }) {
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [agent, setAgent] = useState('default')
  const [useRag, setUseRag] = useState(true)
  const [factCheck, setFactCheck] = useState(false)
  const [mode, setMode] = useState('foundry')
  const [topK, setTopK] = useState(3)
  const [busy, setBusy] = useState(false)
  const [audioState, setAudioState] = useState({})   // { [messageIndex]: { status, url, playing, error } }
  const [micStatus, setMicStatus] = useState('idle')  // idle | recording | transcribing | error
  const [micError, setMicError] = useState(null)
  const endRef = useRef(null)
  const audioRef = useRef(null)
  const recorderRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  // Swap in whatever is saved under this id — a brand new id (from "New chat")
  // simply has nothing saved yet, so this clears the transcript.
  useEffect(() => {
    const saved = loadConversations().find((c) => c.id === conversationId)
    setMessages(saved?.messages || [])
    setAgent(saved?.agent || 'default')
    setAudioState({})
    setQuestion('')
  }, [conversationId])

  // Persisted to localStorage after each exchange completes — the backend itself
  // keeps nothing between calls (see /ask), so this is the only place a
  // conversation survives a reload. `onConversationsChanged` tells the sidebar
  // to re-read the list (new title, bumped recency).
  function persist(nextMessages, nextAgent = agent) {
    saveConversation(conversationId, nextAgent, nextMessages)
    onConversationsChanged?.()
  }

  function changeAgent(name) {
    setAgent(name)
    persist(messages, name)
  }

  const HISTORY_TURNS = 6   // last few exchanges sent back so the agent can follow up

  // Turn the on-screen transcript into the {role, content} pairs the API expects.
  // Failed requests leave no trace here — there's nothing coherent to replay.
  function recentHistory() {
    return messages
      .filter((m) => m.role === 'user' || m.role === 'bot')
      .map((m) => m.role === 'user'
        ? { role: 'user', content: m.text }
        : { role: 'assistant', content: m.data.answer })
      .slice(-HISTORY_TURNS * 2)
  }

  async function send(text0) {
    const text = (text0 ?? question).trim()
    if (!text || busy) return
    const history = recentHistory()
    const withUser = [...messages, { role: 'user', text }]
    setQuestion(''); setBusy(true)
    setMessages(withUser)
    try {
      const data = await api.ask({ question: text, use_rag: useRag, top_k: Number(topK),
                                  agent, agent_mode: mode, fact_check: factCheck, history })
      const withReply = [...withUser, { role: 'bot', data }]
      setMessages(withReply)
      persist(withReply)
    } catch (e) {
      const withErr = [...withUser, { role: 'err', text: e.message }]
      setMessages(withErr)
      persist(withErr)
    } finally { setBusy(false) }
  }

  // One shared <audio> element — starting a new answer stops whatever was playing.
  // Already-synthesized audio is cached by message index so replaying doesn't re-call Speech.
  // `playing: true` is only set once play() actually resolves — otherwise a blocked or
  // failed playback (autoplay policy, decode error) would look identical to a working one.
  async function playAudio(i, url) {
    audioRef.current?.pause()
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => setAudioState((s) => ({ ...s, [i]: { ...s[i], playing: false } }))
    audio.onerror = () => {
      const err = audio.error
      const reason = { 1: 'aborted', 2: 'network error', 3: 'could not decode audio',
                       4: 'audio format not supported' }[err?.code] || 'unknown playback error'
      setAudioState((s) => ({ ...s, [i]: { status: 'error', error: reason } }))
    }
    try {
      await audio.play()
      setAudioState((s) => {
        const next = {}
        for (const k in s) next[k] = { ...s[k], playing: false }
        next[i] = { status: 'ready', url, playing: true }
        return next
      })
    } catch (e) {
      setAudioState((s) => ({ ...s, [i]: { status: 'error', error: e.message } }))
    }
  }

  async function speak(i, text) {
    const cur = audioState[i]
    if (cur?.status === 'ready') {
      if (cur.playing) { audioRef.current?.pause(); setAudioState((s) => ({ ...s, [i]: { ...s[i], playing: false } })) }
      else playAudio(i, cur.url)
      return
    }
    if (cur?.status === 'loading') return
    setAudioState((s) => ({ ...s, [i]: { status: 'loading' } }))
    try {
      const blob = await api.speak({ text })
      await playAudio(i, URL.createObjectURL(blob))
    } catch (e) {
      setAudioState((s) => ({ ...s, [i]: { status: 'error', error: e.message } }))
    }
  }

  // Mic -> WAV -> /tools/transcribe -> dropped into the composer, never auto-sent, so a
  // misheard word can be fixed before it goes to the agent.
  async function toggleMic() {
    if (micStatus === 'recording') {
      setMicStatus('transcribing')
      try {
        const wav = await recorderRef.current.stop()
        recorderRef.current = null
        const file = new File([wav], 'question.wav', { type: 'audio/wav' })
        const result = await api.transcribe(file)
        setQuestion((q) => (q.trim() ? `${q.trim()} ${result.text}` : result.text))
        setMicStatus('idle')
      } catch (e) {
        setMicError(e.message)
        setMicStatus('error')
      }
      return
    }
    setMicError(null)
    try {
      recorderRef.current = await startRecording()
      setMicStatus('recording')
    } catch (e) {
      setMicError(e.message || 'Microphone access was denied.')
      setMicStatus('error')
    }
  }

  const all = [...agents, ...hostedOnly]
  const current = all.find((a) => a.name === agent)

  // Three states, not two. `available === false` is not "we don't know" — it is a
  // definite no: the Agent Service cannot be reached from here at all, whichever agent
  // you pick, because a key was used where Entra is required. Offering the lane anyway
  // is how you get a 503 in the chat window instead of a greyed-out option.
  const foundryReachable = foundry?.available                 // true | false | undefined
  const isHosted = current?.runs_on === 'both' || current?.runs_on === 'foundry'
  const localImpossible = current?.runs_on === 'foundry'      // no JSON file to run here
  const foundryBlocked =
    foundryReachable === false ||                             // no identity — nothing can
    (foundryReachable === true && !isHosted)                  // reachable, but not deployed
  const foundryWhy =
    foundryReachable === false
      ? (foundry?.reason || 'The Agent Service cannot be reached from here.')
      : 'Not deployed to Foundry — deploy it from the Agents view'

  // Keep the mode legal whenever the selected agent changes.
  useEffect(() => {
    if (foundryBlocked && mode === 'foundry') setMode('local')
    else if (localImpossible && mode !== 'foundry') setMode('foundry')
  }, [agent, localImpossible, foundryBlocked])   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="chat-wrap">
      <div className="chat-topbar">
        <div className="chat-topbar-group">
          <select value={agent} onChange={(e) => changeAgent(e.target.value)} title="Choose which persona answers">
            {agents.map((a) => <option key={a.name} value={a.name}>{a.display_name}</option>)}
            {hostedOnly.length > 0 && (
              <optgroup label="hosted in Foundry only">
                {hostedOnly.map((a) => <option key={a.name} value={a.name}>{a.display_name}</option>)}
              </optgroup>
            )}
          </select>
        </div>

        <Switch checked={useRag} onChange={(e) => setUseRag(e.target.checked)}
                label="Search my documents"
                title="Ground the answer in the documents you've ingested and show the sources used. Turn off to compare against the model's general knowledge alone." />

        <span className="grow-gap" />

        {foundryReachable === false && (
          <span className="badge muted" title={foundryWhy}>Foundry unavailable — key auth</span>
        )}

        <details className="advanced">
          <summary className="btn btn-outline btn-sm"><IconSettings /> Settings</summary>
          <div className="advanced-panel">
            <Switch checked={factCheck} onChange={(e) => setFactCheck(e.target.checked)}
                    label="Fact-check answers"
                    title="After answering, verify the answer against the open web and attach a verdict" />
            <div>
              <label>Where the agent runs</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)} title="Where the agent loop executes">
                <option value="foundry" disabled={foundryBlocked} title={foundryBlocked ? foundryWhy : ''}>
                  Run in Azure AI Foundry{foundryReachable === false ? ' — no identity'
                                : foundryBlocked ? ' — not deployed' : ''}
                </option>
                <option value="local" disabled={localImpossible}
                        title={localImpossible ? 'This agent has no local JSON file' : ''}>
                  Run locally
                </option>
              </select>
            </div>
            <div>
              <label>Passages to retrieve (top k)</label>
              <input type="number" min="1" max="10" value={topK} onChange={(e) => setTopK(e.target.value)} />
            </div>
            {current && <p className="faint" style={{ margin: 0 }}>{current.description} · temperature {current.temperature ?? '—'}</p>}
          </div>
        </details>
      </div>

      <div className="msgs">
        {messages.length === 0 && (
          <div className="card welcome">
            <span className="mark-lg">L</span>
            <h3>Ask {current?.display_name || 'Libra Assist'}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {current?.description ||
                "Questions about cards, mortgages, or deposits are answered from the documents you've " +
                'ingested, with the exact sources and scores shown underneath.'}
            </p>
            <div className="chips">
              {(AGENT_PROMPTS[agent] || PROMPTS).map((p) => <button key={p} className="chip" onClick={() => send(p)}>{p}</button>)}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === 'user') return <div className="msg user" key={i}>{m.text}</div>
          if (m.role === 'err') return (
            <div className="msg bot" key={i} style={{ padding: 0, border: 0, background: 'none' }}>
              <Callout tone="danger" title="That request failed">{m.text}</Callout>
            </div>
          )
          const d = m.data
          const noEvidence = d.augmented && (d.retrieved?.length ?? 0) === 0
          return (
            <div className="msg bot" key={i}>
              {noEvidence ? (
                <Callout tone="warn" title="Nothing relevant was found">
                  {d.answer}
                </Callout>
              ) : d.answer}
              <div className="msg-meta">
                <span className="badge">{d.agent?.display_name || 'agent'}</span>
                <span className={`badge ${d.augmented ? (noEvidence ? 'gold' : 'teal') : 'muted'}`}>
                  {d.augmented ? (noEvidence ? 'no sources found' : 'grounded in your documents') : 'general knowledge only'}
                </span>
                <span className="badge muted">{d.agent?.mode}</span>
                <span className="badge muted">{d.model}</span>
                {d.usage && <span className="badge muted">{d.usage.prompt_tokens}↑ {d.usage.completion_tokens}↓ tokens</span>}
                <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}
                        onClick={() => speak(i, d.answer)}
                        disabled={audioState[i]?.status === 'loading'}
                        title="Listen to this answer (Azure AI Speech)">
                  {audioState[i]?.status === 'loading' ? <span className="spin" />
                    : audioState[i]?.playing ? (<><IconPause /> Pause</>) : (<><IconVolume /> Listen</>)}
                </button>
              </div>
              {audioState[i]?.status === 'error' && (
                <p className="faint" style={{ margin: '.4rem 0 0', color: 'var(--c-crimson-ink)' }}>
                  Couldn't speak this answer: {audioState[i].error}
                </p>
              )}

              {d.dropped_below_threshold > 0 && (
                <div style={{ marginTop: '.55rem' }}>
                  <Callout tone="info">
                    {d.dropped_below_threshold} candidate passage{d.dropped_below_threshold > 1 ? 's' : ''} scored too low
                    to count as relevant and {d.dropped_below_threshold > 1 ? 'were' : 'was'} left out — shown here instead
                    of silently used.
                  </Callout>
                </div>
              )}

              {d.fact_check && (
                <div className="src" style={{ marginTop: '.55rem',
                     borderLeftColor: d.fact_check.verdict === 'supported' ? 'var(--c-teal)'
                       : d.fact_check.verdict === 'contradicted' ? 'var(--c-crimson)' : 'var(--c-gold)' }}>
                  <span className={`badge ${d.fact_check.verdict === 'contradicted' ? 'crimson'
                    : d.fact_check.verdict === 'supported' ? 'teal' : 'gold'}`}>
                    fact-check: {d.fact_check.verdict}
                  </span>{' '}
                  <span className="faint">{d.fact_check.confidence} confidence · {d.fact_check.evidence_from}</span>
                  {d.fact_check.error
                    ? <div className="faint" style={{ marginTop: '.3rem' }}>{d.fact_check.error}</div>
                    : <div style={{ marginTop: '.3rem' }}>{d.fact_check.reasoning}</div>}
                  {d.fact_check.sources?.length > 0 && (
                    <ul className="faint" style={{ margin: '.35rem 0 0', paddingLeft: '1.1rem' }}>
                      {d.fact_check.sources.map((sc) => (
                        <li key={sc.rank}>
                          <a href={sc.url} target="_blank" rel="noreferrer">{sc.title || sc.url}</a>
                          {' '}{sc.used ? `(${sc.chars_read} chars read)` : '(could not be read)'}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {d.retrieved?.length > 0 && (
                <details className="sources">
                  <summary>{d.retrieved.length} source{d.retrieved.length > 1 ? 's' : ''} used, ranked by score</summary>
                  {d.retrieved.map((h, j) => (
                    <div className="src" key={h.id}>
                      <span className="score">[{j + 1}] score {h.score.toFixed(4)}</span>
                      <span className="score-bar" style={{ width: `${Math.max(6, Math.min(100, h.score * 100))}px` }} />
                      <div>{h.text}</div>
                    </div>
                  ))}
                </details>
              )}

              <details className="sources">
                <summary>the exact prompt that was sent{d.history_used?.length > 0 ? ` (+ ${d.history_used.length} prior turn${d.history_used.length > 1 ? 's' : ''})` : ''}</summary>
                <pre className="out" style={{ marginTop: '.4rem' }}>{`SYSTEM:\n${d.system_prompt}\n\n${
                  (d.history_used || []).map((h) => `${h.role.toUpperCase()} (earlier):\n${h.content}`).join('\n\n')
                }${d.history_used?.length > 0 ? '\n\n' : ''}USER:\n${d.prompt_sent}`}</pre>
              </details>

              {d.agent && (
                <details className="sources">
                  <summary>the persona config behind this answer ({d.agent.display_name})</summary>
                  <pre className="out" style={{ marginTop: '.4rem' }}>{JSON.stringify({
                    name: d.agent.name,
                    display_name: d.agent.display_name,
                    description: d.agent.description,
                    temperature: d.agent.temperature,
                    max_tokens: d.agent.max_tokens,
                    require_citations: d.agent.require_citations,
                    refuse_when_unsupported: d.agent.refuse_when_unsupported,
                    reasoning_effort: d.agent.reasoning_effort,
                    tools: d.agent.tools,
                    style_rules: d.agent.style_rules,
                  }, null, 2)}</pre>
                </details>
              )}
            </div>
          )
        })}
        {busy && <div className="msg bot"><span className="spin" /> thinking…</div>}
        <div ref={endRef} />
      </div>

      {micStatus === 'error' && (
        <p className="faint" style={{ margin: '0 0 .4rem', color: 'var(--c-crimson-ink)' }}>
          Couldn't use the microphone: {micError}
        </p>
      )}
      <div className="composer">
        <button className={`btn btn-outline ${micStatus === 'recording' ? 'btn-recording' : ''}`}
                onClick={toggleMic}
                disabled={busy || micStatus === 'transcribing'}
                title={micStatus === 'recording' ? 'Stop and transcribe' : 'Ask by speaking (Azure AI Speech)'}>
          {micStatus === 'transcribing' ? <span className="spin" />
            : micStatus === 'recording' ? <IconStop /> : <IconMic />}
        </button>
        <textarea value={question} placeholder="Ask Libra Assist…  (Enter to send, Shift+Enter for a new line)"
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button className="btn btn-primary" onClick={() => send()} disabled={busy || !question.trim()}>Send</button>
      </div>
    </div>
  )
}
