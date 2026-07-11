export const metadata = {
  title: 'Privacy & Data Deletion — NGS Immersion',
}

export default function DataPrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '48px 24px',
        fontFamily: 'Georgia, serif',
        color: '#162040',
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ marginBottom: 8 }}>NGS Immersion — Privacy &amp; Data Deletion</h1>
      <p style={{ color: '#5a5a5a', marginBottom: 32 }}>Last updated July 2026</p>

      <h2>What we collect</h2>
      <p>
        NGS Immersion is an internal comprehensible-input tool for NextGen Scholars program
        participants. Accounts are created and managed by program administrators, not by public
        self-signup. For each account we store: name, email address, and study activity — video
        watch duration and completion, and logged external study sessions (e.g. conversation
        practice, mentor calls), used solely to track progress toward program milestones.
      </p>
      <p>
        We do not collect location data, financial information, health data, photos, contacts, or
        browsing history. We do not use analytics or advertising SDKs.
      </p>

      <h2>Requesting account or data deletion</h2>
      <p>
        To request deletion of your NGS Immersion account and associated data, email{' '}
        <a href="mailto:jonncy18@gmail.com">jonncy18@gmail.com</a> with your account email address
        and a deletion request.
      </p>
      <p>
        We will delete your account information (name, email), watch history, and study session
        logs within 30 days of a verified request. Some aggregate, de-identified usage data may be
        retained for program reporting purposes.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions, contact{' '}
        <a href="mailto:jonncy18@gmail.com">jonncy18@gmail.com</a>.
      </p>
    </main>
  )
}
