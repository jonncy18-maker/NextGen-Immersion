import GoalEditor from '../components/admin/GoalEditor.jsx'

export default function AdminGoals() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Goals</h1>
        <p style={styles.sub}>
          Set the program-wide target and start each scholar&apos;s goal clock. Start dates drive
          the ON TRACK / AT RISK pacing on the dashboard.
        </p>
        <GoalEditor />
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: 'calc(100vh - 56px)', background: 'var(--ngsi-cream)' },
  container: { maxWidth: 760, margin: '0 auto', padding: 24 },
  title: {
    margin: '0 0 6px',
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
    fontFamily: 'Georgia, serif',
  },
  sub: { margin: '0 0 22px', fontSize: 13, color: '#5a6070', lineHeight: 1.5 },
}
