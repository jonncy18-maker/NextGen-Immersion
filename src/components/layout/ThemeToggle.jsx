import { useEffect, useState } from 'react'

const STORAGE_KEY = 'ngsi-theme'

function getInitialTheme() {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

// Flips the root <html data-theme> attribute (set up before hydration by the
// blocking inline script in app/layout.jsx) and persists the choice. See
// CLAUDE.md "Theme system" — every --ngsi-* token has a dark override in
// src/styles/tokens.css, so this is the only place that needs to touch the
// attribute at runtime.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // localStorage unavailable (private browsing, etc.) — theme still
      // applies for this session via the DOM attribute.
    }
  }, [theme])

  return (
    <button
      type="button"
      onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      style={styles.btn}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}

const styles = {
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    border: '1px solid var(--ngsi-navy-light)',
    background: 'transparent',
    color: 'var(--ngsi-gold)',
    fontSize: '14px',
    cursor: 'pointer',
    flexShrink: 0,
    lineHeight: 1,
  },
}
