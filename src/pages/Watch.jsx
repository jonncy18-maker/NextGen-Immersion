import { useState, useEffect, useCallback } from 'react'
import { getAuthToken } from '../lib/authToken.js'
import VideoPlayer from '../components/player/VideoPlayer.jsx'
import WatchTimer from '../components/player/WatchTimer.jsx'
import { useWatchSession } from '../hooks/useWatchSession.js'

const LEVEL_LABELS = {
  super_beginner: 'Super Beginner',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

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

  useEffect(() => {
    fetchVideos()
      .then(vs => {
        setVideos(vs)
        if (vs.length) setSelected(vs[0])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const { onPlayerStateChange, secondsThisSession, flushStatus } = useWatchSession(
    selected?.id ?? null,
    selected?.duration_seconds ?? 0,
  )

  const handleSelect = useCallback(video => {
    setSelected(video)
  }, [])

  return (
    <div style={styles.page}>
      <div style={styles.layout}>
        {/* ── Video list sidebar ── */}
        <aside style={styles.sidebar}>
          <p style={styles.sidebarTitle}>Library</p>
          {loading && <p style={styles.hint}>Loading…</p>}
          {error && <p style={styles.hint}>{error}</p>}
          {!loading && !error && videos.length === 0 && (
            <p style={styles.hint}>No videos yet. Ask your coordinator to add some.</p>
          )}
          {videos.map(v => (
            <button
              key={v.id}
              onClick={() => handleSelect(v)}
              style={{
                ...styles.videoItem,
                ...(selected?.id === v.id ? styles.videoItemActive : {}),
              }}
            >
              {v.thumbnail_url && (
                <img src={v.thumbnail_url} alt="" style={styles.thumb} />
              )}
              <div style={styles.videoMeta}>
                <span style={styles.videoTitle}>{v.title}</span>
                <span style={styles.videoLevel}>{LEVEL_LABELS[v.level] ?? v.level}</span>
              </div>
            </button>
          ))}
        </aside>

        {/* ── Player area ── */}
        <main style={styles.main}>
          {selected ? (
            <>
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
            </>
          ) : (
            !loading && (
              <div style={styles.empty}>
                <p>Select a video to start watching.</p>
              </div>
            )
          )}
        </main>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: 'calc(100vh - 56px)',
    background: 'var(--ngsi-cream)',
  },
  layout: {
    display: 'flex',
    maxWidth: 1280,
    margin: '0 auto',
    padding: '16px',
    gap: 16,
    alignItems: 'flex-start',
  },
  sidebar: {
    width: 280,
    flexShrink: 0,
    background: '#fff',
    borderRadius: 8,
    padding: 12,
    border: '1px solid var(--ngsi-cream-dark)',
    maxHeight: 'calc(100vh - 100px)',
    overflowY: 'auto',
  },
  sidebarTitle: {
    margin: '0 0 10px',
    fontWeight: 700,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'var(--ngsi-navy)',
  },
  hint: {
    fontSize: 13,
    color: '#8a8f99',
    margin: 0,
  },
  videoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '8px 6px',
    marginBottom: 4,
    background: 'none',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left',
  },
  videoItemActive: {
    background: 'var(--ngsi-cream)',
  },
  thumb: {
    width: 72,
    height: 40,
    objectFit: 'cover',
    borderRadius: 4,
    flexShrink: 0,
  },
  videoMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  videoTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ngsi-navy)',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  videoLevel: {
    fontSize: 11,
    color: '#8a8f99',
  },
  main: {
    flex: 1,
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
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
    color: '#8a8f99',
    fontSize: 14,
  },
}
