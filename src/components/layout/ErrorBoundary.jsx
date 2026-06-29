import { Component } from 'react'

// App-wide error boundary. Catches render-time crashes anywhere in the tree and
// shows a branded fallback instead of a blank white screen. Watch time is never
// lost here — it is persisted to localStorage before every network call, so a
// reload picks up where things left off.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // No telemetry backend — surface in the console for debugging.
    console.error('App error boundary caught:', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.wrap}>
          <div style={styles.card}>
            <p style={styles.title}>Something went wrong</p>
            <p style={styles.message}>
              The app hit an unexpected error. Reloading usually fixes it — your
              watch time is saved.
            </p>
            <button style={styles.button} onClick={this.handleReload}>
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: 'var(--ngsi-cream)',
  },
  card: {
    maxWidth: 420,
    width: '100%',
    background: '#fff',
    border: '1px solid var(--ngsi-cream-dark)',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(22,32,64,0.08)',
    padding: '28px 24px',
    textAlign: 'center',
  },
  title: {
    margin: '0 0 10px',
    fontFamily: 'Georgia, serif',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
  },
  message: {
    margin: '0 0 20px',
    fontSize: 14,
    color: '#5a6072',
    lineHeight: 1.5,
  },
  button: {
    background: 'var(--ngsi-navy)',
    color: 'var(--ngsi-cream)',
    border: 'none',
    borderRadius: 6,
    padding: '0.6rem 1.4rem',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
