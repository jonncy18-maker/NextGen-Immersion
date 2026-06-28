// Big hours counter display — always 1 decimal place
export function formatHoursDisplay(hours) {
  return hours.toFixed(1) + 'h'
}

// Short format for stats — no decimal, human-friendly
export function formatHoursShort(hours) {
  if (hours === null || hours === undefined) return '—'
  const totalMinutes = Math.round(hours * 60)
  if (totalMinutes < 1) return '< 1m'
  if (totalMinutes < 60) return `${totalMinutes}m`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// "Today", "Yesterday", "3 days ago", or "Jun 23" for older
export function formatRelativeDate(isoStr) {
  if (!isoStr) return 'No sessions yet'
  const date = new Date(isoStr)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// "Dec 31, 2026"
export function formatTargetDate(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
