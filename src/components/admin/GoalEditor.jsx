import { useState, useEffect, useCallback } from 'react'
import { getAuthToken } from '../../lib/authToken.js'
import { getPaceColor, getPaceLabel } from '../../utils/pace.js'

// Admin tool for the program-wide goal + each scholar's individual goal fields.
//
//  • Program goal  → POST /api/program-goal  (target level / hours / date)
//  • Scholar goals → POST /api/scholar-goal   (per scholar; NULL fields fall back to program goal)
//
// The start_date is what actually starts a scholar's pace calculation, so this
// is the control that flips a scholar from PENDING to ON_TRACK / AT_RISK.
// Per-scholar target_level / target_hours / target_date COALESCE over the program goal.

const TARGET_LEVELS = [
  { id: 'beginner', label: 'Beginner (150h)' },
  { id: 'intermediate', label: 'Intermediate (300h)' },
  { id: 'advanced', label: 'Advanced (600h)' },
]

function toDateInput(value) {
  if (!value) return ''
  // scholar_pace returns dates as 'YYYY-MM-DD' (or an ISO timestamp); keep
  // just the date part for <input type="date">.
  return String(value).slice(0, 10)
}

async function authedFetch(url, options = {}) {
  const token = await getAuthToken()
  return fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
}

export default function GoalEditor() {
  const [goal, setGoal] = useState(null)
  const [scholars, setScholars] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Program-goal form state
  const [form, setForm] = useState({ targetLevel: 'intermediate', targetHours: '300', targetDate: '' })
  const [goalSave, setGoalSave] = useState('idle') // idle | saving | saved | error
  const [goalErr, setGoalErr] = useState(null)

  // Apply-template state
  const [applyState, setApplyState] = useState('idle') // idle | applying | applied | error
  const [applyErr, setApplyErr] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [goalRes, scholarsRes] = await Promise.all([
        authedFetch('/api/program-goal'),
        authedFetch('/api/scholars'),
      ])
      if (!goalRes.ok) throw new Error(`goal HTTP ${goalRes.status}`)
      if (!scholarsRes.ok) throw new Error(`scholars HTTP ${scholarsRes.status}`)
      const goalJson = await goalRes.json()
      const scholarsJson = await scholarsRes.json()
      setGoal(goalJson)
      setScholars(Array.isArray(scholarsJson) ? scholarsJson : [])
      if (goalJson) {
        setForm({
          targetLevel: goalJson.target_level,
          targetHours: String(goalJson.target_hours),
          targetDate: toDateInput(goalJson.target_date),
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function saveGoal(e) {
    e.preventDefault()
    setGoalErr(null)
    setGoalSave('saving')
    try {
      const res = await authedFetch('/api/program-goal', {
        method: 'POST',
        body: JSON.stringify({
          targetLevel: form.targetLevel,
          targetHours: Number(form.targetHours),
          targetDate: form.targetDate,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setGoal(json)
      setGoalSave('saved')
      setTimeout(() => setGoalSave('idle'), 2000)
    } catch (err) {
      setGoalErr(err.message)
      setGoalSave('error')
    }
  }

  async function applyTemplate() {
    setApplyErr(null)
    setApplyState('applying')
    try {
      const res = await authedFetch('/api/program-goal', {
        method: 'POST',
        body: JSON.stringify({ action: 'applyToAll' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setApplyState('applied')
      setTimeout(() => setApplyState('idle'), 2500)
      load() // refresh scholar rows
    } catch (e) {
      setApplyErr(e.message)
      setApplyState('error')
    }
  }

  if (loading) return <p style={styles.hint}>Loading…</p>
  if (error)
    return (
      <div>
        <p style={styles.error}>Couldn&apos;t load goals ({error}).</p>
        <button style={styles.retryBtn} onClick={load}>
          Try again
        </button>
      </div>
    )

  return (
    <div style={styles.wrap}>
      {/* ── Program goal ─────────────────────────────────────────── */}
      <section style={styles.section}>
        <h2 style={styles.h2}>Program Goal</h2>
        <p style={styles.sectionSub}>
          The shared target every scholar is paced against. Editing it updates pace for all
          scholars immediately.
        </p>
        <form onSubmit={saveGoal} style={styles.goalForm}>
          <label style={styles.field}>
            <span style={styles.label}>Target level</span>
            <select
              value={form.targetLevel}
              onChange={(e) => setForm({ ...form, targetLevel: e.target.value })}
              style={styles.input}
            >
              {TARGET_LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Target hours</span>
            <input
              type="number"
              min="1"
              value={form.targetHours}
              onChange={(e) => setForm({ ...form, targetHours: e.target.value })}
              style={styles.input}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Target date</span>
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
              style={styles.input}
              required
            />
          </label>
          <button type="submit" style={styles.saveBtn} disabled={goalSave === 'saving'}>
            {goalSave === 'saving' ? 'Saving…' : goalSave === 'saved' ? 'Saved ✓' : 'Save goal'}
          </button>
        </form>
        {goalSave === 'error' && <p style={styles.error}>{goalErr || 'Save failed.'}</p>}
        {!goal && goalSave !== 'error' && (
          <p style={styles.warn}>No program goal set yet — scholars stay PENDING until you set one.</p>
        )}

        {/* Apply template to all scholars */}
        <div style={styles.applyRow}>
          <button
            type="button"
            onClick={applyTemplate}
            disabled={!goal || applyState === 'applying'}
            style={{
              ...styles.saveBtn,
              ...((!goal || applyState === 'applying') ? styles.saveBtnDisabled : {}),
            }}
          >
            {applyState === 'applying'
              ? 'Applying…'
              : applyState === 'applied'
              ? 'Applied ✓'
              : 'Apply template to all scholars'}
          </button>
          {applyState === 'error' && (
            <p style={{ ...styles.error, margin: '0 0 0 12px' }}>{applyErr || 'Apply failed.'}</p>
          )}
        </div>
      </section>

      {/* ── Per-scholar goals ────────────────────────────────────── */}
      <section style={styles.section}>
        <h2 style={styles.h2}>Scholar Goals</h2>
        <p style={styles.sectionSub}>
          Set each scholar&apos;s goal clock start date, target date, level, and hours. Fields left
          blank fall back to the program template.
        </p>
        {scholars.length === 0 ? (
          <p style={styles.hint}>No scholars yet.</p>
        ) : (
          <div style={styles.rows}>
            {scholars.map((s) => (
              <ScholarGoalRow key={s.user_id} scholar={s} onSaved={load} disabled={!goal} />
            ))}
          </div>
        )}
        {!goal && (
          <p style={styles.warn}>Set the program goal above before assigning start dates.</p>
        )}
      </section>
    </div>
  )
}

function ScholarGoalRow({ scholar, onSaved, disabled }) {
  const [value, setValue] = useState(toDateInput(scholar.start_date))
  const [targetDate, setTargetDate] = useState(toDateInput(scholar.target_date))
  const [targetLevel, setTargetLevel] = useState(scholar.target_level || '')
  const [targetHours, setTargetHours] = useState(
    scholar.target_hours ? String(scholar.target_hours) : ''
  )
  const [targetVideoHours,   setTargetVideoHours]   = useState(scholar.target_video_hours   ? String(scholar.target_video_hours)   : '')
  const [targetChatgptHours, setTargetChatgptHours] = useState(scholar.target_chatgpt_hours ? String(scholar.target_chatgpt_hours) : '')
  const [targetMentorHours,  setTargetMentorHours]  = useState(scholar.target_mentor_hours  ? String(scholar.target_mentor_hours)  : '')
  const [save, setSave] = useState('idle') // idle | saving | saved | error
  const [err, setErr] = useState(null)

  // Live category-sum validation
  const catSum =
    (Number(targetVideoHours) || 0) +
    (Number(targetChatgptHours) || 0) +
    (Number(targetMentorHours) || 0)
  const catTarget = Number(targetHours) || 0
  const catMismatch =
    catTarget > 0 &&
    (targetVideoHours || targetChatgptHours || targetMentorHours) &&
    catSum !== catTarget

  // Dirty: any field differs from the scholar's loaded values
  const dirty =
    value !== toDateInput(scholar.start_date) ||
    targetDate !== toDateInput(scholar.target_date) ||
    targetLevel !== (scholar.target_level || '') ||
    targetHours !== (scholar.target_hours ? String(scholar.target_hours) : '') ||
    targetVideoHours   !== (scholar.target_video_hours   ? String(scholar.target_video_hours)   : '') ||
    targetChatgptHours !== (scholar.target_chatgpt_hours ? String(scholar.target_chatgpt_hours) : '') ||
    targetMentorHours  !== (scholar.target_mentor_hours  ? String(scholar.target_mentor_hours)  : '')

  async function submit() {
    setErr(null)
    setSave('saving')
    try {
      const res = await authedFetch('/api/scholar-goal', {
        method: 'POST',
        body: JSON.stringify({
          userId: scholar.user_id,
          startDate: value || null,
          targetDate: targetDate || null,
          targetLevel: targetLevel || null,
          targetHours: targetHours ? Number(targetHours) : null,
          targetVideoHours:   targetVideoHours   ? Number(targetVideoHours)   : null,
          targetChatgptHours: targetChatgptHours ? Number(targetChatgptHours) : null,
          targetMentorHours:  targetMentorHours  ? Number(targetMentorHours)  : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setSave('saved')
      if (onSaved) onSaved()
    } catch (e) {
      setErr(e.message)
      setSave('error')
    }
  }

  return (
    <div style={styles.row}>
      <div style={styles.rowName}>
        <span style={styles.rowNameText}>{scholar.scholar_name || 'Unnamed'}</span>
        <span style={{ ...styles.rowStatus, color: getPaceColor(scholar.status) }}>
          {getPaceLabel(scholar.status)}
        </span>
      </div>

      <label style={styles.field}>
        <span style={styles.label}>Start date</span>
        <input
          type="date"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setSave('idle')
          }}
          style={styles.input}
          disabled={disabled}
        />
      </label>

      <label style={styles.field}>
        <span style={styles.label}>Target date</span>
        <input
          type="date"
          value={targetDate}
          onChange={(e) => {
            setTargetDate(e.target.value)
            setSave('idle')
          }}
          style={styles.input}
          disabled={disabled}
        />
      </label>

      <label style={styles.field}>
        <span style={styles.label}>Target level</span>
        <select
          value={targetLevel}
          onChange={(e) => {
            setTargetLevel(e.target.value)
            setSave('idle')
          }}
          style={styles.input}
          disabled={disabled}
        >
          <option value="">— program default —</option>
          {TARGET_LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <label style={styles.field}>
        <span style={styles.label}>Target hours</span>
        <input
          type="number"
          min="1"
          placeholder="default"
          value={targetHours}
          onChange={(e) => {
            setTargetHours(e.target.value)
            setSave('idle')
          }}
          style={{ ...styles.input, width: 90 }}
          disabled={disabled}
        />
      </label>

      <label style={styles.field}>
        <span style={styles.label}>Video h</span>
        <input
          type="number"
          min="1"
          placeholder="—"
          value={targetVideoHours}
          onChange={(e) => { setTargetVideoHours(e.target.value); setSave('idle') }}
          style={{ ...styles.input, width: 72, ...(catMismatch ? { borderColor: '#c0524a' } : {}) }}
          disabled={disabled}
        />
      </label>

      <label style={styles.field}>
        <span style={styles.label}>ChatGPT h</span>
        <input
          type="number"
          min="1"
          placeholder="—"
          value={targetChatgptHours}
          onChange={(e) => { setTargetChatgptHours(e.target.value); setSave('idle') }}
          style={{ ...styles.input, width: 72, ...(catMismatch ? { borderColor: '#c0524a' } : {}) }}
          disabled={disabled}
        />
      </label>

      <label style={styles.field}>
        <span style={styles.label}>Mentor h</span>
        <input
          type="number"
          min="1"
          placeholder="—"
          value={targetMentorHours}
          onChange={(e) => { setTargetMentorHours(e.target.value); setSave('idle') }}
          style={{ ...styles.input, width: 72, ...(catMismatch ? { borderColor: '#c0524a' } : {}) }}
          disabled={disabled}
        />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={disabled || !dirty || save === 'saving' || catMismatch}
        style={{
          ...styles.saveBtn,
          ...(disabled || !dirty || save === 'saving' || catMismatch ? styles.saveBtnDisabled : {}),
          alignSelf: 'flex-end',
        }}
      >
        {save === 'saving' ? 'Saving…' : save === 'saved' && !dirty ? 'Saved ✓' : 'Save'}
      </button>
      {catMismatch && (
        <span style={styles.rowErr}>
          {catSum}h ≠ {catTarget}h total
        </span>
      )}
      {save === 'error' && <span style={styles.rowErr}>{err || 'Failed'}</span>}
    </div>
  )
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 28 },
  section: {
    background: '#fff',
    border: '1px solid #e8e3da',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 1px 4px rgba(22,32,64,0.08)',
  },
  h2: { margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: 'var(--ngsi-navy)' },
  sectionSub: { margin: '0 0 16px', fontSize: 13, color: '#5a6070', lineHeight: 1.5 },
  goalForm: { display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' },
  applyRow: { display: 'flex', alignItems: 'center', marginTop: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 140px' },
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
  },
  saveBtn: {
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 600,
    border: '1.5px solid var(--ngsi-navy)',
    borderRadius: 8,
    background: 'var(--ngsi-navy)',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
  },
  saveBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  rows: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
    padding: '10px 0',
    borderBottom: '1px solid #f0ece2',
  },
  rowName: { display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 160px', minWidth: 0 },
  rowNameText: { fontSize: 14, fontWeight: 600, color: 'var(--ngsi-navy)' },
  rowStatus: { fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' },
  rowErr: { fontSize: 12, color: '#c0524a' },
  hint: { fontSize: 13, color: '#8a8f99', margin: 0 },
  warn: { fontSize: 13, color: '#9a6a1a', margin: '12px 0 0' },
  error: { fontSize: 13, color: '#c0524a', margin: '12px 0 0' },
  retryBtn: {
    marginTop: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    borderRadius: 6,
    background: 'var(--ngsi-navy)',
    color: '#fff',
    cursor: 'pointer',
  },
}
