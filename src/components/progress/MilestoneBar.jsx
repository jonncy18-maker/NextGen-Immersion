import { getLevelForHours, getNextLevel, getLevelProgress } from '../../utils/levels.js'

export default function MilestoneBar({ currentHours }) {
  const current = getLevelForHours(currentHours)
  const next = getNextLevel(current.id)
  const progress = getLevelProgress(currentHours)

  const containerStyle = {
    padding: '1.25rem 1.5rem',
  }

  const labelsRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
    fontSize: '0.8rem',
    color: '#6b7280',
    fontWeight: '600',
  }

  const trackStyle = {
    width: '100%',
    height: '10px',
    backgroundColor: '#ede7d9',
    borderRadius: '999px',
    overflow: 'hidden',
  }

  const fillStyle = {
    height: '100%',
    width: `${progress * 100}%`,
    backgroundColor: '#C9A84C',
    borderRadius: '999px',
    transition: 'width 0.6s ease',
  }

  const advancedStyle = {
    textAlign: 'center',
    fontSize: '0.9rem',
    color: '#C9A84C',
    fontWeight: '700',
    padding: '0.5rem 0',
  }

  if (!next) {
    return (
      <div style={containerStyle}>
        <p style={advancedStyle}>Advanced — Maximum Level Reached</p>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={labelsRowStyle}>
        <span>
          {current.label} &middot; {current.minHours}h
        </span>
        <span>
          {next.label} &middot; {next.minHours}h
        </span>
      </div>
      <div style={trackStyle}>
        <div style={fillStyle} />
      </div>
    </div>
  )
}
