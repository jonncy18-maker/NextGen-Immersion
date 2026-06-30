import { useState } from 'react'
import { useProgress } from '../hooks/useProgress.js'
import { useDailyCalendar } from '../hooks/useDailyCalendar.js'
import HoursCounter from '../components/progress/HoursCounter.jsx'
import MilestoneBar from '../components/progress/MilestoneBar.jsx'
import PaceAnalysis from '../components/progress/PaceAnalysis.jsx'
import CategoryBreakdown from '../components/progress/CategoryBreakdown.jsx'
import WeekStats from '../components/progress/WeekStats.jsx'
import CalendarHeatmap from '../components/progress/CalendarHeatmap.jsx'
import LevelProgressBars from '../components/progress/LevelProgressBars.jsx'
import ExternalHoursButton from '../components/progress/ExternalHoursButton.jsx'
import CoachingMessage from '../components/progress/CoachingMessage.jsx'
import LevelCelebrationBanner from '../components/progress/LevelCelebrationBanner.jsx'
import DayDetailModal from '../components/admin/DayDetailModal.jsx'
import { getLevelForHours, getNextLevel } from '../utils/levels.js'

export default function Progress() {
  const { data, loading, error, refetch } = useProgress()
  const { data: calData } = useDailyCalendar()
  const [dayDetailDate, setDayDetailDate] = useState(null)

  const pageStyle = {
    backgroundColor: '#F5F0E8',
    minHeight: '100vh',
    padding: '1.5rem 1rem',
  }

  const innerStyle = {
    maxWidth: 1100,
    margin: '0 auto',
  }

  const titleStyle = {
    fontFamily: 'Georgia, serif',
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#162040',
    marginBottom: '1.25rem',
    marginTop: 0,
  }

  const cardStyle = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 1px 4px rgba(22,32,64,0.08)',
    marginBottom: '1rem',
    overflow: 'hidden',
  }

  // Loading state
  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={innerStyle}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '40vh',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                border: '4px solid #ede7d9',
                borderTop: '4px solid #162040',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: '#162040', fontSize: '0.95rem', margin: 0 }}>
              Loading your progress...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div style={pageStyle}>
        <div style={innerStyle}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '40vh',
              gap: '1rem',
              textAlign: 'center',
            }}
          >
            <p style={{ color: '#162040', fontSize: '1rem', margin: 0 }}>
              Couldn&apos;t load your progress.
            </p>
            <button
              onClick={refetch}
              style={{
                backgroundColor: '#162040',
                color: '#F5F0E8',
                border: 'none',
                borderRadius: '6px',
                padding: '0.6rem 1.25rem',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // PENDING state
  if (!data || data.status === 'PENDING' || !data.target_hours) {
    const currentLevel = data ? getLevelForHours(data.current_hours ?? 0) : getLevelForHours(0)
    return (
      <div style={pageStyle}>
        <div style={innerStyle}>
          <h1 style={titleStyle}>My Progress</h1>
          <div style={cardStyle}>
            <HoursCounter
              currentHours={data?.current_hours ?? 0}
              currentLevel={currentLevel}
              nextLevel={getNextLevel(currentLevel.id)}
              targetHours={null}
              targetLevel={null}
              status="PENDING"
            />
          </div>
          <p
            style={{
              textAlign: 'center',
              color: '#8a8f99',
              fontSize: '0.9rem',
              marginTop: '0.5rem',
            }}
          >
            Your progress clock starts once your goal is assigned.
          </p>
        </div>
      </div>
    )
  }

  // Normal state
  const currentLevel = getLevelForHours(data.current_hours)
  const nextLevel = getNextLevel(currentLevel.id)

  return (
    <div style={pageStyle}>
      <div style={innerStyle}>
        <h1 style={titleStyle}>My Progress</h1>

        <LevelCelebrationBanner />

        <div style={detailGridStyle}>
          {/* Left column */}
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <HoursCounter
              currentHours={data.current_hours}
              currentLevel={currentLevel}
              nextLevel={nextLevel}
              targetHours={data.target_hours}
              targetLevel={data.target_level}
              status={data.status}
            />
            <MilestoneBar currentHours={data.current_hours} />
            <PaceAnalysis
              currentHours={data.current_hours}
              expectedHours={data.expected_hours}
              targetHours={data.target_hours}
              status={data.status}
              delta={data.delta ?? 0}
            />
            <CategoryBreakdown
              libraryHours={data.library_hours}
              videoExternalHours={data.video_external_hours}
              chatgptHours={data.chatgpt_hours}
              mentorHours={data.mentor_hours}
              targetChatgptHours={data.target_chatgpt_hours}
              targetMentorHours={data.target_mentor_hours}
              expectedHours={data.expected_hours}
              targetHours={data.target_hours}
            />
            <CoachingMessage />
          </div>

          {/* Right column */}
          <div>
            <div style={cardStyle}>
              <WeekStats
                hoursThisWeek={data.hours_this_week}
                targetHours={data.target_hours}
                startDate={data.start_date}
                targetDate={data.target_date}
                lastSessionAt={data.last_session_at}
                videoHoursThisWeek={data.video_hours_this_week}
                externalHoursThisWeek={data.external_hours_this_week}
              />
            </div>
            <div style={cardStyle}>
              <LevelProgressBars currentHours={data.current_hours} />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <ExternalHoursButton userId={data.user_id} onLogged={refetch} />
            </div>
          </div>
        </div>

        {calData && (
          <div style={{ ...cardStyle, marginTop: 16 }}>
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
          userId={data.user_id}
          date={dayDetailDate}
          onClose={() => setDayDetailDate(null)}
          readOnly
        />
      )}
    </div>
  )
}

const detailGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(420px, 100%), 1fr))',
  gap: 16,
  marginBottom: 0,
  alignItems: 'start',
}
