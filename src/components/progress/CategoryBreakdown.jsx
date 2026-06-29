function CategoryRow({ icon, label, actual, target, paceRatio }) {
  const hasTarget = target != null
  const ratio = hasTarget && target > 0 ? Math.min(1, actual / target) : 0
  const isOnTrack = hasTarget ? actual >= target * paceRatio : true
  const isComplete = hasTarget ? actual >= target : false
  const barColor = isComplete ? '#1D9E75' : isOnTrack ? '#1D9E75' : '#C9A84C'

  return (
    <div style={row.wrap}>
      <span style={row.icon} aria-hidden="true">{icon}</span>
      <div style={row.body}>
        <div style={row.topLine}>
          <span style={row.label}>{label}</span>
          <span style={{ ...row.hours, color: hasTarget ? barColor : 'var(--ngsi-navy)' }}>
            {actual.toFixed(1)}{hasTarget ? ` / ${target}h` : 'h'}
          </span>
        </div>
        {hasTarget && (
          <div style={row.barBg}>
            <div style={{ ...row.barFill, width: `${ratio * 100}%`, background: barColor }} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function CategoryBreakdown({
  libraryHours,
  videoExternalHours,
  chatgptHours,
  mentorHours,
  targetChatgptHours,
  targetMentorHours,
  expectedHours,
  targetHours,
}) {
  const paceRatio =
    targetHours > 0 ? Math.min(1, (expectedHours ?? 0) / targetHours) : 0

  return (
    <div style={styles.wrap}>
      <p style={styles.heading}>Hours by Category</p>
      <CategoryRow
        icon="📱"
        label="App Video"
        actual={libraryHours ?? 0}
        target={null}
        paceRatio={paceRatio}
      />
      <CategoryRow
        icon="📺"
        label="Outside Listening"
        actual={videoExternalHours ?? 0}
        target={null}
        paceRatio={paceRatio}
      />
      <CategoryRow
        icon="💬"
        label="ChatGPT Practice"
        actual={chatgptHours ?? 0}
        target={targetChatgptHours}
        paceRatio={paceRatio}
      />
      <CategoryRow
        icon="📞"
        label="Mentor Calls"
        actual={mentorHours ?? 0}
        target={targetMentorHours}
        paceRatio={paceRatio}
      />
    </div>
  )
}

const styles = {
  wrap: {
    padding: '14px 16px',
    borderTop: '1px solid #f0ece2',
  },
  heading: {
    margin: '0 0 10px',
    fontSize: 11,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
}

const row = {
  wrap: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  icon: {
    fontSize: 16,
    lineHeight: '20px',
    flexShrink: 0,
    width: 20,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  topLine: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ngsi-navy)',
  },
  hours: {
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  barBg: {
    height: 5,
    borderRadius: 3,
    background: '#ede7d9',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
}
