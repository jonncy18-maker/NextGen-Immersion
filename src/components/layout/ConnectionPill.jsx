import { useConnection } from '../../hooks/useConnection.js'

// Small status pill in the navbar: a colored dot + label reflecting whether
// watch time is making it to Neon. Green = saved, amber = buffering (with the
// pending count), red = offline.
const STATUS = {
  saved: { label: 'Saved', color: 'var(--ngsi-status-saved)' },
  buffering: { label: 'Buffering', color: 'var(--ngsi-status-buffering)' },
  offline: { label: 'Offline', color: 'var(--ngsi-status-offline)' },
}

export default function ConnectionPill() {
  const { status, pending } = useConnection()
  const { label, color } = STATUS[status]
  const text =
    status === 'buffering' && pending > 0 ? `${label} (${pending})` : label

  return (
    <span
      role="status"
      aria-live="polite"
      title={
        status === 'offline'
          ? 'No connection — your watch time is saved on this device and will sync when you reconnect.'
          : status === 'buffering'
            ? `${pending} watch ${pending === 1 ? 'segment' : 'segments'} waiting to sync.`
            : 'All watch time is saved.'
      }
      style={{ ...styles.pill, color }}
    >
      <span
        aria-hidden="true"
        style={{ ...styles.dot, backgroundColor: color }}
      />
      {text}
    </span>
  )
}

const styles = {
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    border: '1px solid currentColor',
    borderRadius: 999,
    padding: '3px 10px',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
}
