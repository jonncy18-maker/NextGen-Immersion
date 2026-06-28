import { useEffect, useRef } from 'react'

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

export default function VideoPlayer({ youtubeId, onStateChange, onReady }) {
  const divRef = useRef(null)
  const playerRef = useRef(null)
  // Always call the latest prop versions without recreating the YT.Player
  const onStateChangeRef = useRef(onStateChange)
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    onStateChangeRef.current = onStateChange
  }, [onStateChange])
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    if (!youtubeId) return
    let cancelled = false

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
            if (!cancelled) onReadyRef.current?.(e.target)
          },
          onStateChange: e => {
            if (!cancelled) onStateChangeRef.current?.(e.data)
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

  return (
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
  )
}
