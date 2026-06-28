function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export default function WatchTimer({ secondsWatched, isPlaying }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'Georgia, serif',
      fontSize: 14,
      color: 'var(--ngsi-navy)',
      opacity: 0.8,
    }}>
      <span className="ngsi-numeric">{formatTime(secondsWatched)}</span>
      {isPlaying && (
        <span style={{ color: 'var(--ngsi-gold)', fontSize: 10 }}>●</span>
      )}
    </div>
  )
}
