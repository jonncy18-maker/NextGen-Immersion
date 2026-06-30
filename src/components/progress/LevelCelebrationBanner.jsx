import { useState, useEffect } from 'react'
import { getAuthToken } from '../../lib/authToken.js'

export default function LevelCelebrationBanner() {
  const [celebration, setCelebration] = useState(null)

  useEffect(() => {
    async function fetchCelebration() {
      try {
        const token = await getAuthToken()
        const res = await fetch('/api/level-celebration', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        if (data.level && data.message) setCelebration(data)
      } catch {
        // Silent fail
      }
    }
    fetchCelebration()
  }, [])

  async function dismiss() {
    if (!celebration) return
    const level = celebration.level
    setCelebration(null)
    try {
      const token = await getAuthToken()
      await fetch('/api/level-celebration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ level }),
      })
    } catch {
      // Fire and forget
    }
  }

  if (!celebration) return null

  return (
    <div style={styles.banner}>
      <div style={styles.inner}>
        <span style={styles.star} aria-hidden="true">★</span>
        <div style={styles.text}>
          <p style={styles.levelLabel}>{celebration.level_name} reached!</p>
          <p style={styles.message}>{celebration.message}</p>
        </div>
        <button style={styles.closeBtn} onClick={dismiss} aria-label="Dismiss celebration">
          ✕
        </button>
      </div>
    </div>
  )
}

const styles = {
  banner: {
    background: 'linear-gradient(135deg, #162040 0%, #1D3A70 100%)',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  inner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    padding: '18px 20px',
  },
  star: {
    fontSize: 26,
    color: 'var(--ngsi-gold)',
    flexShrink: 0,
    lineHeight: 1,
    marginTop: 2,
  },
  text: { flex: 1 },
  levelLabel: {
    margin: '0 0 5px',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--ngsi-gold)',
    fontFamily: 'Georgia, serif',
  },
  message: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 1.6,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
    flexShrink: 0,
  },
}
