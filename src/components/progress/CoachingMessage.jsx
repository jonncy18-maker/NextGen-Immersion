import { useState, useEffect } from 'react'
import { getAuthToken } from '../../lib/authToken.js'

export default function CoachingMessage() {
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCoaching() {
      try {
        const token = await getAuthToken()
        const res = await fetch('/api/progress-coaching', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        setMessage(data.message || null)
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    fetchCoaching()
  }, [])

  if (loading || !message) return null

  return (
    <div style={styles.wrap}>
      <p style={styles.label}>Coach</p>
      <p style={styles.message}>{message}</p>
    </div>
  )
}

const styles = {
  wrap: {
    padding: '16px 20px',
    borderTop: '1px solid #f0ebe3',
  },
  label: {
    margin: '0 0 6px',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#8a8f99',
  },
  message: {
    margin: 0,
    fontSize: 14,
    color: 'var(--ngsi-navy)',
    lineHeight: 1.65,
    fontStyle: 'italic',
  },
}
