import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useProgress } from '../hooks/useProgress.js'
import { useDailyGoal } from '../hooks/useDailyGoal.js'
import { useStreak } from '../hooks/useStreak.js'
import { useVideoLibrary } from '../hooks/useVideoLibrary.js'
import VideoCard from '../components/video/VideoCard.jsx'
import { getLevelForHours, getNextLevel } from '../utils/levels.js'
import { TOPIC_CATEGORIES, ALL_TOPICS } from '../utils/topics.js'

function getTimeOfDayGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: progress, loading: progressLoading } = useProgress()
  const { hoursToday, dailyTargetHours } = useDailyGoal(progress)
  const { data: streak } = useStreak()
  const { videos, loading: videosLoading } = useVideoLibrary()

  const firstName = (progress?.scholar_name || user?.name || user?.email || 'Scholar')
    .split(' ')[0]
    .split('@')[0]

  const scholarLevelId = progress ? getLevelForHours(progress.current_hours).id : null

  const recommended = useMemo(() => {
    const unwatched = videos.filter(v => !v.watched)
    if (unwatched.length === 0) return []

    // Infer topic affinity from what the scholar has actually watched — their
    // revealed interests. The primary topic counts double vs. the secondary.
    const affinity = {}
    for (const v of videos) {
      if (!v.watched) continue
      if (v.topic_primary) affinity[v.topic_primary] = (affinity[v.topic_primary] ?? 0) + 2
      if (v.topic_secondary) affinity[v.topic_secondary] = (affinity[v.topic_secondary] ?? 0) + 1
    }

    const nextLevelId = scholarLevelId ? getNextLevel(scholarLevelId)?.id ?? null : null
    // Level tier: current level first, then the next level up, then the rest —
    // keeps the row from ever going sparse (soft weighting) while staying
    // level-aware and blending in next-level videos.
    const levelTier = v => (v.level === scholarLevelId ? 0 : v.level === nextLevelId ? 1 : 2)
    const topicScore = v => (affinity[v.topic_primary] ?? 0) + (affinity[v.topic_secondary] ?? 0)

    return unwatched
      .map((v, i) => ({ v, i, tier: levelTier(v), topic: topicScore(v) }))
      .sort(
        (a, b) =>
          a.tier - b.tier || // current level, then next level, then the rest
          b.topic - a.topic || // within a tier, favor the scholar's watched-topic affinity
          a.i - b.i, // stable tiebreak: preserve library order (newest-first)
      )
      .slice(0, 12)
      .map(x => x.v)
  }, [videos, scholarLevelId])

  const recentlyAdded = useMemo(() => {
    return [...videos]
      .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0))
      .slice(0, 12)
  }, [videos])

  const topicCounts = useMemo(() => {
    const counts = {}
    for (const topic of ALL_TOPICS) counts[topic] = 0
    for (const v of videos) {
      if (v.topic_primary && hasTopicKey(counts, v.topic_primary)) counts[v.topic_primary] += 1
      if (v.topic_secondary && hasTopicKey(counts, v.topic_secondary)) counts[v.topic_secondary] += 1
    }
    return counts
  }, [videos])

  function goToVideo(video) {
    navigate(`/watch?videoId=${video.id}`)
  }

  function goToTopic(topic) {
    navigate(`/watch?topic=${encodeURIComponent(topic)}`)
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div className="ngsi-home-hero-grid">
          <HeroBanner greeting={getTimeOfDayGreeting()} firstName={firstName} />
          <TodaysGoalCard
            hoursToday={hoursToday}
            dailyTargetHours={dailyTargetHours}
            loading={progressLoading}
          />
        </div>

        <VideoRow
          title="Recommended for You"
          videos={recommended}
          loading={videosLoading}
          emptyText="You're all caught up — check the library for more."
          onSelect={goToVideo}
        />

        <JourneyStats progress={progress} streak={streak} />

        <TopicExplorer topicCounts={topicCounts} onSelectTopic={goToTopic} />

        <VideoRow
          title="Recently Added"
          videos={recentlyAdded}
          loading={videosLoading}
          emptyText="No videos in the library yet."
          onSelect={goToVideo}
        />
      </div>
    </div>
  )
}

function hasTopicKey(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function HeroBanner({ greeting, firstName }) {
  return (
    <section style={styles.hero}>
      <p style={styles.heroEyebrow}>Welcome back!</p>
      <h1 style={styles.heroTitle}>
        {greeting}, {firstName}.
      </h1>
      <p style={styles.heroSubtitle}>Ready to continue your journey?</p>
    </section>
  )
}

function TodaysGoalCard({ hoursToday, dailyTargetHours, loading }) {
  const size = 116
  const stroke = 10
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  const pct = dailyTargetHours ? Math.min(hoursToday / dailyTargetHours, 1) : 0
  const done = dailyTargetHours != null && pct >= 1
  const todayMins = Math.round(hoursToday * 60)
  const targetMins = dailyTargetHours != null ? Math.round(dailyTargetHours * 60) : null

  return (
    <section style={styles.goalCard}>
      <p style={styles.goalCardLabel}>Today's Goal</p>
      {loading ? (
        <div style={{ ...styles.goalRingWrap, width: size, height: size }}>
          <div className="ngsi-skeleton" style={{ width: size, height: size, borderRadius: '50%' }} />
        </div>
      ) : targetMins == null ? (
        <p style={styles.goalPending}>Your goal clock hasn't started yet.</p>
      ) : (
        <>
          <div style={{ ...styles.goalRingWrap, width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--ngsi-cream-dark)"
                strokeWidth={stroke}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={done ? 'var(--ngsi-status-saved)' : 'var(--ngsi-navy)'}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - pct)}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dashoffset 0.4s ease' }}
              />
            </svg>
            <div style={styles.goalRingCenter}>
              <span style={styles.goalRingValue}>
                {todayMins}/{targetMins}
              </span>
              <span style={styles.goalRingUnit}>min</span>
            </div>
          </div>
          {done && <p style={styles.goalDoneText}>Goal reached today!</p>}
        </>
      )}
    </section>
  )
}

function VideoRow({ title, videos, loading, emptyText, onSelect }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      {loading ? (
        <div className="ngsi-home-scroll-row">
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={styles.rowCard}>
              <div className="ngsi-skeleton" style={{ width: '100%', aspectRatio: '16 / 9' }} />
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <p style={styles.sectionEmpty}>{emptyText}</p>
      ) : (
        <div className="ngsi-home-scroll-row">
          {videos.map(v => (
            <div key={v.id} style={styles.rowCard}>
              <VideoCard video={v} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function JourneyStats({ progress, streak }) {
  const hoursThisMonth = progress?.hours_this_month ?? 0
  const videosWatched = progress?.videos_watched ?? 0
  const currentStreak = streak?.current_streak ?? 0
  const longestStreak = streak?.longest_streak ?? 0

  const stats = [
    { label: 'Hours This Month', value: hoursThisMonth.toFixed(1), suffix: 'h' },
    { label: 'Videos Watched', value: videosWatched, suffix: '' },
    { label: 'Current Streak', value: currentStreak, suffix: currentStreak === 1 ? ' day' : ' days' },
    { label: 'Longest Streak', value: longestStreak, suffix: longestStreak === 1 ? ' day' : ' days' },
  ]

  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>Continue Your Journey</h2>
      <div style={styles.statsGrid}>
        {stats.map(s => (
          <div key={s.label} style={styles.statCard}>
            <span style={styles.statValue}>
              {s.value}
              {s.suffix}
            </span>
            <span style={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function TopicExplorer({ topicCounts, onSelectTopic }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>Explore by Topic</h2>
      <div style={styles.topicGrid}>
        {TOPIC_CATEGORIES.flatMap(cat =>
          cat.topics.map(topic => (
            <button
              key={topic}
              onClick={() => onSelectTopic(topic)}
              style={{ ...styles.topicCard, borderTopColor: cat.color }}
            >
              <span style={styles.topicCardName}>{topic}</span>
              <span style={styles.topicCardCount}>
                {topicCounts[topic] ?? 0} video{topicCounts[topic] === 1 ? '' : 's'}
              </span>
            </button>
          )),
        )}
      </div>
    </section>
  )
}

const styles = {
  page: {
    minHeight: 'calc(100vh - 56px)',
    background: 'var(--ngsi-cream)',
  },
  container: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  },
  hero: {
    borderRadius: 16,
    padding: '28px 24px',
    background: 'linear-gradient(135deg, var(--ngsi-navy) 0%, var(--ngsi-navy-light) 65%, var(--ngsi-navy-deep) 100%)',
    color: 'var(--ngsi-cream)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 6,
    boxShadow: '0 4px 18px rgba(0,0,0,0.18)',
  },
  heroEyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--ngsi-gold)',
  },
  heroTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--ngsi-cream)',
  },
  heroSubtitle: {
    margin: 0,
    fontSize: 14,
    color: 'var(--ngsi-cream)',
    opacity: 0.85,
  },
  goalCard: {
    borderRadius: 16,
    padding: '20px 24px',
    background: 'var(--ngsi-surface)',
    border: '1px solid var(--ngsi-cream-dark)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  goalCardLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--ngsi-text-muted)',
    alignSelf: 'flex-start',
  },
  goalPending: {
    margin: 0,
    fontSize: 13,
    color: 'var(--ngsi-text-muted)',
    textAlign: 'center',
  },
  goalRingWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalRingCenter: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalRingValue: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
    fontFamily: 'Georgia, serif',
  },
  goalRingUnit: {
    fontSize: 10,
    color: 'var(--ngsi-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  goalDoneText: {
    margin: 0,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ngsi-status-saved)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
  },
  sectionEmpty: {
    margin: 0,
    fontSize: 13,
    color: 'var(--ngsi-text-muted)',
  },
  rowCard: {
    flex: '0 0 220px',
    width: 220,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
  },
  statCard: {
    borderRadius: 12,
    padding: '16px 14px',
    background: 'var(--ngsi-surface)',
    border: '1px solid var(--ngsi-cream-dark)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
    fontFamily: 'Georgia, serif',
  },
  statLabel: {
    fontSize: 12,
    color: 'var(--ngsi-text-muted)',
    fontWeight: 500,
  },
  topicGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
  },
  topicCard: {
    borderRadius: 10,
    padding: '14px 14px',
    background: 'var(--ngsi-surface)',
    border: '1px solid var(--ngsi-cream-dark)',
    borderTop: '3px solid transparent',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'flex-start',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  topicCardName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ngsi-navy)',
  },
  topicCardCount: {
    fontSize: 12,
    color: 'var(--ngsi-text-muted)',
  },
}
