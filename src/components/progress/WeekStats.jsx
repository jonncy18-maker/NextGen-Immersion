import { formatHoursShort, formatRelativeDate } from '../../utils/timeFormat.js'
import { getWeeklyTarget } from '../../utils/pace.js'

export default function WeekStats({ hoursThisWeek, targetHours, startDate, targetDate, lastSessionAt }) {
  const weeklyTarget = getWeeklyTarget(targetHours, startDate, targetDate)

  const rowStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    padding: '0 1.5rem 1.5rem',
  }

  const cardStyle = {
    flex: '1 1 140px',
    backgroundColor: '#ede7d9',
    borderLeft: '4px solid #C9A84C',
    borderRadius: '6px',
    padding: '0.75rem 1rem',
  }

  const labelStyle = {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.3rem',
  }

  const valueStyle = {
    fontSize: '1.35rem',
    fontWeight: '700',
    color: '#162040',
    fontFamily: 'Georgia, serif',
  }

  return (
    <div style={rowStyle}>
      <div style={cardStyle}>
        <p style={labelStyle}>This Week</p>
        <p style={valueStyle}>{formatHoursShort(hoursThisWeek)}</p>
      </div>
      <div style={cardStyle}>
        <p style={labelStyle}>Weekly Target</p>
        <p style={valueStyle}>{weeklyTarget !== null ? formatHoursShort(weeklyTarget) : '—'}</p>
      </div>
      <div style={cardStyle}>
        <p style={labelStyle}>Last Session</p>
        <p style={valueStyle}>{formatRelativeDate(lastSessionAt)}</p>
      </div>
    </div>
  )
}
