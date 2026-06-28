import { getTopicColor } from '../../utils/topics.js'

const LEVEL_LABELS = {
  super_beginner: 'Super Beginner',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

export default function VideoCard({ video, onSelect, active }) {
  const topics = [video.topic_primary, video.topic_secondary].filter(Boolean)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(video)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(video)
        }
      }}
      style={{
        ...styles.card,
        ...(active ? styles.cardActive : {}),
      }}
    >
      <div style={styles.thumbWrap}>
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt="" style={styles.thumb} />
        ) : (
          <div style={styles.thumbFallback} />
        )}
        {video.watched && <span style={styles.watchedBadge}>✓ Watched</span>}
      </div>

      <div style={styles.body}>
        <p style={styles.title}>{video.title}</p>
        {video.channel_name && <p style={styles.channel}>{video.channel_name}</p>}

        <div style={styles.metaRow}>
          <span style={styles.levelBadge}>
            {LEVEL_LABELS[video.level] ?? video.level}
          </span>
          {topics.map(t => (
            <span
              key={t}
              style={{ ...styles.topicChip, background: getTopicColor(t) }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    border: '1px solid var(--ngsi-cream-dark)',
    borderRadius: 10,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
  },
  cardActive: {
    border: '2px solid var(--ngsi-gold)',
    boxShadow: '0 0 0 2px rgba(201, 168, 76, 0.25)',
  },
  thumbWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 9',
    background: 'var(--ngsi-cream-dark)',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  thumbFallback: {
    width: '100%',
    height: '100%',
    background: 'var(--ngsi-cream-dark)',
  },
  watchedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'var(--ngsi-cat-life)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 7px',
    borderRadius: 6,
  },
  body: {
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  title: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ngsi-navy)',
    lineHeight: 1.3,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  channel: {
    margin: 0,
    fontSize: 12,
    color: '#8a8f99',
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
    marginTop: 2,
  },
  levelBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ngsi-navy)',
    background: 'var(--ngsi-cream)',
    border: '1px solid var(--ngsi-cream-dark)',
    padding: '2px 7px',
    borderRadius: 999,
  },
  topicChip: {
    fontSize: 11,
    fontWeight: 600,
    color: '#fff',
    padding: '2px 8px',
    borderRadius: 999,
  },
}
