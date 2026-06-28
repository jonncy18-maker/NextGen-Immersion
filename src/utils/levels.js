export const LEVELS = [
  { id: 'super_beginner', label: 'Super Beginner', cefr: 'A1–A2', minHours: 0, maxHours: 150 },
  { id: 'beginner', label: 'Beginner', cefr: 'A2–B1', minHours: 150, maxHours: 300 },
  { id: 'intermediate', label: 'Intermediate', cefr: 'B1–B2', minHours: 300, maxHours: 600 },
  { id: 'advanced', label: 'Advanced', cefr: 'B2–C1', minHours: 600, maxHours: Infinity },
]

// Returns the level object for a given number of hours
export function getLevelForHours(hours) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (hours >= LEVELS[i].minHours) return LEVELS[i]
  }
  return LEVELS[0]
}

// Returns the next level object, or null if Advanced
export function getNextLevel(currentLevelId) {
  const idx = LEVELS.findIndex(l => l.id === currentLevelId)
  return idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null
}

// Returns progress within the current level as a 0–1 ratio
export function getLevelProgress(hours) {
  const current = getLevelForHours(hours)
  const next = getNextLevel(current.id)
  if (!next) return 1 // Advanced — fully done
  const range = next.minHours - current.minHours
  return Math.min((hours - current.minHours) / range, 1)
}
