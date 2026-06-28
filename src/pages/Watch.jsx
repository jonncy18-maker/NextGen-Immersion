import { useSearchParams } from 'react-router-dom'
import VideoPlayer from '../components/player/VideoPlayer.jsx'
import WatchTimer from '../components/player/WatchTimer.jsx'
import { useWatchSession } from '../hooks/useWatchSession.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Watch() {
  const [searchParams] = useSearchParams()
  const videoId = searchParams.get('v') || ''
  const duration = Number(searchParams.get('d') || 0)

  const { token } = useAuth()
  const { secondsWatched, isPlaying, onPlayerStateChange } = useWatchSession({
    videoId,
    duration,
    token,
  })

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 12px' }}>
      {videoId ? (
        <>
          <VideoPlayer youtubeId={videoId} onStateChange={onPlayerStateChange} />
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <WatchTimer secondsWatched={secondsWatched} isPlaying={isPlaying} />
          </div>
        </>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 220,
          color: 'var(--ngsi-navy)',
          opacity: 0.5,
          fontFamily: 'Georgia, serif',
          fontSize: 16,
        }}>
          No video selected.
        </div>
      )}
    </div>
  )
}
