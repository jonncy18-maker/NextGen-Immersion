const BUFFER_KEY = 'ngsi_offline_buffer'

function getBuffer() {
  try {
    return JSON.parse(localStorage.getItem(BUFFER_KEY) || '[]')
  } catch {
    return []
  }
}

export function addToBuffer(payload) {
  const buffer = getBuffer()
  buffer.push(payload)
  localStorage.setItem(BUFFER_KEY, JSON.stringify(buffer))
}

export async function flushBuffer(token) {
  const buffer = getBuffer()
  if (buffer.length === 0) return

  const remaining = []
  for (const payload of buffer) {
    try {
      const res = await fetch('/api/flush-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) remaining.push(payload)
    } catch {
      remaining.push(payload)
    }
  }
  localStorage.setItem(BUFFER_KEY, JSON.stringify(remaining))
}
