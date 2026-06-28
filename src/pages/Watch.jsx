import { useState, useEffect, useMemo, useCallback } from 'react'
import { getAuthToken } from '../lib/authToken.js'
import VideoPlayer from '../components/player/VideoPlayer.jsx'
import WatchTimer from '../components/player/WatchTimer.jsx'
import FilterBar from '../components/video/FilterBar.jsx'
import VideoGrid from '../components/video/VideoGrid.jsx'
import { useWatchSession } from '../hooks/useWatchSession.js'
import { useProgress } from '../hooks/useProgress.js'
import { getLevelForHours, getNextLevel } from '../utils/levels.js'

async function fetchVideos() {
  const token = await getAuthToken()
  const res = await fetch('/api/videos', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to load videos')
  const data = await res.json()
  return data.videos
}

export default function Watch() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [filters, setFilters] = useState({
    topics: [],
    level: null,
    watchedFilter: 'unwatched',
  })

  const { data: progress } = useProgress()
  const scholarLevelId = progress ? getLevelForHours(progress.current_hours).id : null
  const nextLevelId = scholarLevelId ? getNextLevel(scholarLevelId)?.id ?? null : null

  useEffect(() => {
    fetchVideos()
      .then(vs => setVideos(vs))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const visibleVideos = useMemo(() => {
    let list = videos.filter(v => {
      if (filters.topics.length > 0) {
        const inTopics =
          filters.topics.includes(v.topic_primary) ||
          filters.topics.includes(v.topic_secondary)
        if (!inTopics) return false
      }
      if (filters.level && v.level !== filters.level) return false
      if (filters.watchedFilter === 'unwatched' && v.watched) return false
      if (filters.watchedFilter === 'watched' && !v.watched) return false
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

  // Auto-select the first sorted video once videos (and progress) are ready.
  useEffect(() => {
    if (!selected && visibleVideos.length > 0) {
      setSelected(visibleVideos[0])
    }
  }, [selected, visibleVideos])

  // When a video completes (single session ≥95%), mark it watched in local
  // state so it moves into the Watched filter immediately — no page refresh.
  const handleComplete = useCallback(completedId => {
    setVideos(vs =>
      vs.map(v => (v.id === completedId ? { ...v, watched: true } : v)),
    )
  }, [])

  // Manual "Mark as watched / unwatched" — optimistic local update, then
  // persist via /api/mark-video. Revert on failure.
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

  const { onPlayerStateChange, secondsThisSession, flushStatus } = useWatchSession(
    selected?.id ?? null,
    selected?.duration_seconds ?? 0,
    handleComplete,
  )

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {loading && <p style={styles.hint}>Loading…</p>}
        {error && <p style={styles.hint}>{error}</p>}

        {selected && (
          <div style={styles.playerArea}>
            <VideoPlayer
              youtubeId={selected.youtube_id}
              onStateChange={onPlayerStateChange}
            />
            <div style={styles.meta}>
              <div>
                <p style={styles.videoTitleLarge}>{selected.title}</p>
                {selected.channel_name && (
                  <p style={styles.channelName}>{selected.channel_name}</p>
                )}
              </div>
              <WatchTimer seconds={secondsThisSession} flushStatus={flushStatus} />
            </div>
          </div>
        )}

        {!loading && !error && (
          <div style={styles.browse}>
            <h2 style={styles.browseHeading}>Browse the library</h2>
            <FilterBar filters={filters} onChange={setFilters} />
            <VideoGrid
              videos={visibleVideos}
              onSelect={setSelected}
              selectedId={selected?.id}
              onMark={handleMark}
            />
          </div>
        )}
      </div>
    </div>
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
  },
  hint: {
    fontSize: 14,
    color: '#8a8f99',
  },
  playerArea: {
    marginBottom: 24,
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
  browse: {
    marginTop: 8,
  },
  browseHeading: {
    margin: '0 0 12px',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
  },
}
