const BUFFER_KEY = 'ngsi_offline_buffer'

export function getBuffered() {
  try {
    return JSON.parse(localStorage.getItem(BUFFER_KEY) || '[]')
  } catch {
    return []
  }
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
  } catch {
    // localStorage quota exceeded — skip buffering
  }
}

export function removeBuffered(clientFlushId) {
  const items = getBuffered().filter(i => i.clientFlushId !== clientFlushId)
  try {
    localStorage.setItem(BUFFER_KEY, JSON.stringify(items))
  } catch {}
}
