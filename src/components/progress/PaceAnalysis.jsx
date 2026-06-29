import { getPaceColor } from '../../utils/pace.js'

export default function PaceAnalysis({ currentHours, expectedHours, targetHours, status, delta }) {
  const isPending = status === 'PENDING' || !targetHours

  if (isPending) {
    return (
      <div style={styles.wrap}>
        <p style={styles.pendingText}>Goal not started — no pace data yet.</p>
      </div>
    )
  }

  if (currentHours >= targetHours) {
    return (
      <div style={{ ...styles.wrap, borderLeft: `4px solid #1D9E75` }}>
        <p style={{ ...styles.bigLabel, color: '#1D9E75' }}>Goal reached</p>
        <p style={styles.subLabel}>{currentHours.toFixed(1)}h of {targetHours}h completed</p>
      </div>
    )
  }

  const accent = getPaceColor(status)
  const absDelta = Math.abs(delta)
  const isAhead = delta <= 0

  return (
    <div style={{ ...styles.wrap, borderLeft: `4px solid ${accent}` }}>
      <p style={{ ...styles.bigLabel, color: accent }}>
        {isAhead
          ? `${absDelta.toFixed(1)}h ahead of pace`
          : `${absDelta.toFixed(1)}h behind pace`}
      </p>
      <p style={styles.subLabel}>
        {status === 'ON_TRACK' ? 'On Track' : 'At Risk'} ·{' '}
        {expectedHours.toFixed(1)}h expected by today
      </p>
    </div>
  )
}

const styles = {
  wrap: {
    padding: '14px 16px',
    borderLeft: '4px solid #e8e3da',
  },
  pendingText: {
    margin: 0,
    fontSize: 14,
    color: '#8a8f99',
    fontStyle: 'italic',
  },
  bigLabel: {
    margin: '0 0 4px',
    fontSize: 22,
    fontWeight: 700,
    fontFamily: 'Georgia, serif',
  },
  subLabel: {
    margin: 0,
    fontSize: 13,
    color: '#5a6070',
  },
}
