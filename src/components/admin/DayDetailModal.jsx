import { useState, useEffect } from 'react'
import { getAuthToken } from '../../lib/authToken.js'

const TYPE_LABELS = {
  video_external:       'External Video',
  chatgpt_conversation: 'ChatGPT Practice',
  mentor_call:          'Mentor Call',
}
const TYPE_ICONS = {
  video_external:       '📹',
  chatgpt_conversation: '💬',
  mentor_call:          '👩‍🏫',
}

function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  if (m > 0 && s > 0) return `${m}m ${s}s`
  if (m > 0) return `${m}m`
  return `${s}s`
}

function fmtDate(dateStr) {
  // Parse as local date to avoid UTC offset shifting the day
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

export default function DayDetailModal({ userId, date, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)

    getAuthToken()
      .then(token =>
        fetch(
          `/api/scholar-day-detail?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        )
      )
      .then(res => { if (!res.ok) throw new Error(`${res.status}`); return res.json() })
      .then(json => { if (!cancelled) setData(json) })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [userId, date])

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const totalSeconds = data
    ? data.watch_sessions.reduce((s, r) => s + r.seconds_watched, 0) +
      data.external_sessions.reduce((s, r) => s + r.duration_seconds, 0)
    : 0

  return (
    <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={styles.modal} role="dialog" aria-modal="true">

        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.dateLabel}>{fmtDate(date)}</div>
            {!loading && data && (
              <div style={styles.totalLabel}>
                {totalSeconds > 0 ? `${fmtDuration(totalSeconds)} total` : 'No sessions logged'}
              </div>
            )}
          </div>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {loading && (
            <div style={styles.center}>
              <div style={styles.spinner} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {error && (
            <p style={styles.errorMsg}>Couldn&apos;t load session details.</p>
          )}

          {!loading && data && (
            <>
              {data.watch_sessions.length === 0 && data.external_sessions.length === 0 ? (
                <p style={styles.empty}>No sessions were logged on this day.</p>
              ) : (
                <>
                  {data.watch_sessions.length > 0 && (
                    <Section title="Library Video">
                      {data.watch_sessions.map((s, i) => (
                        <div key={i} style={styles.row}>
                          <div style={styles.rowIcon}>▶</div>
                          <div style={styles.rowBody}>
                            <div style={styles.rowTitle}>{s.video_title}</div>
                            {s.channel_name && (
                              <div style={styles.rowMeta}>{s.channel_name}</div>
                            )}
                            <div style={styles.rowMeta}>
                              {fmtDuration(s.seconds_watched)}
                              {s.completed && (
                                <span style={styles.completedTag}> ✓ Completed</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </Section>
                  )}

                  {data.external_sessions.length > 0 && (
                    <Section title="Other Sessions">
                      {data.external_sessions.map((s, i) => (
                        <div key={i} style={styles.row}>
                          <div style={styles.rowIcon}>
                            {TYPE_ICONS[s.session_type] || '📌'}
                          </div>
                          <div style={styles.rowBody}>
                            <div style={styles.rowTitle}>
                              {TYPE_LABELS[s.session_type] || s.session_type}
                            </div>
                            <div style={styles.rowMeta}>{fmtDuration(s.duration_seconds)}</div>
                            {s.notes && (
                              <div style={styles.rowNotes}>{s.notes}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </Section>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(22,32,64,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: 16,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 14,
    boxShadow: '0 8px 32px rgba(22,32,64,0.22)',
    width: '100%',
    maxWidth: 480,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '18px 20px 14px',
    borderBottom: '1px solid #f0ece2',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexShrink: 0,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: 700,
    color: '#162040',
    fontFamily: 'Georgia, serif',
  },
  totalLabel: { fontSize: 12, color: '#8a8f99', marginTop: 2 },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 16,
    color: '#8a8f99',
    cursor: 'pointer',
    padding: '0 2px',
    fontFamily: 'inherit',
    lineHeight: 1,
    flexShrink: 0,
  },
  body: { overflowY: 'auto', padding: '16px 20px', flex: 1 },
  center: { display: 'flex', justifyContent: 'center', padding: '24px 0' },
  spinner: {
    width: 28, height: 28,
    border: '3px solid #ede7d9',
    borderTop: '3px solid #162040',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorMsg: { color: '#C95B3A', fontSize: 13, margin: 0 },
  empty: { color: '#8a8f99', fontSize: 13, margin: 0 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 8,
  },
  row: {
    display: 'flex',
    gap: 12,
    padding: '10px 14px',
    backgroundColor: '#faf9f6',
    borderRadius: 8,
    border: '1px solid #f0ece2',
  },
  rowIcon: { fontSize: 15, flexShrink: 0, marginTop: 1 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#162040',
    lineHeight: 1.3,
    marginBottom: 2,
  },
  rowMeta: { fontSize: 12, color: '#8a8f99', lineHeight: 1.5 },
  rowNotes: {
    fontSize: 12,
    color: '#5a6275',
    marginTop: 4,
    lineHeight: 1.4,
    fontStyle: 'italic',
  },
  completedTag: { color: '#1D9E75', fontWeight: 700 },
}
