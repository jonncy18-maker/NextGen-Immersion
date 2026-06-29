import { useState } from 'react'
import { getAuthToken } from '../../lib/authToken.js'

const SESSION_TYPES = [
  { value: 'chatgpt_conversation', label: 'ChatGPT Conversation' },
  { value: 'mentor_call', label: 'Weekly Mentor Call' },
]

function todayManila() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

export default function ExternalHoursButton({ userId, onLogged }) {
  const [open, setOpen] = useState(false)
  const [sessionType, setSessionType] = useState('chatgpt_conversation')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [sessionDate, setSessionDate] = useState(todayManila)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('idle') // idle | submitting | error
  const [errorMsg, setErrorMsg] = useState(null)

  function openModal() {
    setSessionType('chatgpt_conversation')
    setDurationMinutes('')
    setSessionDate(todayManila())
    setNotes('')
    setStatus('idle')
    setErrorMsg(null)
    setOpen(true)
  }

  function closeModal() {
    setOpen(false)
  }

  async function submit(e) {
    e.preventDefault()
    setErrorMsg(null)
    setStatus('submitting')
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/log-external', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          sessionType,
          durationMinutes: Number(durationMinutes),
          sessionDate,
          notes: notes || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setOpen(false)
      if (onLogged) onLogged()
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  return (
    <>
      <button type="button" onClick={openModal} style={styles.trigger}>
        ＋ Add Hours
      </button>

      {open && (
        <div style={styles.overlay} onClick={closeModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.title}>Log Study Hours</h2>

            <form onSubmit={submit} style={styles.form}>
              <label style={styles.field}>
                <span style={styles.label}>Session type</span>
                <select
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value)}
                  style={styles.input}
                  required
                >
                  {SESSION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Minutes</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 30"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  style={styles.input}
                  required
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Date</span>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  style={styles.input}
                  required
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Notes (optional)</span>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ ...styles.input, resize: 'vertical', minHeight: 60 }}
                  placeholder="e.g. Practiced medical vocabulary"
                />
              </label>

              {status === 'error' && (
                <p style={styles.errorMsg}>{errorMsg || 'Something went wrong.'}</p>
              )}

              <div style={styles.actions}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  style={{
                    ...styles.submitBtn,
                    ...(status === 'submitting' ? styles.submitBtnDisabled : {}),
                  }}
                >
                  {status === 'submitting' ? 'Logging…' : 'Log Hours'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

const styles = {
  trigger: {
    display: 'block',
    width: '100%',
    padding: '10px 0',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'inherit',
    color: 'var(--ngsi-navy)',
    background: '#fff',
    border: '1.5px solid var(--ngsi-navy)',
    borderRadius: 8,
    cursor: 'pointer',
    letterSpacing: '0.01em',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(22,32,64,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    background: '#fff',
    borderRadius: 14,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 8px 32px rgba(22,32,64,0.22)',
  },
  title: {
    margin: '0 0 18px',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
    fontFamily: 'Georgia, serif',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  input: {
    padding: '9px 12px',
    fontSize: 14,
    border: '1.5px solid #d0d5dd',
    borderRadius: 8,
    outline: 'none',
    background: '#fff',
    color: 'var(--ngsi-navy)',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  errorMsg: { margin: 0, fontSize: 13, color: '#c0524a' },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  cancelBtn: {
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    border: '1.5px solid #d0d5dd',
    borderRadius: 8,
    background: '#fff',
    color: '#5a6070',
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '9px 20px',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    border: '1.5px solid var(--ngsi-navy)',
    borderRadius: 8,
    background: 'var(--ngsi-navy)',
    color: '#fff',
    cursor: 'pointer',
  },
  submitBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
}
