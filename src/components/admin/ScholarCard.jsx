import { formatHoursShort, formatRelativeDate } from '../../utils/timeFormat.js'
import { getPaceColor, getPaceLabel, formatDelta } from '../../utils/pace.js'

// One scholar's pace summary. Click to open the drill-down detail view.
// Statuses come straight from the scholar_pace view: ON_TRACK | AT_RISK | PENDING.
export default function ScholarCard({ scholar, onSelect }) {
  const {
    scholar_name,
    current_hours,
    expected_hours,
    hours_this_week,
    last_session_at,
    target_hours,
    status,
  } = scholar

  const isPending = status === 'PENDING' || !target_hours
  const accent = getPaceColor(status)
  const current = Number(current_hours ?? 0)

  return (
    <button
      type="button"
      onClick={() => onSelect && onSelect(scholar)}
      style={styles.card}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 14px rgba(22,32,64,0.14)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(22,32,64,0.08)')}
    >
      <div style={{ ...styles.accentBar, background: accent }} />

      <div style={styles.body}>
        <div style={styles.topRow}>
          <span style={styles.name}>{scholar_name || 'Unnamed scholar'}</span>
          <span style={{ ...styles.pill, background: accent }}>{getPaceLabel(status)}</span>
        </div>

        <div style={styles.hoursRow}>
          <span style={styles.hoursBig}>{current.toFixed(1)}h</span>
          {!isPending && (
            <span style={styles.hoursSub}>of {target_hours}h target</span>
          )}
        </div>

        {isPending ? (
          <p style={styles.pendingNote}>Goal clock not started</p>
        ) : (
          <p style={{ ...styles.delta, color: accent }}>
            {formatDelta(current, Number(expected_hours ?? 0))}
            <span style={styles.deltaMuted}>
              {' '}
              (expected {Number(expected_hours ?? 0).toFixed(1)}h)
            </span>
          </p>
        )}

        <div style={styles.footRow}>
          <span style={styles.footItem}>
            <span style={styles.footLabel}>This week</span>
            {formatHoursShort(hours_this_week)}
          </span>
          <span style={styles.footItem}>
            <span style={styles.footLabel}>Last session</span>
            {formatRelativeDate(last_session_at)}
          </span>
        </div>
      </div>
    </button>
  )
}

const styles = {
  card: {
    display: 'flex',
    textAlign: 'left',
    width: '100%',
    padding: 0,
    background: '#fff',
    border: '1px solid #e8e3da',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(22,32,64,0.08)',
    cursor: 'pointer',
    overflow: 'hidden',
    fontFamily: 'inherit',
    transition: 'box-shadow 0.15s',
  },
  accentBar: { width: 5, flexShrink: 0 },
  body: { flex: 1, padding: '14px 16px', minWidth: 0 },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  name: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  pill: {
    flexShrink: 0,
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '3px 9px',
    borderRadius: 999,
  },
  hoursRow: { display: 'flex', alignItems: 'baseline', gap: 8 },
  hoursBig: {
    fontFamily: 'Georgia, serif',
    fontSize: 30,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
    lineHeight: 1.1,
  },
  hoursSub: { fontSize: 12, color: '#8a8f99' },
  delta: { margin: '6px 0 0', fontSize: 13, fontWeight: 600 },
  deltaMuted: { color: '#8a8f99', fontWeight: 400 },
  pendingNote: { margin: '6px 0 0', fontSize: 13, color: '#8a8f99', fontStyle: 'italic' },
  footRow: {
    display: 'flex',
    gap: 18,
    marginTop: 12,
    paddingTop: 10,
    borderTop: '1px solid #f0ece2',
  },
  footItem: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ngsi-navy)',
  },
  footLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 2,
  },
}
