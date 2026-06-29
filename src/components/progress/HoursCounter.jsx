import { formatHoursDisplay } from '../../utils/timeFormat.js'
import { getPaceColor, getPaceLabel } from '../../utils/pace.js'
import { LEVELS } from '../../utils/levels.js'

export default function HoursCounter({
  currentHours,
  currentLevel,
  nextLevel,
  targetHours,
  targetLevel,
  status,
}) {
  const isPending = status === 'PENDING' || !targetHours

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '2rem 1.5rem 1.5rem',
    position: 'relative',
  }

  const hoursNumberStyle = {
    fontFamily: 'Georgia, serif',
    fontSize: '4rem',
    fontWeight: '700',
    color: '#C9A84C',
    lineHeight: 1.1,
    margin: 0,
  }

  const levelBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: '#C9A84C',
    color: '#162040',
    fontWeight: '700',
    fontSize: '0.8rem',
    padding: '0.3rem 0.75rem',
    borderRadius: '999px',
    marginTop: '0.75rem',
    letterSpacing: '0.03em',
  }

  const cefrTagStyle = {
    backgroundColor: 'rgba(22,32,64,0.15)',
    color: '#162040',
    fontSize: '0.7rem',
    fontWeight: '600',
    padding: '0.1rem 0.4rem',
    borderRadius: '999px',
  }

  const targetTextStyle = {
    marginTop: '0.6rem',
    fontSize: '0.9rem',
    color: '#6b7280',
  }

  const statusPillStyle = {
    display: 'inline-block',
    marginTop: '1rem',
    backgroundColor: getPaceColor(status),
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '0.25rem 0.65rem',
    borderRadius: '999px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  }

  const targetLevelObj = targetLevel ? LEVELS.find(l => l.id === targetLevel) : null
  const targetLevelLabel = targetLevelObj
    ? `${targetLevelObj.label} ${targetLevelObj.name}`
    : targetLevel || null

  return (
    <div style={containerStyle}>
      <p style={hoursNumberStyle}>{formatHoursDisplay(currentHours)}</p>

      {currentLevel && (
        <span style={levelBadgeStyle}>
          {currentLevel.label}
          <span style={cefrTagStyle}>{currentLevel.name}</span>
        </span>
      )}

      <p style={targetTextStyle}>
        {isPending
          ? 'Goal not started yet'
          : `of ${targetHours}h to ${targetLevelLabel || 'next level'}`}
      </p>

      <span style={statusPillStyle}>{getPaceLabel(status)}</span>
    </div>
  )
}
