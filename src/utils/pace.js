// Returns a hex color for the status
export function getPaceColor(status) {
  if (status === 'ON_TRACK') return '#1D9E75'
  if (status === 'AT_RISK') return '#C95B3A'
  return '#8a8f99' // PENDING or unknown
}

// Returns a display label for the status
export function getPaceLabel(status) {
  if (status === 'ON_TRACK') return 'On Track'
  if (status === 'AT_RISK') return 'At Risk'
  return 'Pending'
}

// Returns required hours per week to hit the target; null if dates are missing
export function getWeeklyTarget(targetHours, startDate, targetDate) {
  if (!targetHours || !startDate || !targetDate) return null
  const start = new Date(startDate)
  const end = new Date(targetDate)
  const weeksTotal = (end - start) / (7 * 24 * 3600 * 1000)
  if (weeksTotal <= 0) return null
  return targetHours / weeksTotal
}

// "+2.3h ahead" or "1.1h behind"
export function formatDelta(currentHours, expectedHours) {
  const delta = currentHours - expectedHours
  if (delta >= 0) return `+${delta.toFixed(1)}h ahead`
  return `${Math.abs(delta).toFixed(1)}h behind`
}
