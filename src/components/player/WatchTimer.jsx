function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const STATUS = {
  idle: null,
  flushing: { label: 'Saving…', color: '#8a8f99' },
  saved: { label: 'Saved', color: '#1d9e75' },
  buffered: { label: 'Saved offline', color: '#c9a84c' },
}

export default function WatchTimer({ seconds, flushStatus }) {
  const status = STATUS[flushStatus]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 0',
      }}
    >
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'monospace',
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--ngsi-navy)',
          letterSpacing: 1,
        }}
      >
        {formatTime(seconds)}
      </span>
      {status && (
        <span
          style={{
            fontSize: 12,
            color: status.color,
            fontWeight: 500,
          }}
        >
          {status.label}
        </span>
      )}
    </div>
  )
}
