'use client'

import { useEffect } from 'react'

// Registers the static hand-rolled service worker (public/sw.js) at app scope.
// Browser-only — mounted once from app/layout.jsx. See docs/PWA.md: this SW
// only caches the app shell + static assets; it must never intercept or
// cache /api/** or /api/auth/** (enforced in public/sw.js's fetch handler).
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.error('Service worker registration failed:', err)
    })
  }, [])

  return null
}
