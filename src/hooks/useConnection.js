import { useState, useEffect, useCallback } from 'react'
import {
  getBufferedCount,
  drainBuffer,
  BUFFER_CHANGE_EVENT,
} from '../utils/offlineBuffer.js'

// useConnection tracks live network state + how many watch segments are still
// waiting to be written to Neon, and drives the app's flush-on-reconnect.
//
// status:
//   'offline'   — navigator reports no connection (red)
//   'buffering' — online but segments are still queued in localStorage (amber)
//   'saved'     — online and nothing pending (green)
export function useConnection() {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [pending, setPending] = useState(0)

  const refreshCount = useCallback(() => {
    setPending(getBufferedCount())
  }, [])

  useEffect(() => {
    refreshCount()
    // App load: drain anything left over from a previous offline session.
    drainBuffer().then(refreshCount)

    function handleOnline() {
      setOnline(true)
      // Reconnect: push the buffer up regardless of which page is mounted.
      drainBuffer().then(refreshCount)
    }
    function handleOffline() {
      setOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    // Same-tab buffer writes/removes (custom event) + cross-tab (storage event).
    window.addEventListener(BUFFER_CHANGE_EVENT, refreshCount)
    window.addEventListener('storage', refreshCount)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener(BUFFER_CHANGE_EVENT, refreshCount)
      window.removeEventListener('storage', refreshCount)
    }
  }, [refreshCount])

  const status = !online ? 'offline' : pending > 0 ? 'buffering' : 'saved'

  return { online, pending, status }
}
