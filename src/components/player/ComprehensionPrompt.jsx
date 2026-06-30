import { useState } from 'react'
import { getAuthToken } from '../../lib/authToken.js'

const RATINGS = [
  { value: 1, label: 'I struggled', color: '#C95B3A' },
  { value: 2, label: 'I understood some', color: '#C9A84C' },
  { value: 3, label: 'I understood well', color: '#1D9E75' },
]

export default function ComprehensionPrompt({ videoId, onRate, onDismiss }) {
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState(null)

  async function handleRate(rating) {
    if (submitting) return
    setSelected(rating)
    setSubmitting(true)
    try {
      const token = await getAuthToken()
      await fetch('/api/rate-comprehension', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoId, rating }),
      })
    } catch {
      // Fire and forget — rating recorded if possible
    }
    onRate(rating)
  }

  return (
    <div style={styles.wrap}>
      <p style={styles.question}>How well did you understand this video?</p>
      <div style={styles.buttons}>
        {RATINGS.map(r => (
          <button
            key={r.value}
            style={{
              ...styles.btn,
              ...(selected === r.value
                ? { background: r.color, color: '#fff', borderColor: r.color }
                : {}),
            }}
            onClick={() => handleRate(r.value)}
            disabled={submitting}
          >
            {r.label}
          </button>
        ))}
      </div>
      <button style={styles.skip} onClick={onDismiss}>Skip</button>
    </div>
  )
}

const styles = {
  wrap: {
    background: '#fff',
    border: '1px solid #e8e3da',
    borderRadius: 12,
    padding: '16px 20px',
    marginTop: 12,
  },
  question: {
    margin: '0 0 12px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ngsi-navy)',
  },
  buttons: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  btn: {
    padding: '8px 16px',
    border: '1.5px solid #e8e3da',
    borderRadius: 8,
    background: '#fff',
    color: 'var(--ngsi-navy)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.12s',
  },
  skip: {
    display: 'block',
    marginTop: 10,
    background: 'none',
    border: 'none',
    color: '#8a8f99',
    fontSize: 12,
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
    textDecoration: 'underline',
  },
}
