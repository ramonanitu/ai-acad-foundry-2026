// Conversation history — persisted client-side only, deliberately. The backend's
// /ask endpoint is stateless by design (see main.py): the caller resends recent
// turns each time and nothing is kept server-side. "Remembering past chats" is
// therefore a browser-local concern — one localStorage key holding every saved
// conversation for this browser, no server or account involved.
const STORAGE_KEY = 'libra-assist.conversations.v1'
const MAX_CONVERSATIONS = 50
const TITLE_MAX_CHARS = 48

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []                      // corrupt or inaccessible storage — behave as if empty
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_CONVERSATIONS)))
  } catch {
    /* storage full, disabled, or private-mode — history just won't persist this time */
  }
}

export function loadConversations() {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt)
}

export function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Nobody names these by hand — the first thing the user asked stands in for a title.
export function titleFor(messages) {
  const first = messages.find((m) => m.role === 'user')
  if (!first) return 'New conversation'
  const text = first.text.trim().replace(/\s+/g, ' ')
  return text.length > TITLE_MAX_CHARS ? text.slice(0, TITLE_MAX_CHARS) + '…' : text
}

export function saveConversation(id, agent, messages) {
  if (messages.length === 0) return              // nothing sent yet — don't clutter the list
  const all = readAll()
  const idx = all.findIndex((c) => c.id === id)
  const record = { id, agent, messages, title: titleFor(messages), updatedAt: Date.now() }
  if (idx >= 0) all[idx] = record
  else all.unshift(record)
  writeAll(all)
}

export function deleteConversation(id) {
  writeAll(readAll().filter((c) => c.id !== id))
}

export function formatWhen(ts) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
