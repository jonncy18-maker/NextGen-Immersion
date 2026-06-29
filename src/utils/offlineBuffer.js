import { getAuthToken } from '../lib/authToken.js'

const BUFFER_KEY = 'ngsi_offline_buffer'
// Same-tab reactive signal — localStorage's `storage` event only fires in OTHER
// tabs, so we dispatch our own event for the in-tab connection pill to listen to.
export const BUFFER_CHANGE_EVENT = 'ngsi-buffer-change'

function emitChange() {
  try {
    window.dispatchEvent(new CustomEvent(BUFFER_CHANGE_EVENT))
  } catch {
    // window unavailable (SSR) — no listeners to notify
  }
}

export function getBuffered() {
  try {
    return JSON.parse(localStorage.getItem(BUFFER_KEY) || '[]')
  } catch {
    return []
  }
}

export function getBufferedCount() {
  return getBuffered().length
}

// Upsert by clientFlushId — accumulates seconds across partial flushes
export function bufferFlush(payload) {
  const items = getBuffered()
  const idx = items.findIndex(i => i.clientFlushId === payload.clientFlushId)
  if (idx >= 0) {
    items[idx] = payload
  } else {
    items.push(payload)
  }
  try {
    localStorage.setItem(BUFFER_KEY, JSON.stringify(items))
    emitChange()
  } catch {
    // localStorage quota exceeded — skip buffering
  }
}

export function removeBuffered(clientFlushId) {
  const items = getBuffered().filter(i => i.clientFlushId !== clientFlushId)
  try {
    localStorage.setItem(BUFFER_KEY, JSON.stringify(items))
    emitChange()
  } catch {}
}

// Flush every buffered segment to the server. Safe to call repeatedly (app load,
// reconnect) — the in-flight guard prevents overlapping drains from double-posting,
// and ON CONFLICT (client_flush_id) makes any genuine retry idempotent server-side.
// Stops on the first network failure (still offline); leaves non-ok items buffered
// to retry on the next drain. Returns the number of items successfully flushed.
let draining = false
export async function drainBuffer() {
  if (draining) return 0
  const items = getBuffered()
  if (!items.length) return 0

  const token = await getAuthToken()
  if (!token) return 0

  draining = true
  let flushed = 0
  try {
    for (const item of items) {
      try {
        const res = await fetch('/api/flush-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(item),
        })
        if (res.ok) {
          removeBuffered(item.clientFlushId)
          flushed += 1
        }
        // non-ok (e.g. transient 5xx): leave buffered, keep trying the rest
      } catch {
        break // still offline — stop and retry on the next reconnect
      }
    }
  } finally {
    draining = false
  }
  return flushed
}
