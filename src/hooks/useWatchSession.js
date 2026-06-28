import { useRef, useState, useCallback, useEffect } from 'react'
import { getAuthToken } from '../lib/authToken.js'
import { bufferFlush, getBuffered, removeBuffered } from '../utils/offlineBuffer.js'

// useWatchSession manages the full play/pause/end/close state machine.
// videoId: DB UUID (videos.id) — required for flushing
// durationSeconds: video length — used to determine ≥95% completion
// onComplete: optional callback(videoId) fired when a single session reaches
//   ≥95% (the completion semantic) so the UI can update watched state live.
export function useWatchSession(videoId, durationSeconds, onComplete) {
  const tokenRef = useRef(null)
  const intervalRef = useRef(null)
  const sessionRef = useRef(null)

  // Held in a ref so the latest callback is used without re-creating handlers
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const [secondsThisSession, setSecondsThisSession] = useState(0)
  const [flushStatus, setFlushStatus] = useState('idle') // idle | flushing | saved | buffered

  // Keep a fresh JWT cached so the beforeunload handler can use it synchronously.
  // Neon Auth JWTs expire in ~15 min; refreshing every 5 min keeps the cached
  // token valid between refreshes.
  useEffect(() => {
    async function refresh() {
      tokenRef.current = await getAuthToken()
    }
    refresh()
    const id = setInterval(refresh, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Reset session when the video changes; flush any in-progress segment first
  useEffect(() => {
    const prevVideoId = videoId // captured for cleanup closure

    if (!videoId) return

    stopTimer()
    sessionRef.current = {
      clientFlushId: crypto.randomUUID(),
      startedAt: null,
      secondsWatched: 0,
    }
    setSecondsThisSession(0)
    setFlushStatus('idle')

    return () => {
      // SPA navigation or video switch — flush the segment that was in progress.
      // prevVideoId is the video that WAS playing; sessionRef still holds its data
      // at cleanup time (before the new effect body resets it).
      stopTimer()
      const session = sessionRef.current
      if (session && prevVideoId && session.secondsWatched >= 10) {
        const payload = {
          videoId: prevVideoId,
          clientFlushId: session.clientFlushId,
          secondsWatched: session.secondsWatched,
          completed: false,
          startedAt: session.startedAt,
          endedAt: new Date().toISOString(),
          language: 'english',
        }
        bufferFlush(payload) // Synchronous — survives even if fetch is cancelled
        const token = tokenRef.current
        if (token) {
          fetch('/api/flush-session', {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          })
            .then(r => { if (r.ok) removeBuffered(payload.clientFlushId) })
            .catch(() => {})
        }
      }
    }
  }, [videoId])

  // Drain offline buffer on mount + reconnect
  const drainBuffer = useCallback(async () => {
    const items = getBuffered()
    if (!items.length) return
    const token = tokenRef.current
    if (!token) return
    for (const item of items) {
      try {
        const res = await fetch('/api/flush-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(item),
        })
        if (res.ok) removeBuffered(item.clientFlushId)
      } catch {
        break // Still offline — stop trying
      }
    }
  }, [])

  useEffect(() => {
    drainBuffer()
    window.addEventListener('online', drainBuffer)
    return () => window.removeEventListener('online', drainBuffer)
  }, [drainBuffer])

  function stopTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const flush = useCallback(
    async (isCompleted = false) => {
      const session = sessionRef.current
      if (!session || !videoId || session.secondsWatched < 10) return

      const payload = {
        videoId,
        clientFlushId: session.clientFlushId,
        secondsWatched: session.secondsWatched,
        completed: isCompleted,
        startedAt: session.startedAt,
        endedAt: new Date().toISOString(),
        language: 'english',
      }

      bufferFlush(payload) // Persist to localStorage immediately before network call
      setFlushStatus('flushing')

      try {
        const token = tokenRef.current
        if (!token) throw new Error('no token')
        const res = await fetch('/api/flush-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          removeBuffered(payload.clientFlushId)
          setFlushStatus('saved')
        } else {
          setFlushStatus('buffered')
        }
      } catch {
        setFlushStatus('buffered')
      }
    },
    [videoId],
  )

  // beforeunload: buffer first (synchronous), then keepalive fetch (survives tab close)
  useEffect(() => {
    function handleBeforeUnload() {
      const session = sessionRef.current
      if (!session || !videoId || session.secondsWatched < 10) return
      stopTimer()

      const payload = {
        videoId,
        clientFlushId: session.clientFlushId,
        secondsWatched: session.secondsWatched,
        completed: false,
        startedAt: session.startedAt,
        endedAt: new Date().toISOString(),
        language: 'english',
      }

      bufferFlush(payload) // Always write to localStorage first — survives even if fetch fails

      const token = tokenRef.current
      if (token) {
        fetch('/api/flush-session', {
          method: 'POST',
          keepalive: true, // survives page unload; supports headers unlike sendBeacon
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
          .then(r => {
            if (r.ok) removeBuffered(payload.clientFlushId)
          })
          .catch(() => {})
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [videoId])

  const onPlayerStateChange = useCallback(
    state => {
      // YT.PlayerState: ENDED=0, PLAYING=1, PAUSED=2, BUFFERING=3
      if (state === 1) {
        // PLAYING — start the interval for this segment
        if (!sessionRef.current.startedAt) {
          sessionRef.current.startedAt = new Date().toISOString()
        }
        if (!intervalRef.current) {
          intervalRef.current = setInterval(() => {
            sessionRef.current.secondsWatched += 1
            setSecondsThisSession(s => s + 1)
          }, 1000)
        }
      } else if (state === 3) {
        // BUFFERING — stop timer only; same segment resumes when PLAYING fires again
        stopTimer()
      } else {
        stopTimer()

        if (state === 0) {
          // ENDED — check ≥95% completion against this segment, flush, reset display
          const s = sessionRef.current
          const isCompleted =
            durationSeconds > 0 && s.secondsWatched / durationSeconds >= 0.95
          flush(isCompleted)
          if (isCompleted) onCompleteRef.current?.(videoId)
          sessionRef.current = {
            clientFlushId: crypto.randomUUID(),
            startedAt: null,
            secondsWatched: 0,
          }
          setSecondsThisSession(0)
          setFlushStatus('idle')
        } else if (state === 2) {
          // PAUSED — flush this segment, then start a fresh segment for the next play.
          // Each segment gets its own clientFlushId so ON CONFLICT DO NOTHING is truly
          // idempotent (dedupes retries) rather than silently dropping resumed-play seconds.
          flush(false)
          sessionRef.current = {
            clientFlushId: crypto.randomUUID(),
            startedAt: null,
            secondsWatched: 0,
          }
          // Keep setSecondsThisSession running (display shows cumulative this visit)
        }
      }
    },
    [flush, durationSeconds, videoId],
  )

  return { onPlayerStateChange, secondsThisSession, flushStatus }
}
