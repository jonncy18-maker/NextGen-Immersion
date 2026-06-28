/**
 * Shared internal placeholder card for the scaffold phase.
 * Visibly themed with navy/gold/cream tokens so the shell looks branded.
 */
export default function Placeholder({ label }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--ngsi-cream)',
      }}
    >
      <header
        style={{
          background: 'var(--ngsi-navy)',
          color: 'var(--ngsi-cream)',
          padding: '1rem 1.5rem',
          borderBottom: '3px solid var(--ngsi-gold)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: '1.5rem',
            height: '1.5rem',
            borderRadius: '4px',
            background: 'var(--ngsi-gold)',
          }}
        />
        <strong style={{ letterSpacing: '0.04em' }}>NGS Immersion</strong>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div
          style={{
            background: 'var(--ngsi-cream-dark)',
            border: '1px solid var(--ngsi-gold)',
            borderRadius: '12px',
            padding: '2rem 2.5rem',
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(14, 22, 40, 0.08)',
          }}
        >
          <h1 style={{ margin: 0, color: 'var(--ngsi-navy)' }}>
            {label} — coming soon
          </h1>
        </div>
      </main>
    </div>
  );
}
