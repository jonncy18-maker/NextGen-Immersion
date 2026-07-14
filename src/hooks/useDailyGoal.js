// Daily immersion goal calculation, shared by Watch.jsx (inline DailyBar) and
// Home.jsx (circular "Today's Goal" ring). Extracted from Watch.jsx, where it
// used to be computed inline from `useProgress()`'s data.
//
// Daily target = total program hours ÷ program duration in days.
//
// Takes an already-fetched `progress` object (the shape returned by
// /api/progress) rather than calling useProgress() itself, so callers that
// already hold progress data (Watch.jsx) don't trigger a second fetch.
export function useDailyGoal(progress) {
  const dailyTargetHours =
    progress?.target_hours && progress?.start_date && progress?.target_date
      ? progress.target_hours /
        Math.max(1, (new Date(progress.target_date) - new Date(progress.start_date)) / 86400000)
      : null
  const hoursToday = progress?.hours_today ?? 0

  return { hoursToday, dailyTargetHours }
}
