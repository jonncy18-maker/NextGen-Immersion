import { useState, useEffect, useMemo, useCallback } from 'react'
import { getAuthToken } from '../lib/authToken.js'
import VideoPlayer from '../components/player/VideoPlayer.jsx'
import WatchTimer from '../components/player/WatchTimer.jsx'
import IosPlaybackNotice from '../components/player/IosPlaybackNotice.jsx'
import FilterDropdowns from '../components/video/FilterDropdowns.jsx'
import VideoGrid from '../components/video/VideoGrid.jsx'
import VideoGridSkeleton from '../components/video/VideoGridSkeleton.jsx'
import EmptyState from '../components/video/EmptyState.jsx'
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
    topic: null,
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
      if (filters.topic) {
        if (v.topic_primary !== filters.topic && v.topic_secondary !== filters.topic) return false
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

  useEffect(() => {
    if (!selected && visibleVideos.length > 0) {
      setSelected(visibleVideos[0])
    }
  }, [selected, visibleVideos])

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

  const { onPlayerStateChange, secondsThisSession, flushStatus } = useWatchSession(
    selected?.id ?? null,
    selected?.duration_seconds ?? 0,
    handleComplete,
  )

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

      <div style={styles.container}>
        {selected && (
          <div style={styles.playerArea}>
            <IosPlaybackNotice />
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

        <div style={styles.library}>
          {error ? (
            <p style={styles.hint}>{error}</p>
          ) : loading ? (
            <VideoGridSkeleton />
          ) : videos.length === 0 ? (
            <EmptyState
              title="No videos yet"
              message="The library is being set up — your coordinator is adding videos. Check back soon."
            />
          ) : (
            <VideoGrid
              videos={visibleVideos}
              onSelect={setSelected}
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
  library: {
    marginTop: 8,
  },
}
