import { useEffect, useRef } from 'react'

// Module-level singletons so the YT API script loads exactly once
let ytScriptLoaded = false
let ytReady = false
const ytReadyCallbacks = []

function ensureYTApiLoaded() {
  if (ytScriptLoaded) return
  ytScriptLoaded = true

  const prev = window.onYouTubeIframeAPIReady
  window.onYouTubeIframeAPIReady = () => {
    ytReady = true
    if (prev) prev()
    ytReadyCallbacks.splice(0).forEach((fn) => fn())
  }

  const script = document.createElement('script')
  script.src = 'https://www.youtube.com/iframe_api'
  document.head.appendChild(script)
}

function whenYTReady(fn) {
  if (ytReady) fn()
  else ytReadyCallbacks.push(fn)
}

export default function VideoPlayer({ youtubeId, onStateChange }) {
  const mountRef = useRef(null)
  const playerRef = useRef(null)
  // Stable ref so player event handler always calls the latest callback
  const onStateChangeRef = useRef(onStateChange)
  useEffect(() => { onStateChangeRef.current = onStateChange }, [onStateChange])

  useEffect(() => {
    if (!youtubeId) return
    ensureYTApiLoaded()
    let cancelled = false

    whenYTReady(() => {
      if (cancelled || !mountRef.current) return
      playerRef.current = new window.YT.Player(mountRef.current, {
        videoId: youtubeId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e) => onStateChangeRef.current?.(e),
        },
      })
    })

    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [youtubeId])

  return (
    <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 4, overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
