import { useState, useEffect } from 'react'
import { useScholars } from '../hooks/useScholars.js'
import { useScholarCalendar } from '../hooks/useScholarCalendar.js'
import ScholarCard from '../components/admin/ScholarCard.jsx'
import HoursCounter from '../components/progress/HoursCounter.jsx'
import MilestoneBar from '../components/progress/MilestoneBar.jsx'
import PaceAnalysis from '../components/progress/PaceAnalysis.jsx'
import CategoryBreakdown from '../components/progress/CategoryBreakdown.jsx'
import WeekStats from '../components/progress/WeekStats.jsx'
import CalendarHeatmap from '../components/progress/CalendarHeatmap.jsx'
import LevelProgressBars from '../components/progress/LevelProgressBars.jsx'
import ExternalHoursButton from '../components/progress/ExternalHoursButton.jsx'
import DayDetailModal from '../components/admin/DayDetailModal.jsx'
import ScholarDigest from '../components/admin/ScholarDigest.jsx'
import { getLevelForHours, getNextLevel } from '../utils/levels.js'
import { formatHoursShort } from '../utils/timeFormat.js'

const SELECTED_KEY = 'adminProgress_selectedId'

export default function AdminProgress() {
  const { data, loading, error, refetch } = useScholars()
  const [selectedId, setSelectedId] = useState(() => sessionStorage.getItem(SELECTED_KEY) || null)
  const [dayDetailDate, setDayDetailDate] = useState(null)

  const scholars = data || []
  const selected = scholars.find(s => s.user_id === selectedId) ?? null

  useEffect(() => {
    if (selectedId) sessionStorage.setItem(SELECTED_KEY, selectedId)
    else sessionStorage.removeItem(SELECTED_KEY)
  }, [selectedId])

  const { data: calData } = useScholarCalendar(selected?.user_id ?? null)

  function selectScholar(scholar) {
    setSelectedId(scholar?.user_id ?? null)
    setDayDetailDate(null)
  }

  function goBack() {
    setSelectedId(null)
    setDayDetailDate(null)
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.center}>
            <div style={styles.spinner} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={styles.centerText}>Loading scholars…</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.center}>
            <p style={styles.centerText}>Couldn&apos;t load the dashboard.</p>
            <button style={styles.retryBtn} onClick={refetch}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Drill-down: scholar Progress layout, filtered to one scholar.
  if (selected) {
    const currentHours = Number(selected.current_hours ?? 0)
    const currentLevel = getLevelForHours(currentHours)
    const nextLevel = getNextLevel(currentLevel.id)
    return (
      <div style={styles.page}>
        <div style={styles.detailContainer}>
          <button style={styles.backBtn} onClick={goBack}>
            ← All scholars
          </button>
          <h1 style={styles.title}>{selected.scholar_name || 'Scholar'}</h1>

          <div style={styles.detailGrid}>
            {/* Left column: main progress stats */}
            <div style={{ ...styles.card, marginBottom: 0 }}>
              <HoursCounter
                currentHours={currentHours}
                currentLevel={currentLevel}
                nextLevel={nextLevel}
                targetHours={selected.target_hours}
                targetLevel={selected.target_level}
                status={selected.status}
              />
              <MilestoneBar currentHours={currentHours} />
              <PaceAnalysis
                currentHours={currentHours}
                expectedHours={Number(selected.expected_hours ?? 0)}
                targetHours={selected.target_hours}
                status={selected.status}
                delta={selected.delta ?? 0}
              />
              <CategoryBreakdown
                libraryHours={Number(selected.library_hours ?? 0)}
                videoExternalHours={Number(selected.video_external_hours ?? 0)}
                chatgptHours={Number(selected.chatgpt_hours ?? 0)}
                mentorHours={Number(selected.mentor_hours ?? 0)}
                targetChatgptHours={selected.target_chatgpt_hours != null ? Number(selected.target_chatgpt_hours) : null}
                targetMentorHours={selected.target_mentor_hours != null ? Number(selected.target_mentor_hours) : null}
                expectedHours={Number(selected.expected_hours ?? 0)}
                targetHours={selected.target_hours}
              />
            </div>

            {/* Right column: week stats + level bars + log button */}
            <div>
              <div style={styles.card}>
                <WeekStats
                  hoursThisWeek={Number(selected.hours_this_week ?? 0)}
                  targetHours={selected.target_hours}
                  startDate={selected.start_date}
                  targetDate={selected.target_date}
                  lastSessionAt={selected.last_session_at}
                />
              </div>
              <div style={styles.card}>
                <LevelProgressBars currentHours={Number(selected.current_hours ?? 0)} />
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <ExternalHoursButton userId={selected.user_id} onLogged={refetch} />
              </div>
              <div style={{ ...styles.card, marginTop: '0.75rem' }}>
                <ScholarDigest userId={selected.user_id} />
              </div>
            </div>
          </div>

          {calData && (
            <div style={styles.card}>
              <CalendarHeatmap
                days={calData.days}
                dailyGoal={
                  calData.target_hours && calData.start_date && calData.target_date
                    ? calData.target_hours /
                      Math.max(
                        1,
                        (new Date(calData.target_date) - new Date(calData.start_date)) /
                          86400000
                      )
                    : null
                }
                startDate={calData.start_date}
                onDayClick={setDayDetailDate}
              />
            </div>
          )}
        </div>

        {dayDetailDate && (
          <DayDetailModal
            userId={selected.user_id}
            date={dayDetailDate}
            onClose={() => setDayDetailDate(null)}
          />
        )}
      </div>
    )
  }

  // Overview stats
  const totalScholars = scholars.length
  const totalHours = scholars.reduce((sum, s) => sum + Number(s.current_hours ?? 0), 0)
  const atRisk = scholars.filter((s) => s.status === 'AT_RISK').length

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Scholar Dashboard</h1>

        <div style={styles.statsRow}>
          <StatCard label="Scholars" value={String(totalScholars)} />
          <StatCard label="Total Hours" value={formatHoursShort(totalHours)} />
          <StatCard
            label="At Risk"
            value={String(atRisk)}
            accent={atRisk > 0 ? '#C95B3A' : '#1D9E75'}
          />
        </div>

        {scholars.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyText}>No scholars yet.</p>
            <p style={styles.emptySub}>
              Scholars appear here once they&apos;re provisioned and assigned the program goal.
            </p>
          </div>
        ) : (
          <div style={styles.grid}>
            {scholars.map((s) => (
              <ScholarCard key={s.user_id} scholar={s} onSelect={selectScholar} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={{ ...styles.statValue, ...(accent ? { color: accent } : {}) }}>{value}</p>
    </div>
  )
}

const styles = {
  page: { minHeight: 'calc(100vh - 56px)', background: 'var(--ngsi-cream)' },
  container: { maxWidth: 1200, margin: '0 auto', padding: 24 },
  detailContainer: { maxWidth: 1100, margin: '0 auto', padding: 24 },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(420px, 100%), 1fr))',
    gap: 16,
    marginBottom: 16,
    alignItems: 'start',
  },
  title: { margin: '0 0 18px', fontSize: 24, fontWeight: 700, color: 'var(--ngsi-navy)', fontFamily: 'Georgia, serif' },
  statsRow: { display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 24 },
  statCard: {
    flex: '1 1 140px',
    background: '#fff',
    border: '1px solid #e8e3da',
    borderRadius: 12,
    padding: '16px 18px',
    boxShadow: '0 1px 4px rgba(22,32,64,0.08)',
  },
  statLabel: {
    margin: '0 0 6px',
    fontSize: 11,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statValue: { margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--ngsi-navy)', fontFamily: 'Georgia, serif' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(22,32,64,0.08)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--ngsi-navy)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 0',
    marginBottom: 8,
    fontFamily: 'inherit',
  },
  empty: { textAlign: 'center', padding: '48px 24px' },
  emptyText: { margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'var(--ngsi-navy)' },
  emptySub: { margin: 0, fontSize: 13, color: '#8a8f99' },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40vh',
    gap: 16,
  },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid #ede7d9',
    borderTop: '4px solid #162040',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  centerText: { color: 'var(--ngsi-navy)', fontSize: 14, margin: 0 },
  retryBtn: {
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    borderRadius: 6,
    background: 'var(--ngsi-navy)',
    color: '#fff',
    cursor: 'pointer',
  },
}
