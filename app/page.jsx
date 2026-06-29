'use client'

import dynamic from 'next/dynamic'

// The whole app is the existing React Router (HashRouter) SPA. It is browser-only
// (uses window, localStorage, the YouTube IFrame API), so render it client-side
// with SSR disabled. Next.js + Neon's same-origin auth handler exist only to make
// the session cookie first-party; the UI is unchanged.
const App = dynamic(() => import('../src/App.jsx'), { ssr: false })

export default function Page() {
  return <App />
}
