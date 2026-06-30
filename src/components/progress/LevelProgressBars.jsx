import { LEVELS } from '../../utils/levels.js'

// DS-style level progress bars.
// Each CEFR level shows a horizontal bar filled proportional to hours completed
// within that level. Completed levels = navy, current level = gold, future = gray.

const C2_DISPLAY_MAX = 500 // practical display cap for C2 (Mastery is open-ended)

export default function LevelProgressBars({ currentHours }) {
  const hours = Number(currentHours ?? 0)

  return (
    <div style={styles.root}>
      <div style={styles.header}>Level Roadmap</div>
      <div style={styles.bars}>
        {LEVELS.map(level => {
          const rangeMax = level.id === 'c2' ? C2_DISPLAY_MAX : level.maxHours - level.minHours
          const hoursInLevel = Math.min(Math.max(hours - level.minHours, 0), rangeMax)
          const pct = Math.min(hoursInLevel / rangeMax, 1) * 100

          const isCompleted = level.id !== 'c2'
            ? hours >= level.maxHours
            : hours >= level.minHours + C2_DISPLAY_MAX
          const isCurrent = hours >= level.minHours && !isCompleted

          const barColor = isCompleted ? '#162040' : isCurrent ? '#C9A84C' : '#e8e3da'
          const textColor = isCurrent ? '#162040' : isCompleted ? '#162040' : '#8a8f99'

          const displayMax = level.id === 'c2' ? `${C2_DISPLAY_MAX}h+` : `${rangeMax}h`
          const displayHours = `${hoursInLevel.toFixed(0)}h`

          return (
            <div key={level.id} style={styles.row}>
              <div style={styles.levelLabel}>
                <span style={{ ...styles.levelTag, color: textColor, fontWeight: isCurrent ? '700' : '600' }}>
                  {level.label}
                </span>
                <span style={{ ...styles.levelName, color: textColor }}>
                  {level.name}
                  {isCompleted && <span style={styles.check}> ✓</span>}
                </span>
              </div>
              <div style={styles.barTrack}>
                <div
                  style={{
                    ...styles.barFill,
                    width: `${pct}%`,
                    backgroundColor: barColor,
                    minWidth: pct > 0 ? '6px' : '0',
                  }}
                />
                {isCurrent && pct > 0 && pct < 100 && (
                  <div style={{ ...styles.barFillGlow, width: `${pct}%` }} />
                )}
              </div>
              <div style={styles.hoursLabel}>
                <span style={{ ...styles.hoursNum, color: textColor }}>
                  {displayHours}
                </span>
                <span style={styles.hoursMax}>/{displayMax}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div style={styles.legend}>
        <LegendItem color="#162040" label="Completed" />
        <LegendItem color="#C9A84C" label="Current level" />
        <LegendItem color="#e8e3da" label="Upcoming" />
      </div>
    </div>
  )
}

function LegendItem({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)' }} />
      <span style={{ fontSize: 11, color: '#8a8f99' }}>{label}</span>
    </span>
  )
}

const styles = {
  root: {
    padding: '16px 20px 18px',
    borderTop: '1px solid #f0ece2',
  },
  header: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#162040',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '14px',
  },
  bars: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '80px 1fr 64px',
    alignItems: 'center',
    gap: '10px',
  },
  levelLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    minWidth: 0,
  },
  levelTag: {
    fontSize: '13px',
    lineHeight: 1.1,
    fontFamily: 'Georgia, serif',
  },
  levelName: {
    fontSize: '10px',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  check: {
    color: '#1D9E75',
    fontWeight: '700',
  },
  barTrack: {
    position: 'relative',
    height: '14px',
    backgroundColor: '#f0ece2',
    borderRadius: '7px',
    overflow: 'hidden',
  },
  barFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: '7px',
    transition: 'width 0.6s ease',
  },
  barFillGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: '7px',
    background: 'linear-gradient(90deg, transparent 60%, rgba(255,255,255,0.35) 100%)',
    pointerEvents: 'none',
  },
  hoursLabel: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '1px',
    justifyContent: 'flex-end',
  },
  hoursNum: {
    fontSize: '12px',
    fontWeight: '700',
    lineHeight: 1,
  },
  hoursMax: {
    fontSize: '10px',
    color: '#8a8f99',
    lineHeight: 1,
  },
  legend: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap',
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid #f0ece2',
  },
}
