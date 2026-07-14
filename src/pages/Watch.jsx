import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAuthToken } from '../lib/authToken.js'
import VideoPlayer from '../components/player/VideoPlayer.jsx'
import WatchTimer from '../components/player/WatchTimer.jsx'
import WatchLaterButton from '../components/player/WatchLaterButton.jsx'
import IosPlaybackNotice from '../components/player/IosPlaybackNotice.jsx'
import FilterDropdowns from '../components/video/FilterDropdowns.jsx'
import VideoGrid from '../components/video/VideoGrid.jsx'
import VideoGridSkeleton from '../components/video/VideoGridSkeleton.jsx'
import EmptyState from '../components/video/EmptyState.jsx'
import { useWatchSession } from '../hooks/useWatchSession.js'
import { useProgress } from '../hooks/useProgress.js'
import { useWatchLater } from '../hooks/useWatchLater.js'
import { useVideoLibrary } from '../hooks/useVideoLibrary.js'
import { useDailyGoal } from '../hooks/useDailyGoal.js'
import { getLevelForHours, getNextLevel } from '../utils/levels.js'
import ComprehensionPrompt from '../components/player/ComprehensionPrompt.jsx'
import NextVideoSuggestions from '../components/player/NextVideoSuggestions.jsx'

export default function Watch() {
  const { videos, setVideos, loading, error } = useVideoLibrary()
  const [selected, setSelected] = useState(null)
  const playerRef = useRef(null)
  const [filters, setFilters] = useState({
    topic: [],
    level: [],
    watchedFilter: 'unwatched',
    search: '',
    topicSearch: '',
    duration: 'any',
    oetOnly: false,
  })
  const levelInitialized = useRef(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkHandled = useRef(false)
  const topicDeepLinkHandled = useRef(false)

  const { data: progress, loading: progressLoading } = useProgress()
  const { isAdded, add: addToWatchLater, remove: removeFromWatchLater } = useWatchLater()
  const { hoursToday, dailyTargetHours } = useDailyGoal(progress)
  const rawLevelId = progress ? getLevelForHours(progress.current_hours).id : null
  const scholarLevelId = rawLevelId
  const nextLevelId = scholarLevelId ? getNextLevel(scholarLevelId)?.id ?? null : null

  // Default level filter to scholar's current level on first load
  useEffect(() => {
    if (scholarLevelId && !levelInitialized.current) {
      levelInitialized.current = true
      setFilters(f => ({ ...f, level: scholarLevelId ? [scholarLevelId] : [] }))
    }
  }, [scholarLevelId])

  // Deep link from Home ("#/watch?topic=...") — pre-select a topic filter
  // once, then strip the param from the URL (mirrors the videoId deep link
  // below).
  useEffect(() => {
    if (topicDeepLinkHandled.current) return
    const qTopic = searchParams.get('topic')
    if (!qTopic) return
    topicDeepLinkHandled.current = true
    setFilters(f => ({ ...f, topic: [qTopic] }))
    const next = new URLSearchParams(searchParams)
    next.delete('topic')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const visibleVideos = useMemo(() => {
    const searchLower = filters.search.toLowerCase()
    const topicSearchLower = filters.topicSearch.toLowerCase()

    let list = videos.filter(v => {
      if (searchLower) {
        const inTitle = v.title.toLowerCase().includes(searchLower)
        const inChannel = (v.channel_name || '').toLowerCase().includes(searchLower)
        if (!inTitle && !inChannel) return false
      }
      if (topicSearchLower) {
        const inPrimary = (v.topic_primary || '').toLowerCase().includes(topicSearchLower)
        const inSecondary = (v.topic_secondary || '').toLowerCase().includes(topicSearchLower)
        if (!inPrimary && !inSecondary) return false
      }
      if (filters.topic.length > 0) {
        if (!filters.topic.includes(v.topic_primary) && !filters.topic.includes(v.topic_secondary)) return false
      }
      if (filters.level.length > 0) {
        if (!filters.level.includes(v.level)) return false
      }
      if (filters.duration && filters.duration !== 'any') {
        const secs = v.duration_seconds || 0
        if (filters.duration === 'under5'  && secs >= 300)               return false
        if (filters.duration === '5to10'   && (secs < 300  || secs >= 600))  return false
        if (filters.duration === '10to15'  && (secs < 600  || secs >= 900))  return false
        if (filters.duration === '15to20'  && (secs < 900  || secs >= 1200)) return false
        if (filters.duration === '20to30'  && (secs < 1200 || secs >= 1800)) return false
        if (filters.duration === 'over30'  && secs < 1800)               return false
      }
      if (filters.watchedFilter === 'unwatched' && v.watched) return false
      if (filters.watchedFilter === 'watched' && !v.watched) return false
      if (filters.oetOnly && !(v.oet_relevance >= 4)) return false
      return true
    })

    if (scholarLevelId) {
      const rank = v => {
        if (v.level === scholarLevelId) return 0
        if (v.level === nextLevelId) return 1
        return 2
      }
      list = list
        .map((v, i) => ({ v, i }))
        .sort((a, b) => rank(a.v) - rank(b.v) || a.i - b.i)
        .map(x => x.v)
    }

    return list
  }, [videos, filters, scholarLevelId, nextLevelId])

  // Deep link from Library ("#/watch?videoId=...") — pre-select a specific
  // video once the library loads, overriding the default filtered selection.
  useEffect(() => {
    if (deepLinkHandled.current) return
    const qid = searchParams.get('videoId')
    if (!qid || videos.length === 0) return
    deepLinkHandled.current = true
    const found = videos.find(v => v.id === qid)
    if (found) setSelected(found)
    const next = new URLSearchParams(searchParams)
    next.delete('videoId')
    setSearchParams(next, { replace: true })
  }, [videos, searchParams, setSearchParams])

  // Wait for progress to resolve so the level filter (set above) is already
  // applied before we auto-pick — otherwise this can fire on an unfiltered
  // list and lock in a video from the wrong level before the filter lands.
  useEffect(() => {
    if (!selected && !progressLoading && visibleVideos.length > 0 && !searchParams.get('videoId')) {
      setSelected(visibleVideos[0])
    }
  }, [selected, progressLoading, visibleVideos, searchParams])

  const handleComplete = useCallback(completedId => {
    setVideos(vs =>
      vs.map(v => (v.id === completedId ? { ...v, watched: true } : v)),
    )
  }, [])

  const handleMark = useCallback(async (video, watched) => {
    const previous = video.watched
    setVideos(vs => vs.map(v => (v.id === video.id ? { ...v, watched } : v)))
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/mark-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ videoId: video.id, watched }),
      })
      if (!res.ok) throw new Error('Failed to mark video')
    } catch (e) {
      setVideos(vs =>
        vs.map(v => (v.id === video.id ? { ...v, watched: previous } : v)),
      )
    }
  }, [])

  const handleSelect = useCallback(video => {
    setSelected(video)
    playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const { onPlayerStateChange, secondsThisSession, flushStatus, videoEnded } = useWatchSession(
    selected?.id ?? null,
    selected?.duration_seconds ?? 0,
    handleComplete,
  )

  const [comprehensionRating, setComprehensionRating] = useState(null)
  const [showComprehension, setShowComprehension] = useState(false)

  // Show comprehension prompt when video ends
  useEffect(() => {
    if (videoEnded) {
      setShowComprehension(true)
      setComprehensionRating(null)
    }
  }, [videoEnded])

  // Reset comprehension UI when video selection changes
  useEffect(() => {
    setShowComprehension(false)
    setComprehensionRating(null)
  }, [selected?.id])

  return (
    <div style={styles.page}>
      {!loading && !error && videos.length > 0 && (
        <div style={styles.stickyFilterStrip}>
          <div style={styles.stickyFilterInner}>
            <FilterDropdowns
              filters={filters}
              onChange={setFilters}
              style={{ marginBottom: 0 }}
            />
          </div>
        </div>
      )}

      <div
        className={selected ? 'ngsi-watch-split' : undefined}
        style={styles.container}
      >
        {selected && (
          <div ref={playerRef} style={styles.playerArea}>
            <IosPlaybackNotice />
            <VideoPlayer
              youtubeId={selected.youtube_id}
              onStateChange={onPlayerStateChange}
              resumeAt={selected.resume_position_seconds}
            />
            <div style={styles.meta}>
              <div>
                <p style={styles.videoTitleLarge}>{selected.title}</p>
                {selected.channel_name && (
                  <p style={styles.channelName}>{selected.channel_name}</p>
                )}
              </div>
              <div style={styles.metaActions}>
                <WatchLaterButton
                  videoId={selected.id}
                  video={selected}
                  isAdded={isAdded}
                  onAdd={addToWatchLater}
                  onRemove={removeFromWatchLater}
                />
                <WatchTimer seconds={secondsThisSession} flushStatus={flushStatus} />
              </div>
            </div>

            {dailyTargetHours != null && (
              <DailyBar hoursToday={hoursToday} dailyTarget={dailyTargetHours} />
            )}

            {showComprehension && !comprehensionRating && (
              <ComprehensionPrompt
                videoId={selected.id}
                onRate={rating => {
                  setComprehensionRating(rating)
                  setShowComprehension(false)
                }}
                onDismiss={() => setShowComprehension(false)}
              />
            )}

            {comprehensionRating && (
              <NextVideoSuggestions
                videoId={selected.id}
                comprehensionRating={comprehensionRating}
                onSelect={video => {
                  setComprehensionRating(null)
                  handleSelect(video)
                }}
              />
            )}
          </div>
        )}

        <div style={selected ? { ...styles.library, ...styles.libraryColumn } : styles.library}>
          {error ? (
            <p style={styles.hint}>{error}</p>
          ) : loading ? (
            <VideoGridSkeleton />
          ) : videos.length === 0 ? (
            <EmptyState
              title="No videos yet"
              message="The library is being set up — your coordinator is adding videos. Check back soon."
            />
          ) : visibleVideos.length === 0 ? (
            <div style={styles.noResults}>
              <p style={styles.noResultsText}>No videos match your filters.</p>
              <button
                style={styles.clearFiltersBtn}
                onClick={() => setFilters({ topic: [], level: [], watchedFilter: 'all', search: '', topicSearch: '', duration: 'any', oetOnly: false })}
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <VideoGrid
              videos={visibleVideos}
              onSelect={handleSelect}
              selectedId={selected?.id}
              onMark={handleMark}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: 'calc(100vh - 56px)',
    background: 'var(--ngsi-cream)',
  },
  stickyFilterStrip: {
    position: 'sticky',
    top: 56,
    zIndex: 90,
    background: '#fff',
    borderBottom: '1px solid #e8e3da',
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
  },
  stickyFilterInner: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '10px 16px',
  },
  container: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: 16,
  },
  hint: {
    fontSize: 14,
    color: '#8a8f99',
  },
  playerArea: {
    marginBottom: 24,
    scrollMarginTop: 130, // navbar (56px) + sticky filter strip (~64px) + breathing room
    // Left column when the two-column split is active (≥1024px, via
    // .ngsi-watch-split). Ignored below 1024px where the parent is display:block.
    flex: '1 1 auto',
    minWidth: 0,
  },
  meta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 12,
    padding: '0 4px',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  videoTitleLarge: {
    margin: 0,
    fontSize: 17,
    fontWeight: 600,
    color: 'var(--ngsi-navy)',
  },
  channelName: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#8a8f99',
  },
  noResults: {
    textAlign: 'center',
    padding: '48px 24px',
  },
  noResultsText: {
    margin: '0 0 12px',
    fontSize: 15,
    color: '#5a6070',
  },
  clearFiltersBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--ngsi-navy)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'underline',
    fontFamily: 'inherit',
    padding: 0,
  },
  library: {
    marginTop: 8,
  },
  // Right column when a video is selected and the two-column split is active
  // (≥1024px, via .ngsi-watch-split). flex-basis fixes the list to ~380px so
  // VideoGrid's auto-fill columns collapse to a single vertical column of cards.
  // Below 1024px the parent is display:block, so these flex props are ignored
  // and the list renders full-width as the normal responsive grid.
  libraryColumn: {
    flex: '0 0 380px',
    minWidth: 0,
    marginTop: 0,
  },
}

function DailyBar({ hoursToday, dailyTarget }) {
  const pct = Math.min(hoursToday / dailyTarget, 1)
  const done = pct >= 1
  const todayMins = Math.round(hoursToday * 60)
  const targetMins = Math.round(dailyTarget * 60)

  return (
    <div style={barStyles.wrap}>
      <div style={barStyles.labelRow}>
        <span style={barStyles.label}>Today</span>
        <span style={{ ...barStyles.value, ...(done ? barStyles.valueDone : {}) }}>
          {todayMins} / {targetMins} min
        </span>
      </div>
      <div style={barStyles.track}>
        <div
          style={{
            ...barStyles.fill,
            width: `${pct * 100}%`,
            background: done ? '#1D9E75' : 'var(--ngsi-navy)',
          }}
        />
      </div>
    </div>
  )
}

const barStyles = {
  wrap: {
    marginTop: 10,
    padding: '0 4px',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  value: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ngsi-navy)',
  },
  valueDone: {
    color: '#1D9E75',
  },
  track: {
    height: 6,
    background: '#e8e3da',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 0.4s ease',
  },
}
