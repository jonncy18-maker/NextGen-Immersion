import { useState, useEffect } from 'react'
import { getAuthToken } from '../../lib/authToken.js'

const LEVEL_LABELS = { a1: 'A1', a2: 'A2', b1: 'B1', b2: 'B2', c1: 'C1', c2: 'C2' }

export default function NextVideoSuggestions({ videoId, comprehensionRating, onSelect }) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!videoId || !comprehensionRating) return
    let cancelled = false
    setLoading(true)
    setSuggestions([])

    async function fetchSuggestions() {
      try {
        const token = await getAuthToken()
        const res = await fetch('/api/next-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ videoId, comprehensionRating }),
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setSuggestions(data.suggestions || [])
      } catch {
        // Silent fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSuggestions()
    return () => { cancelled = true }
  }, [videoId, comprehensionRating])

  if (loading) {
    return (
      <div style={styles.wrap}>
        <p style={styles.label}>Finding your next video…</p>
        <div style={styles.skeletonRow}>
          {[1, 2, 3].map(i => <div key={i} style={styles.skeleton} />)}
        </div>
      </div>
    )
  }

  if (suggestions.length === 0) return null

  return (
    <div style={styles.wrap}>
      <p style={styles.label}>Up next for you</p>
      <div style={styles.row}>
        {suggestions.map(v => (
          <button key={v.id} style={styles.card} onClick={() => onSelect(v)}>
            <div style={styles.thumbWrap}>
              {v.thumbnail_url
                ? <img src={v.thumbnail_url} alt="" style={styles.thumb} />
                : <div style={styles.thumbFallback} />
              }
            </div>
            <div style={styles.cardBody}>
              <p style={styles.cardTitle}>{v.title}</p>
              <div style={styles.badges}>
                <span style={styles.levelBadge}>{LEVEL_LABELS[v.level] ?? v.level}</span>
                {v.oet_relevance >= 4 && (
                  <span style={styles.oetBadge}>OET</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
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
  label: {
    margin: '0 0 12px',
    fontSize: 11,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: 10,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    background: 'none',
    border: '1px solid #e8e3da',
    borderRadius: 8,
    overflow: 'hidden',
    cursor: 'pointer',
    textAlign: 'left',
    padding: 0,
    fontFamily: 'inherit',
    transition: 'border-color 0.12s',
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: '16 / 9',
    background: '#f0ebe3',
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbFallback: { width: '100%', height: '100%', background: '#f0ebe3' },
  cardBody: { padding: '8px 10px' },
  cardTitle: {
    margin: '0 0 6px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ngsi-navy)',
    lineHeight: 1.3,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  badges: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  levelBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--ngsi-navy)',
    background: 'var(--ngsi-cream)',
    border: '1px solid #e8e3da',
    padding: '1px 5px',
    borderRadius: 999,
  },
  oetBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: '#fff',
    background: '#378ADD',
    padding: '1px 5px',
    borderRadius: 999,
  },
  skeletonRow: { display: 'flex', gap: 10 },
  skeleton: {
    flex: 1,
    height: 90,
    background: '#f0ebe3',
    borderRadius: 8,
  },
}
