import { useState } from 'react'
import { getTopicColor } from '../../utils/topics.js'

const LEVEL_LABELS = {
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
  c1: 'C1',
  c2: 'C2',
}

export default function VideoCard({ video, onSelect, active, onMark, onRemove }) {
  const topics = [video.topic_primary, video.topic_secondary].filter(Boolean)
  const [menuOpen, setMenuOpen] = useState(false)
  const showMenu = Boolean(onMark || onRemove)

  const handleMark = (e, watched) => {
    e.stopPropagation()
    setMenuOpen(false)
    onMark(video, watched)
  }

  const handleRemove = e => {
    e.stopPropagation()
    setMenuOpen(false)
    onRemove(video)
  }

  // Netflix-style resume indicator — only meaningful while a video is partway
  // through and not yet completed (completed rows are deleted server-side).
  const resumeProgress =
    video.duration_seconds > 0 && video.resume_position_seconds > 0
      ? Math.min(video.resume_position_seconds / video.duration_seconds, 0.98)
      : 0

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

        {showMenu && (
          <>
            <button
              type="button"
              aria-label="Video options"
              onClick={e => {
                e.stopPropagation()
                setMenuOpen(o => !o)
              }}
              style={styles.menuButton}
            >
              ⋯
            </button>
            {menuOpen && (
              <>
                <div
                  onClick={e => {
                    e.stopPropagation()
                    setMenuOpen(false)
                  }}
                  style={styles.backdrop}
                />
                <div style={styles.menu}>
                  {onMark && (
                    <>
                      <div
                        role="button"
                        onClick={e => handleMark(e, true)}
                        style={styles.menuItem}
                      >
                        Mark as watched
                      </div>
                      <div
                        role="button"
                        onClick={e => handleMark(e, false)}
                        style={styles.menuItem}
                      >
                        Mark as unwatched
                      </div>
                    </>
                  )}
                  {onRemove && (
                    <div role="button" onClick={handleRemove} style={styles.menuItem}>
                      Remove from Watch Later
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {resumeProgress > 0.02 && (
          <div style={styles.resumeTrack}>
            <div style={{ ...styles.resumeFill, width: `${resumeProgress * 100}%` }} />
          </div>
        )}
      </div>

      <div style={styles.body}>
        <p style={styles.title}>{video.title}</p>
        {video.channel_name && <p style={styles.channel}>{video.channel_name}</p>}

        <div style={styles.metaRow}>
          <span style={styles.levelBadge}>
            {LEVEL_LABELS[video.level] ?? video.level}
          </span>
          {video.oet_relevance >= 4 && (
            <span style={styles.oetBadge}>OET</span>
          )}
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
  menuButton: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 26,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(22, 32, 64, 0.75)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: 1,
    padding: 0,
    zIndex: 3,
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'transparent',
    zIndex: 4,
  },
  menu: {
    position: 'absolute',
    top: 36,
    left: 6,
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
    border: '1px solid var(--ngsi-cream-dark)',
    overflow: 'hidden',
    zIndex: 5,
    minWidth: 150,
  },
  menuItem: {
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ngsi-navy)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
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
  oetBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    background: '#378ADD',
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
  resumeTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    background: 'rgba(0,0,0,0.35)',
  },
  resumeFill: {
    height: '100%',
    background: 'var(--ngsi-gold)',
  },
}
