import { useState } from 'react'

const DISMISS_KEY = 'ngsi_ios_notice_dismissed'

// iOS Safari often hands YouTube embeds off to the native YouTube app on play.
// That's fine — the timer keeps the in-progress segment buffered and resumes
// tracking on return — but it surprises scholars, so we explain it once.
function isIos() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isiPhone = /iPad|iPhone|iPod/.test(ua)
  // iPadOS 13+ reports a desktop Mac UA — distinguish it by touch support.
  const isiPadOS = ua.includes('Macintosh') && navigator.maxTouchPoints > 1
  return isiPhone || isiPadOS
}

export default function IosPlaybackNotice() {
  const [show, setShow] = useState(() => {
    if (!isIos()) return false
    try {
      return localStorage.getItem(DISMISS_KEY) !== '1'
    } catch {
      return true
    }
  })

  if (!show) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // private mode / quota — just hide for this visit
    }
    setShow(false)
  }

  return (
    <div style={styles.note} role="note">
      <span style={styles.text}>
        On iPhone or iPad, tapping play may open the YouTube app. Your watch time
        still counts — just come back here when you&apos;re done.
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss notice"
        style={styles.dismiss}
      >
        ×
      </button>
    </div>
  )
}

const styles = {
  note: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    background: 'var(--ngsi-cream-dark)',
    border: '1px solid #ddd3bf',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 12,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 1.45,
    color: 'var(--ngsi-navy)',
  },
  dismiss: {
    background: 'none',
    border: 'none',
    color: 'var(--ngsi-navy)',
    fontSize: 20,
    lineHeight: 1,
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  },
}
