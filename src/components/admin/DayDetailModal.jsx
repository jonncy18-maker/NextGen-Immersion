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
const TYPE_OPTIONS = [
  { value: 'chatgpt_conversation', label: 'ChatGPT Practice' },
  { value: 'mentor_call',          label: 'Mentor Call' },
  { value: 'video_external',       label: 'External Video' },
]

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
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

async function deleteSession(sessionType, sessionId) {
  const token = await getAuthToken()
  const res = await fetch('/api/delete-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionType, sessionId }),
  })
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
  return res.json()
}

async function editExternalSession(sessionId, durationMinutes, notes, sessionType) {
  const token = await getAuthToken()
  const res = await fetch('/api/edit-external-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionId, durationMinutes, notes, sessionType }),
  })
  if (!res.ok) throw new Error(`Edit failed: ${res.status}`)
  return res.json()
}

function WatchSessionRow({ session, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [confirm, setConfirm] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteSession('watch', session.id)
      onDeleted(session.id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div style={styles.row}>
      <div style={styles.rowIcon}>▶</div>
      <div style={styles.rowBody}>
        <div style={styles.rowTitle}>{session.video_title}</div>
        {session.channel_name && (
          <div style={styles.rowMeta}>{session.channel_name}</div>
        )}
        <div style={styles.rowMeta}>
          {fmtDuration(session.seconds_watched)}
          {session.completed && (
            <span style={styles.completedTag}> ✓ Completed</span>
          )}
        </div>
      </div>
      <div style={styles.rowActions}>
        {!confirm ? (
          <button
            style={{ ...styles.actionBtn, ...styles.deleteBtn }}
            onClick={() => setConfirm(true)}
            title="Delete session"
          >
            ✕
          </button>
        ) : (
          <div style={styles.confirmRow}>
            <span style={styles.confirmText}>Delete?</span>
            <button
              style={{ ...styles.actionBtn, ...styles.deleteConfirmBtn }}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '…' : 'Yes'}
            </button>
            <button
              style={{ ...styles.actionBtn, ...styles.cancelBtn }}
              onClick={() => setConfirm(false)}
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ExternalSessionRow({ session, onDeleted, onEdited }) {
  const [deleting, setDeleting] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editDuration, setEditDuration] = useState(String(Math.round(session.duration_seconds / 60)))
  const [editNotes, setEditNotes] = useState(session.notes || '')
  const [editType, setEditType] = useState(session.session_type)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteSession('external', session.id)
      onDeleted(session.id)
    } catch {
      setDeleting(false)
    }
  }

  async function handleSave() {
    const mins = Number(editDuration)
    if (!mins || mins <= 0) return
    setSaving(true)
    try {
      const updated = await editExternalSession(session.id, mins, editNotes, editType)
      onEdited(session.id, updated)
      setEditing(false)
    } catch {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div style={{ ...styles.row, flexDirection: 'column', gap: 10 }}>
        <div style={styles.editHeader}>
          <span style={styles.editTitle}>Edit Session</span>
          <button style={{ ...styles.actionBtn, ...styles.cancelBtn }} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
        <div style={styles.editGrid}>
          <label style={styles.editLabel}>
            Type
            <select
              value={editType}
              onChange={e => setEditType(e.target.value)}
              style={styles.editSelect}
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label style={styles.editLabel}>
            Duration (min)
            <input
              type="number"
              min="1"
              value={editDuration}
              onChange={e => setEditDuration(e.target.value)}
              style={styles.editInput}
            />
          </label>
        </div>
        <label style={styles.editLabel}>
          Notes
          <textarea
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            rows={2}
            placeholder="Optional notes…"
            style={styles.editTextarea}
          />
        </label>
        <button
          style={{ ...styles.saveBtn, ...(saving ? { opacity: 0.6 } : {}) }}
          onClick={handleSave}
          disabled={saving || !editDuration || Number(editDuration) <= 0}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    )
  }

  return (
    <div style={styles.row}>
      <div style={styles.rowIcon}>{TYPE_ICONS[session.session_type] || '📌'}</div>
      <div style={styles.rowBody}>
        <div style={styles.rowTitle}>{TYPE_LABELS[session.session_type] || session.session_type}</div>
        <div style={styles.rowMeta}>{fmtDuration(session.duration_seconds)}</div>
        {session.notes && (
          <div style={styles.rowNotes}>{session.notes}</div>
        )}
      </div>
      <div style={styles.rowActions}>
        {!confirm ? (
          <>
            <button
              style={{ ...styles.actionBtn, ...styles.editActionBtn }}
              onClick={() => setEditing(true)}
              title="Edit session"
            >
              ✎
            </button>
            <button
              style={{ ...styles.actionBtn, ...styles.deleteBtn }}
              onClick={() => setConfirm(true)}
              title="Delete session"
            >
              ✕
            </button>
          </>
        ) : (
          <div style={styles.confirmRow}>
            <span style={styles.confirmText}>Delete?</span>
            <button
              style={{ ...styles.actionBtn, ...styles.deleteConfirmBtn }}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '…' : 'Yes'}
            </button>
            <button
              style={{ ...styles.actionBtn, ...styles.cancelBtn }}
              onClick={() => setConfirm(false)}
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  )
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

  function handleWatchDeleted(sessionId) {
    setData(prev => prev ? {
      ...prev,
      watch_sessions: prev.watch_sessions.filter(s => s.id !== sessionId)
    } : prev)
  }

  function handleExternalDeleted(sessionId) {
    setData(prev => prev ? {
      ...prev,
      external_sessions: prev.external_sessions.filter(s => s.id !== sessionId)
    } : prev)
  }

  function handleExternalEdited(sessionId, updated) {
    setData(prev => prev ? {
      ...prev,
      external_sessions: prev.external_sessions.map(s =>
        s.id === sessionId
          ? { ...s, session_type: updated.session_type, duration_seconds: updated.duration_seconds, notes: updated.notes }
          : s
      )
    } : prev)
  }

  const sessions = data
    ? [...data.watch_sessions, ...data.external_sessions]
    : []
  const totalSeconds = sessions.reduce((sum, s) =>
    sum + (s.seconds_watched ?? s.duration_seconds ?? 0), 0)

  return (
    <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={styles.modal} role="dialog" aria-modal="true">

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

        <div style={styles.body}>
          {loading && (
            <div style={styles.center}>
              <div style={styles.spinner} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {error && <p style={styles.errorMsg}>Couldn&apos;t load session details.</p>}

          {!loading && data && (
            <>
              {data.watch_sessions.length === 0 && data.external_sessions.length === 0 ? (
                <p style={styles.empty}>No sessions were logged on this day.</p>
              ) : (
                <>
                  {data.watch_sessions.length > 0 && (
                    <Section title="Library Video">
                      {data.watch_sessions.map(s => (
                        <WatchSessionRow
                          key={s.id}
                          session={s}
                          onDeleted={handleWatchDeleted}
                        />
                      ))}
                    </Section>
                  )}

                  {data.external_sessions.length > 0 && (
                    <Section title="Other Sessions">
                      {data.external_sessions.map(s => (
                        <ExternalSessionRow
                          key={s.id}
                          session={s}
                          onDeleted={handleExternalDeleted}
                          onEdited={handleExternalEdited}
                        />
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
    maxWidth: 520,
    maxHeight: '85vh',
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
    gap: 10,
    padding: '10px 12px',
    backgroundColor: '#faf9f6',
    borderRadius: 8,
    border: '1px solid #f0ece2',
    alignItems: 'flex-start',
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
  rowActions: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
    alignItems: 'flex-start',
    paddingTop: 1,
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  confirmText: {
    fontSize: 11,
    color: '#c0524a',
    fontWeight: 600,
  },
  actionBtn: {
    padding: '3px 7px',
    fontSize: 12,
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.4,
    fontWeight: 600,
  },
  editActionBtn: {
    background: '#f0ece2',
    color: '#5a6070',
  },
  deleteBtn: {
    background: '#fef2f2',
    color: '#c0524a',
  },
  deleteConfirmBtn: {
    background: '#c0524a',
    color: '#fff',
  },
  cancelBtn: {
    background: '#f0ece2',
    color: '#5a6070',
  },
  editHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#162040',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  editGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  editLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 11,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  editSelect: {
    padding: '6px 8px',
    fontSize: 12,
    border: '1.5px solid #d0d5dd',
    borderRadius: 6,
    background: '#fff',
    color: '#162040',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  editInput: {
    padding: '6px 8px',
    fontSize: 12,
    border: '1.5px solid #d0d5dd',
    borderRadius: 6,
    background: '#fff',
    color: '#162040',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  editTextarea: {
    padding: '6px 8px',
    fontSize: 12,
    border: '1.5px solid #d0d5dd',
    borderRadius: 6,
    background: '#fff',
    color: '#162040',
    fontFamily: 'inherit',
    resize: 'vertical',
    width: '100%',
    boxSizing: 'border-box',
  },
  saveBtn: {
    padding: '7px 14px',
    fontSize: 12,
    fontWeight: 600,
    border: 'none',
    borderRadius: 6,
    background: '#162040',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    alignSelf: 'flex-end',
    display: 'block',
    width: '100%',
  },
}
