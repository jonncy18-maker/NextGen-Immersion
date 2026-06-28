import { useState, useEffect, useRef, useCallback } from 'react'
import { addToBuffer, flushBuffer } from '../utils/offlineBuffer.js'

export function useWatchSession({ videoId, duration = 0, token }) {
  const [secondsWatched, setSecondsWatched] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const intervalRef = useRef(null)
  const secondsRef = useRef(0)
  const startedAtRef = useRef(null)
  const clientFlushIdRef = useRef(null)

  // Keep mutable refs in sync so stale-closure callbacks always see current values
  const videoIdRef = useRef(videoId)
  const durationRef = useRef(duration)
  const tokenRef = useRef(token)
  useEffect(() => { videoIdRef.current = videoId }, [videoId])
  useEffect(() => { durationRef.current = duration }, [duration])
  useEffect(() => { tokenRef.current = token }, [token])

  // Reset session state when the video changes
  useEffect(() => {
    stopTimer()
    secondsRef.current = 0
    setSecondsWatched(0)
    setIsPlaying(false)
    clientFlushIdRef.current = null
    startedAtRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  function startTimer() {
    if (intervalRef.current) return
    if (!startedAtRef.current) startedAtRef.current = new Date().toISOString()
    if (!clientFlushIdRef.current) clientFlushIdRef.current = crypto.randomUUID()
    intervalRef.current = setInterval(() => {
      secondsRef.current += 1
      setSecondsWatched(secondsRef.current)
    }, 1000)
  }

  function stopTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const flush = useCallback(async (useBeacon = false) => {
    if (!clientFlushIdRef.current || secondsRef.current < 1) return
    if (!videoIdRef.current) return

    const payload = {
      videoId: videoIdRef.current,
      clientFlushId: clientFlushIdRef.current,
      secondsWatched: secondsRef.current,
      completed: durationRef.current > 0 && secondsRef.current >= durationRef.current * 0.95,
      startedAt: startedAtRef.current,
      endedAt: new Date().toISOString(),
      language: 'english',
    }

    if (useBeacon) {
      // sendBeacon cannot set Authorization headers — include token in body as fallback
      const ok = navigator.sendBeacon(
        '/api/flush-session',
        JSON.stringify({ ...payload, _token: tokenRef.current }),
      )
      if (!ok) addToBuffer(payload)
      return
    }

    if (!navigator.onLine) {
      addToBuffer(payload)
      return
    }

    try {
      const res = await fetch('/api/flush-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) addToBuffer(payload)
    } catch {
      addToBuffer(payload)
    }
  }, [])

  // YouTube IFrame API state change handler
  // State values: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
  const onPlayerStateChange = useCallback((event) => {
    const state = event.data
    if (state === 1) {
      setIsPlaying(true)
      startTimer()
    } else {
      setIsPlaying(false)
      stopTimer()
      if (state === 0 || state === 2) {
        flush()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush])

  // sendBeacon flush on tab/browser close
  useEffect(() => {
    function handleBeforeUnload() {
      stopTimer()
      flush(true)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [flush])

  // Flush offline buffer when connection restores
  useEffect(() => {
    function handleOnline() {
      if (tokenRef.current) flushBuffer(tokenRef.current)
    }
    window.addEventListener('online', handleOnline)
    // Also attempt flush on mount in case items were buffered in a previous session
    if (navigator.onLine && token) flushBuffer(token)
    return () => window.removeEventListener('online', handleOnline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Stop timer on unmount
  useEffect(() => () => stopTimer(), [])

  return { secondsWatched, isPlaying, onPlayerStateChange }
}
