// 3-month calendar heatmap.
// Green  = daily goal met
// Yellow = hours logged but below goal
// Red    = no hours logged on an active past day
// Gray   = before program start or future
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const COLOR_GREEN  = '#bbf7d0'
const COLOR_YELLOW = '#fef08a'
const COLOR_RED    = '#fecaca'
const COLOR_GRAY   = '#f0ece2'
const COLOR_FUTURE = 'transparent'

function getCellColor(dateStr, hoursMap, dailyGoal, startDate) {
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr > today) return COLOR_FUTURE
  if (startDate && dateStr < startDate) return COLOR_GRAY

  const hours = hoursMap[dateStr] ?? 0
  if (hours === 0) return COLOR_RED
  if (!dailyGoal || hours >= dailyGoal) return COLOR_GREEN
  return COLOR_YELLOW
}

function renderMonth(year, month, hoursMap, dailyGoal, startDate) {
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push({ day: d, date: `${year}-${mm}-${dd}` })
  }

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  // Pad last week to 7 columns
  const lastWeek = weeks[weeks.length - 1]
  while (lastWeek.length < 7) lastWeek.push(null)

  return { label: `${MONTH_NAMES[month]} ${year}`, weeks }
}

export default function CalendarHeatmap({ days, dailyGoal, startDate }) {
  const hoursMap = {}
  if (days) days.forEach(d => { hoursMap[d.date] = d.hours })

  const now = new Date()
  const months = []
  for (let m = 2; m >= 0; m--) {
    const y = now.getFullYear()
    const mo = now.getMonth() - m
    const d = new Date(y, mo, 1)
    months.push(renderMonth(d.getFullYear(), d.getMonth(), hoursMap, dailyGoal, startDate))
  }

  const goalLabel = dailyGoal ? `${(dailyGoal * 60).toFixed(0)} min/day goal` : 'Daily goal not set'

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.title}>Activity Calendar</span>
        <span style={styles.goalLabel}>{goalLabel}</span>
      </div>

      <div style={styles.legend}>
        <LegendDot color={COLOR_GREEN} label="Goal met" />
        <LegendDot color={COLOR_YELLOW} label="Partial" />
        <LegendDot color={COLOR_RED} label="No hours" />
        <LegendDot color={COLOR_GRAY} label="Not started" />
      </div>

      <div style={styles.monthsWrap}>
        {months.map(m => (
          <div key={m.label} style={styles.monthBlock}>
            <div style={styles.monthLabel}>{m.label}</div>
            <div style={styles.grid}>
              {DAY_HEADERS.map(h => (
                <div key={h} style={styles.dayHeader}>{h}</div>
              ))}
              {m.weeks.map((week, wi) =>
                week.map((cell, ci) => {
                  if (!cell) return <div key={`empty-${wi}-${ci}`} style={styles.emptyCell} />
                  const color = getCellColor(cell.date, hoursMap, dailyGoal, startDate)
                  const hours = hoursMap[cell.date]
                  const tip = hours != null
                    ? `${cell.date}: ${hours.toFixed(1)}h`
                    : `${cell.date}: 0h`
                  return (
                    <div
                      key={cell.date}
                      title={tip}
                      style={{
                        ...styles.cell,
                        backgroundColor: color || COLOR_FUTURE,
                        border: color === COLOR_FUTURE ? 'none' : '1px solid rgba(0,0,0,0.06)',
                      }}
                    >
                      <span style={styles.dayNum}>{cell.day}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <span style={styles.legendItem}>
      <span style={{ ...styles.dot, backgroundColor: color, border: '1px solid rgba(0,0,0,0.08)' }} />
      <span style={styles.legendText}>{label}</span>
    </span>
  )
}

const styles = {
  root: {
    padding: '16px 20px 18px',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '10px',
  },
  title: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#162040',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  goalLabel: {
    fontSize: '12px',
    color: '#8a8f99',
  },
  legend: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap',
    marginBottom: '14px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  dot: {
    display: 'inline-block',
    width: '12px',
    height: '12px',
    borderRadius: '3px',
    flexShrink: 0,
  },
  legendText: {
    fontSize: '11px',
    color: '#8a8f99',
  },
  monthsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  monthBlock: {
    width: '100%',
  },
  monthLabel: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#162040',
    marginBottom: '6px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '3px',
  },
  dayHeader: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#8a8f99',
    textAlign: 'center',
    paddingBottom: '3px',
    textTransform: 'uppercase',
  },
  cell: {
    aspectRatio: '1',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
    minWidth: 0,
  },
  emptyCell: {
    aspectRatio: '1',
    minWidth: 0,
  },
  dayNum: {
    fontSize: '11px',
    fontWeight: '500',
    color: 'rgba(22,32,64,0.6)',
    lineHeight: 1,
    userSelect: 'none',
  },
}
