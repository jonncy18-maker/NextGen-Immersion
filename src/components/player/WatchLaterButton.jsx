// Rendered below the YouTube player, above WatchTimer. Toggles the current
// video in/out of the scholar's personal Watch Later queue.
export default function WatchLaterButton({ videoId, video, isAdded, onAdd, onRemove }) {
  const saved = isAdded(videoId)

  const handleClick = () => {
    if (saved) onRemove(videoId)
    else onAdd(video)
  }

  return (
    <button type="button" style={saved ? styles.saved : styles.base} onClick={handleClick}>
      {saved ? '✓ Saved' : '+ Watch Later'}
    </button>
  )
}

const styles = {
  base: {
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 600,
    border: '1.5px solid var(--ngsi-navy)',
    borderRadius: 7,
    background: 'transparent',
    color: 'var(--ngsi-navy)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  saved: {
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 600,
    border: '1.5px solid var(--ngsi-gold)',
    borderRadius: 7,
    background: 'var(--ngsi-gold)',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
}
