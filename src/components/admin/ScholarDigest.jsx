import { useState, useEffect } from 'react'
import { getAuthToken } from '../../lib/authToken.js'

export default function ScholarDigest({ userId }) {
  const [digest, setDigest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setDigest(null)

    async function fetchDigest() {
      try {
        const token = await getAuthToken()
        const res = await fetch(`/api/scholar-digest?userId=${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        setDigest(data)
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }

    fetchDigest()
  }, [userId])

  async function generate() {
    setGenerating(true)
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/scholar-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        const data = await res.json()
        setDigest(data)
      }
    } catch {
      // Silent fail
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <p style={styles.label}>AI Scholar Digest</p>
        <button
          style={styles.generateBtn}
          onClick={generate}
          disabled={generating || loading}
        >
          {generating ? 'Generating…' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <p style={styles.status}>Loading…</p>
      ) : digest?.message ? (
        <>
          <p style={styles.message}>{digest.message}</p>
          {digest.generated_at && (
            <p style={styles.timestamp}>
              Generated{' '}
              {new Date(digest.generated_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </>
      ) : (
        <p style={styles.empty}>No digest yet — click Refresh to generate one.</p>
      )}
    </div>
  )
}

const styles = {
  wrap: { padding: '16px 20px' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#8a8f99',
  },
  generateBtn: {
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid #e8e3da',
    borderRadius: 6,
    background: '#fff',
    color: 'var(--ngsi-navy)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  message: {
    margin: 0,
    fontSize: 14,
    color: 'var(--ngsi-navy)',
    lineHeight: 1.7,
  },
  timestamp: {
    margin: '8px 0 0',
    fontSize: 11,
    color: '#8a8f99',
  },
  empty: {
    margin: 0,
    fontSize: 13,
    color: '#8a8f99',
    fontStyle: 'italic',
  },
  status: {
    margin: 0,
    fontSize: 13,
    color: '#8a8f99',
  },
}
