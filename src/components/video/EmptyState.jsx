// Generic empty-state block for when there is genuinely nothing to show (e.g. the
// whole library is empty), as opposed to filters excluding everything (which
// VideoGrid handles with its own inline message).
export default function EmptyState({ icon = '📺', title, message }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.icon} aria-hidden="true">
        {icon}
      </div>
      <p style={styles.title}>{title}</p>
      {message && <p style={styles.message}>{message}</p>}
    </div>
  )
}

const styles = {
  wrap: {
    textAlign: 'center',
    padding: '56px 24px',
    color: 'var(--ngsi-navy)',
  },
  icon: {
    fontSize: 40,
    lineHeight: 1,
    marginBottom: 12,
    opacity: 0.7,
  },
  title: {
    margin: '0 0 6px',
    fontSize: 17,
    fontWeight: 700,
  },
  message: {
    margin: '0 auto',
    maxWidth: 360,
    fontSize: 14,
    color: '#8a8f99',
    lineHeight: 1.5,
  },
}
