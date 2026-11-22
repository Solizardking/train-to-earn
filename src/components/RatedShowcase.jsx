import { useCallback, useEffect, useRef, useState } from 'react';
import { FiActivity, FiAward, FiCheck, FiMinus, FiX } from 'react-icons/fi';
import { apiGet } from '../utils/api';

// Public submissions pipeline: a live feed of everything the Jev engine
// rates, plus the all-time top-rated showcase. Data comes from
// /api/submissions/* (privacy-safe: truncated wallets, no content) and
// refreshes every 15 seconds.

const TIER_COLORS = {
  Platinum: '#E5E4E2',
  Diamond: '#B9F2FF',
  Gold: '#FFD700',
  Silver: '#C0C0C0',
  Bronze: '#CD7F32',
};

const VERDICT_LABELS = [
  ['solanaSpecific', 'Solana'],
  ['teachesSomething', 'Teaches'],
  ['original', 'Original'],
  ['wellFormed', 'Well-formed'],
  ['safeToTrain', 'Safe'],
];

function timeAgo(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function VerdictDots({ verdicts }) {
  return (
    <span style={{ display: 'inline-flex', gap: '4px' }}>
      {VERDICT_LABELS.map(([key, label]) => {
        const v = verdicts?.[key];
        const color = v === true ? '#14F195' : v === false ? '#FF6B6B' : '#666';
        return (
          <span
            key={key}
            title={`${label}: ${v === null || v === undefined ? 'not rated' : v ? 'pass' : 'fail'}`}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '16px', height: '16px', borderRadius: '50%',
              border: `1px solid ${color}`, color, fontSize: '10px',
            }}
          >
            {v === true ? <FiCheck size={10} /> : v === false ? <FiX size={10} /> : <FiMinus size={10} />}
          </span>
        );
      })}
    </span>
  );
}

function SubmissionRow({ sub, rank }) {
  const tierColor = TIER_COLORS[sub.tier] || '#C0C0C0';
  return (
    <div style={styles.row}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {rank != null && <span style={{ color: '#FFD700', fontWeight: 700 }}>#{rank + 1}</span>}
          <span style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>
            {sub.filename}
          </span>
          <span style={{ ...styles.tierBadge, color: tierColor, borderColor: tierColor }}>{sub.tier}</span>
        </div>
        <div className="text-secondary" style={{ fontSize: '12px', marginTop: '4px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{sub.wallet}</span>
          <span>{(sub.dataSize / 1024).toFixed(1)} KB</span>
          <span>{timeAgo(sub.ratedAt)}</span>
          <VerdictDots verdicts={sub.verdicts} />
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: tierColor }}>{sub.score}</div>
        <div style={{ fontSize: '12px', color: '#14F195' }}>+{sub.clawdReward} CLAWD</div>
      </div>
    </div>
  );
}

export default function RatedShowcase() {
  const [recent, setRecent] = useState([]);
  const [top, setTop] = useState([]);
  const [stats, setStats] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const [recentRes, topRes, statsRes] = await Promise.all([
        apiGet('/api/submissions/recent?limit=12'),
        apiGet('/api/submissions/top?limit=8'),
        apiGet('/api/submissions/stats'),
      ]);
      setRecent(recentRes.submissions || []);
      setTop(topRes.submissions || []);
      setStats(statsRes.stats || null);
      setLoaded(true);
    } catch {
      // Feed quietly retries on the next poll; the rest of the page is fine.
    }
  }, []);

  useEffect(() => {
    fetchAll();
    timer.current = setInterval(fetchAll, 15000);
    return () => clearInterval(timer.current);
  }, [fetchAll]);

  return (
    <section style={styles.shell}>
      <div style={styles.header}>
        <div>
          <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={styles.liveDot} /> Live pipeline
          </span>
          <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '6px 0 4px' }}>Rated by Jev, on the record</h2>
          <p className="text-secondary" style={{ margin: 0, fontSize: '14px' }}>
            Every submission is rated in realtime and tracked here — no hidden queue, no fake numbers.
          </p>
        </div>
        <FiActivity size={28} color="#14F195" />
      </div>

      {stats && (
        <div style={styles.statsBand}>
          <div style={styles.stat}><span>Total rated</span><strong>{stats.totalSubmissions}</strong></div>
          <div style={styles.stat}><span>Contributors</span><strong>{stats.contributors}</strong></div>
          <div style={styles.stat}><span>CLAWD earned</span><strong>{stats.totalClawdEarned.toLocaleString()}</strong></div>
          <div style={styles.stat}><span>Average score</span><strong>{stats.averageScore}</strong></div>
          <div style={styles.stat}><span>Last 24h</span><strong>{stats.submissionsLast24h}</strong></div>
        </div>
      )}

      <div style={styles.columns}>
        <div style={styles.column}>
          <h3 style={styles.columnTitle}><FiActivity size={16} /> Live ratings feed</h3>
          {loaded && recent.length === 0 && (
            <p className="text-secondary" style={{ fontSize: '14px' }}>
              No submissions yet — be the first to get rated.
            </p>
          )}
          {recent.map((sub) => <SubmissionRow key={sub.id} sub={sub} />)}
        </div>
        <div style={styles.column}>
          <h3 style={styles.columnTitle}><FiAward size={16} color="#FFD700" /> Top rated showcase</h3>
          {loaded && top.length === 0 && (
            <p className="text-secondary" style={{ fontSize: '14px' }}>
              The showcase fills in as high-scoring data arrives.
            </p>
          )}
          {top.map((sub, i) => <SubmissionRow key={sub.id} sub={sub} rank={i} />)}
        </div>
      </div>
    </section>
  );
}

const styles = {
  shell: {
    marginTop: '48px',
    padding: '28px',
    background: 'linear-gradient(135deg, rgba(153, 69, 255, 0.08) 0%, rgba(20, 241, 149, 0.05) 100%)',
    border: '1px solid rgba(153, 69, 255, 0.25)',
    borderRadius: '20px',
    textAlign: 'left',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px',
  },
  liveDot: {
    width: '9px', height: '9px', borderRadius: '50%', background: '#14F195',
    boxShadow: '0 0 8px #14F195', display: 'inline-block',
  },
  statsBand: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '12px', marginTop: '20px',
  },
  stat: {
    padding: '12px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: '12px',
    display: 'flex', flexDirection: 'column', gap: '2px',
  },
  columns: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '28px', marginTop: '24px',
  },
  column: { minWidth: 0 },
  columnTitle: {
    fontSize: '16px', fontWeight: 700, margin: '0 0 8px',
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px',
    padding: '10px 4px', borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  tierBadge: {
    fontSize: '11px', fontWeight: 700, padding: '2px 8px',
    border: '1px solid', borderRadius: '999px',
  },
};
