import { useState } from 'react'

// Single-month activity calendar.
// Green  = daily goal met
// Yellow = hours logged but below goal
// Red    = no hours on an active past day
// Gray   = before program start date or future
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const COLOR_GREEN  = '#bbf7d0'
const COLOR_YELLOW = '#fef08a'
const COLOR_RED    = '#fecaca'
const COLOR_GRAY   = '#f0ece2'

// Program floor: nothing before June 2026
const FLOOR_YEAR = 2026
const FLOOR_MONTH = 5 // 0-indexed

const CAT_COLORS = {
  library_hours:        '#60a5fa', // blue
  video_external_hours: '#c084fc', // purple
  chatgpt_hours:        '#94a3b8', // slate
  mentor_hours:         '#4ade80', // green
}
const CAT_LABELS = {
  library_hours:        'Library Video',
  video_external_hours: 'External Video',
  chatgpt_hours:        'ChatGPT',
  mentor_hours:         'Mentor',
}

function getCellColor(dateStr, daysMap, dailyGoal, startDate) {
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr > today) return null
  if (startDate && dateStr < startDate) return COLOR_GRAY
  const hours = daysMap[dateStr]?.hours ?? 0
  if (hours === 0) return COLOR_RED
  if (!dailyGoal || hours >= dailyGoal) return COLOR_GREEN
  return COLOR_YELLOW
}

function fmtHours(h) {
  if (h <= 0) return null
  if (h < 0.1) return '<0.1h'
  return `${h.toFixed(1)}h`
}

export default function CalendarHeatmap({ days, dailyGoal, startDate }) {
  const daysMap = {}
  if (days) days.forEach(d => { daysMap[d.date] = d })

  const now = new Date()
  const maxYear = now.getFullYear()
  const maxMonth = now.getMonth()

  // Min month: max(FLOOR, startDate month)
  let minYear = FLOOR_YEAR
  let minMonth = FLOOR_MONTH
  if (startDate) {
    const sy = parseInt(startDate.slice(0, 4), 10)
    const sm = parseInt(startDate.slice(5, 7), 10) - 1
    if (sy > FLOOR_YEAR || (sy === FLOOR_YEAR && sm > FLOOR_MONTH)) {
      minYear = sy
      minMonth = sm
    }
  }

  const [viewYear, setViewYear] = useState(maxYear)
  const [viewMonth, setViewMonth] = useState(maxMonth)
  const [tooltip, setTooltip] = useState(null)

  const canGoPrev = viewYear > minYear || (viewYear === minYear && viewMonth > minMonth)
  const canGoNext = viewYear < maxYear || (viewYear === maxYear && viewMonth < maxMonth)

  function goPrev() {
    if (!canGoPrev) return
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function goNext() {
    if (!canGoNext) return
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // Build cells for the viewed month
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push({ day: d, date: `${viewYear}-${mm}-${dd}` })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const goalLabel = dailyGoal
    ? `${Math.round(dailyGoal * 60)} min/day goal`
    : 'Daily goal not set'

  return (
    <div style={styles.root}>
      <div style={styles.topRow}>
        <span style={styles.title}>Activity Calendar</span>
        <span style={styles.goalLabel}>{goalLabel}</span>
      </div>

      <div style={styles.navRow}>
        <button
          onClick={goPrev}
          disabled={!canGoPrev}
          style={{ ...styles.navBtn, opacity: canGoPrev ? 1 : 0.25, cursor: canGoPrev ? 'pointer' : 'default' }}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span style={styles.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button
          onClick={goNext}
          disabled={!canGoNext}
          style={{ ...styles.navBtn, opacity: canGoNext ? 1 : 0.25, cursor: canGoNext ? 'pointer' : 'default' }}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div style={styles.legend}>
        <LegendDot color={COLOR_GREEN}  label="Goal met" />
        <LegendDot color={COLOR_YELLOW} label="Partial" />
        <LegendDot color={COLOR_RED}    label="No hours" />
        <LegendDot color={COLOR_GRAY}   label="Not started" />
      </div>

      <div style={styles.grid}>
        {DAY_HEADERS.map(h => (
          <div key={h} style={styles.dayHeader}>{h}</div>
        ))}
        {weeks.map((week, wi) =>
          week.map((cell, ci) => {
            if (!cell) return <div key={`e-${wi}-${ci}`} style={styles.emptyCell} />
            const color = getCellColor(cell.date, daysMap, dailyGoal, startDate)
            const data = daysMap[cell.date]
            const hoursLabel = data ? fmtHours(data.hours) : null

            return (
              <div
                key={cell.date}
                style={{
                  ...styles.cell,
                  backgroundColor: color ?? 'transparent',
                  border: color ? '1px solid rgba(0,0,0,0.06)' : 'none',
                }}
                onMouseEnter={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setTooltip({ x: rect.left + rect.width / 2, y: rect.top, cell, data })
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <span style={styles.dayNum}>{cell.day}</span>
                {hoursLabel && <span style={styles.cellHours}>{hoursLabel}</span>}
              </div>
            )
          })
        )}
      </div>

      {tooltip && <CalTooltip tooltip={tooltip} startDate={startDate} />}
    </div>
  )
}

function CalTooltip({ tooltip, startDate }) {
  const { x, y, cell, data } = tooltip
  const today = new Date().toISOString().slice(0, 10)
  const isFuture = cell.date > today
  const isBeforeStart = startDate && cell.date < startDate

  const cats = ['library_hours', 'video_external_hours', 'chatgpt_hours', 'mentor_hours']
    .map(k => ({ key: k, label: CAT_LABELS[k], color: CAT_COLORS[k], hours: data?.[k] ?? 0 }))
    .filter(c => c.hours > 0)

  const totalHours = data?.hours ?? 0

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y - 10,
        transform: 'translate(-50%, -100%)',
        backgroundColor: '#162040',
        color: '#F5F0E8',
        borderRadius: 8,
        padding: '9px 13px',
        fontSize: 12,
        lineHeight: 1.6,
        zIndex: 9999,
        pointerEvents: 'none',
        minWidth: 148,
        boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, color: '#F5F0E8' }}>{cell.date}</div>
      {isFuture ? (
        <div style={{ color: '#8a8f99' }}>Future day</div>
      ) : isBeforeStart ? (
        <div style={{ color: '#8a8f99' }}>Before program start</div>
      ) : totalHours === 0 ? (
        <div style={{ color: '#fca5a5' }}>No hours logged</div>
      ) : (
        <>
          <div style={{ marginBottom: 5, fontWeight: 600 }}>
            Total: {totalHours.toFixed(1)}h
          </div>
          {cats.map(c => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                backgroundColor: c.color, flexShrink: 0,
              }} />
              <span style={{ color: '#d4daea' }}>{c.label}: {c.hours.toFixed(1)}h</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        display: 'inline-block', width: 12, height: 12, borderRadius: 3,
        backgroundColor: color, border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0,
      }} />
      <span style={{ fontSize: 11, color: '#8a8f99' }}>{label}</span>
    </span>
  )
}

const styles = {
  root: { padding: '16px 20px 18px' },
  topRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: '#162040',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  goalLabel: { fontSize: 12, color: '#8a8f99' },
  navRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    fontWeight: 700,
    color: '#162040',
    padding: '0 6px',
    lineHeight: 1,
    fontFamily: 'inherit',
    userSelect: 'none',
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: 700,
    color: '#162040',
    fontFamily: 'Georgia, serif',
  },
  legend: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '3px',
  },
  dayHeader: {
    fontSize: 10,
    fontWeight: 700,
    color: '#8a8f99',
    textAlign: 'center',
    paddingBottom: 4,
    textTransform: 'uppercase',
  },
  cell: {
    aspectRatio: '1',
    borderRadius: 5,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
    minWidth: 0,
    gap: 1,
  },
  emptyCell: { aspectRatio: '1', minWidth: 0 },
  dayNum: {
    fontSize: 12,
    fontWeight: 500,
    color: 'rgba(22,32,64,0.65)',
    lineHeight: 1,
    userSelect: 'none',
  },
  cellHours: {
    fontSize: 9,
    fontWeight: 700,
    color: 'rgba(22,32,64,0.75)',
    lineHeight: 1,
    userSelect: 'none',
  },
}
