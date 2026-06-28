import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuthToken } from '../lib/authToken.js'
import FilterBar from '../components/video/FilterBar.jsx'
import VideoGrid from '../components/video/VideoGrid.jsx'
import { LEVELS } from '../utils/levels.js'

async function fetchVideos() {
  const token = await getAuthToken()
  const res = await fetch('/api/videos', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to load videos')
  const data = await res.json()
  return data.videos
}

const LEVEL_ORDER = LEVELS.reduce((acc, l, i) => {
  acc[l.id] = i
  return acc
}, {})

export default function Browse() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    topics: [],
    level: null,
    watchedFilter: 'all',
  })

  const navigate = useNavigate()

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

  useEffect(() => {
    fetchVideos()
      .then(vs => setVideos(vs))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const visibleVideos = useMemo(() => {
    const list = videos.filter(v => {
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

    return list
      .map((v, i) => ({ v, i }))
      .sort((a, b) => {
        const lr = (LEVEL_ORDER[a.v.level] ?? 99) - (LEVEL_ORDER[b.v.level] ?? 99)
        return lr || a.i - b.i
      })
      .map(x => x.v)
  }, [videos, filters])

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Library</h1>

        {loading && <p style={styles.hint}>Loading…</p>}
        {error && <p style={styles.hint}>{error}</p>}

        {!loading && !error && (
          <>
            <FilterBar filters={filters} onChange={setFilters} />
            <VideoGrid
              videos={visibleVideos}
              onSelect={() => navigate('/watch')}
              onMark={handleMark}
            />
          </>
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
  title: {
    margin: '0 0 16px',
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
  },
  hint: {
    fontSize: 14,
    color: '#8a8f99',
  },
}
