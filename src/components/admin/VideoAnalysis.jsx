import { useState } from 'react';
import { getAuthToken } from '../../lib/authToken.js';

// YYYY-MM-DD for `n` days ago from today (browser-local; admin can adjust).
function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
const TODAY = new Date().toISOString().slice(0, 10);

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

// Tiny markdown renderer for the AI briefing (## headings + `-`/`*` bullets).
function renderBriefing(text) {
  const blocks = [];
  let list = null;
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      if (list) {
        blocks.push(list);
        list = null;
      }
      return;
    }
    if (line.startsWith('## ')) {
      if (list) {
        blocks.push(list);
        list = null;
      }
      blocks.push(
        <p key={`h${i}`} style={md.heading}>
          {line.slice(3)}
        </p>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!list) list = { type: 'ul', key: `l${i}`, items: [] };
      list.items.push(line.slice(2));
    } else {
      if (list) {
        blocks.push(list);
        list = null;
      }
      blocks.push(
        <p key={`p${i}`} style={md.para}>
          {line}
        </p>
      );
    }
  });
  if (list) blocks.push(list);

  return blocks.map((b) =>
    b.type === 'ul' ? (
      <ul key={b.key} style={md.ul}>
        {b.items.map((it, j) => (
          <li key={j} style={md.li}>
            {it}
          </li>
        ))}
      </ul>
    ) : (
      b
    )
  );
}

export default function VideoAnalysis({ userId }) {
  const [startDate, setStartDate] = useState(isoDaysAgo(30));
  const [endDate, setEndDate] = useState(TODAY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  function applyPreset(days) {
    setStartDate(isoDaysAgo(days));
    setEndDate(TODAY);
  }

  async function analyze() {
    if (!userId) return;
    if (startDate > endDate) {
      setError('Start date must be on or before the end date.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/scholar-video-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, startDate, endDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Analysis failed.');
      }
      setResult(await res.json());
    } catch (e) {
      setError(e.message || 'Analysis failed.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const stats = result?.stats;

  return (
    <div>
      <div style={styles.card}>
        <p style={styles.heading}>Watch-History Analysis</p>
        <p style={styles.blurb}>
          Pick a date range to analyze every video watched — finished or not —
          and get AI-suggested topics to discuss in a 1-on-1.
        </p>

        <div style={styles.rangeRow}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>From</span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.dateInput}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>To</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={TODAY}
              onChange={(e) => setEndDate(e.target.value)}
              style={styles.dateInput}
            />
          </label>
        </div>

        <div style={styles.presetRow}>
          {PRESETS.map((p) => (
            <button
              key={p.days}
              style={styles.presetBtn}
              onClick={() => applyPreset(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button style={styles.analyzeBtn} onClick={analyze} disabled={loading}>
          {loading ? 'Analyzing…' : 'Analyze range'}
        </button>

        {error && <p style={styles.error}>{error}</p>}
      </div>

      {stats && (
        <div style={{ ...styles.card, marginTop: 12 }}>
          <div style={styles.statsRow}>
            <Stat value={stats.videos_count} label="videos" />
            <Stat value={stats.completed_count} label="finished" />
            <Stat value={stats.total_minutes} label="minutes" />
          </div>

          {result?.message && (
            <div style={styles.briefing}>{renderBriefing(result.message)}</div>
          )}

          {result?.generated_at && (
            <p style={styles.timestamp}>
              Generated{' '}
              {new Date(result.generated_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}

          {stats.videos.length > 0 && (
            <details style={styles.details}>
              <summary style={styles.summary}>
                Videos in this range ({stats.videos.length})
              </summary>
              <ul style={styles.videoList}>
                {stats.videos.map((v, i) => (
                  <li key={i} style={styles.videoItem}>
                    <span style={styles.videoTitle}>{v.title}</span>
                    <span style={styles.videoMeta}>
                      {[v.topic_primary, v.level].filter(Boolean).join(' · ')} ·{' '}
                      {v.minutes_watched} min
                      {v.completed ? ' · finished' : ' · partial'}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(22,32,64,0.08)',
    overflow: 'hidden',
    padding: '16px 18px',
  },
  heading: {
    margin: '0 0 6px',
    fontSize: 11,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  blurb: {
    margin: '0 0 14px',
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 1.5,
  },
  rangeRow: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  dateInput: {
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #e8e3da',
    borderRadius: 8,
    color: 'var(--ngsi-navy)',
    fontFamily: 'inherit',
    background: '#fff',
  },
  presetRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  presetBtn: {
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid #e8e3da',
    borderRadius: 999,
    background: '#faf8f3',
    color: 'var(--ngsi-navy)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  analyzeBtn: {
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 700,
    border: 'none',
    borderRadius: 8,
    background: 'var(--ngsi-navy)',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  error: { margin: '10px 0 0', fontSize: 13, color: '#C95B3A' },
  statsRow: {
    display: 'flex',
    gap: 20,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottom: '1px solid #f0ece3',
  },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  statValue: {
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
    fontFamily: 'Georgia, serif',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#8a8f99',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  briefing: { fontSize: 14, color: 'var(--ngsi-navy)', lineHeight: 1.65 },
  timestamp: { margin: '10px 0 0', fontSize: 11, color: '#8a8f99' },
  details: { marginTop: 14, borderTop: '1px solid #f0ece3', paddingTop: 10 },
  summary: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ngsi-navy)',
    cursor: 'pointer',
  },
  videoList: { margin: '10px 0 0', padding: 0, listStyle: 'none' },
  videoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '8px 0',
    borderBottom: '1px solid #f5f2eb',
  },
  videoTitle: { fontSize: 13, fontWeight: 500, color: 'var(--ngsi-navy)' },
  videoMeta: { fontSize: 12, color: '#8a8f99' },
};

const md = {
  heading: {
    margin: '16px 0 6px',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--ngsi-navy)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  para: {
    margin: '0 0 8px',
    fontSize: 14,
    color: 'var(--ngsi-navy)',
    lineHeight: 1.65,
  },
  ul: { margin: '0 0 8px', paddingLeft: 20 },
  li: {
    fontSize: 14,
    color: 'var(--ngsi-navy)',
    lineHeight: 1.6,
    marginBottom: 6,
  },
};
