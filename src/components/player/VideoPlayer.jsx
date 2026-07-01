import { useEffect, useRef, useState } from 'react'

function formatTimestamp(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Load the YouTube IFrame API once globally; subsequent mounts reuse window.YT
let scriptInjected = false
const pendingCallbacks = []

function onApiReady(cb) {
  if (window.YT && window.YT.Player) {
    cb()
    return
  }
  pendingCallbacks.push(cb)
  if (!scriptInjected) {
    scriptInjected = true
    window.onYouTubeIframeAPIReady = () => {
      pendingCallbacks.splice(0).forEach(fn => fn())
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  }
}

// resumeAt: seconds to seek to on load ("pick up where you left off"). Only
// shown/applied above a small threshold — a few seconds in isn't worth a toast.
const RESUME_THRESHOLD_SECONDS = 5

export default function VideoPlayer({ youtubeId, onStateChange, onReady, resumeAt }) {
  const divRef = useRef(null)
  const playerRef = useRef(null)
  // Always call the latest prop versions without recreating the YT.Player
  const onStateChangeRef = useRef(onStateChange)
  const onReadyRef = useRef(onReady)
  const resumeAtRef = useRef(resumeAt)
  const [resumeToastAt, setResumeToastAt] = useState(null)
  useEffect(() => {
    onStateChangeRef.current = onStateChange
  }, [onStateChange])
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])
  useEffect(() => {
    resumeAtRef.current = resumeAt
  }, [resumeAt])

  useEffect(() => {
    if (!youtubeId) return
    let cancelled = false
    setResumeToastAt(null)

    onApiReady(() => {
      if (cancelled || !divRef.current) return

      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }

      playerRef.current = new window.YT.Player(divRef.current, {
        videoId: youtubeId,
        playerVars: { autoplay: 0, rel: 0, modestbranding: 1 },
        events: {
          onReady: e => {
            if (cancelled) return
            const seekTo = resumeAtRef.current
            if (seekTo > RESUME_THRESHOLD_SECONDS) {
              e.target.seekTo(seekTo, true)
              setResumeToastAt(seekTo)
            }
            onReadyRef.current?.(e.target)
          },
          onStateChange: e => {
            if (!cancelled) onStateChangeRef.current?.(e.data, e.target)
          },
        },
      })
    })

    return () => {
      cancelled = true
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [youtubeId])

  function startFromBeginning() {
    playerRef.current?.seekTo(0, true)
    setResumeToastAt(null)
  }

  return (
    <div>
      <div
        style={{
          position: 'relative',
          paddingBottom: '56.25%',
          height: 0,
          background: '#000',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          ref={divRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      </div>

      {resumeToastAt != null && (
        <div style={toastStyles.wrap}>
          <span style={toastStyles.text}>
            Resuming from {formatTimestamp(resumeToastAt)} →
          </span>
          <button type="button" style={toastStyles.link} onClick={startFromBeginning}>
            Start from beginning
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            style={toastStyles.dismiss}
            onClick={() => setResumeToastAt(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

const toastStyles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    padding: '6px 10px',
    background: 'var(--ngsi-cream-dark)',
    borderRadius: 7,
    fontSize: 12,
  },
  text: {
    color: 'var(--ngsi-navy)',
    fontWeight: 500,
    flex: 1,
  },
  link: {
    background: 'none',
    border: 'none',
    padding: 0,
    color: 'var(--ngsi-navy)',
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'underline',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dismiss: {
    background: 'none',
    border: 'none',
    padding: 0,
    color: '#8a8f99',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}
