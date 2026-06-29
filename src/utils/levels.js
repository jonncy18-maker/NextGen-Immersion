export const LEVELS = [
  { id: 'a1', label: 'A1', name: 'Starter', minHours: 0, maxHours: 150 },
  { id: 'a2', label: 'A2', name: 'Elementary', minHours: 150, maxHours: 300 },
  { id: 'b1', label: 'B1', name: 'Pre-Intermediate', minHours: 300, maxHours: 600 },
  { id: 'b2', label: 'B2', name: 'Upper Intermediate', minHours: 600, maxHours: 1000 },
  { id: 'c1', label: 'C1', name: 'Advanced', minHours: 1000, maxHours: 1500 },
  { id: 'c2', label: 'C2', name: 'Mastery', minHours: 1500, maxHours: Infinity },
]

// Returns the level object for a given number of hours
export function getLevelForHours(hours) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (hours >= LEVELS[i].minHours) return LEVELS[i]
  }
  return LEVELS[0]
}

// Returns the next level object, or null if C2
export function getNextLevel(currentLevelId) {
  const idx = LEVELS.findIndex(l => l.id === currentLevelId)
  return idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null
}

// Returns progress within the current level as a 0–1 ratio
export function getLevelProgress(hours) {
  const current = getLevelForHours(hours)
  const next = getNextLevel(current.id)
  if (!next) return 1 // C2 — fully done
  const range = next.minHours - current.minHours
  return Math.min((hours - current.minHours) / range, 1)
}
