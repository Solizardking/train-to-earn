import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { FiZap, FiRefreshCw, FiCheckCircle, FiXCircle, FiAward, FiUploadCloud } from 'react-icons/fi';
import { apiGet, apiPost } from '../utils/api';

// Jev decision-engine panel: when a wallet is signed in, shows the wallet's
// persisted training-data rating (score, tier, $CLAWD reward totals) and lets
// the user rate new Solana training data in realtime. Ratings come from
// POST /api/jev/rate (TypeSafe Jev via the Neon AI Gateway, blended with the
// local heuristic) and persist per wallet in Neon Postgres.

const SAMPLE = `Instruction: Explain how a Solana program uses a PDA.
Response: A Program Derived Address (PDA) is an address derived from a program id and a set of seeds, guaranteed to fall off the Ed25519 curve so only the program can sign for it. In Anchor you declare seeds and a bump in the account constraints; the runtime derives the address with Pubkey::find_program_address, and invoke_signed lets the program sign CPI calls on the PDA's behalf. Example: a vault PDA with seeds [b"vault", user.key()] holds user funds that only the vault program can move.`;

const TIER_COLORS = {
  Platinum: '#E5E4E2',
  Diamond: '#7DD3FC',
  Gold: '#FFD700',
  Silver: '#C0C0C0',
  Bronze: '#CD7F32',
};

function VerdictRow({ label, verdict }) {
  if (!verdict) return null;
  const ok = verdict.value;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
      {ok ? <FiCheckCircle color="#14F195" size={14} /> : <FiXCircle color="#FF6B6B" size={14} />}
      <span style={{ fontSize: '13px' }}>{label}</span>
      <span className="text-secondary" style={{ fontSize: '12px', marginLeft: 'auto' }}>
        {verdict.label || (ok ? 'yes' : 'no')}
        {typeof verdict.confidence === 'number' && verdict.confidence < 1
          ? ` · ${(verdict.confidence * 100).toFixed(0)}% sure`
          : ''}
      </span>
    </div>
  );
}

export default function JevRatingPanel() {
  const { publicKey, connected } = useWallet();
  const [profile, setProfile] = useState(null);
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState('training-data.txt');
  const [rating, setRating] = useState(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  const onFileChosen = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 256 * 1024) {
      setError(`"${file.name}" is ${(file.size / 1024).toFixed(0)} KB — submissions are limited to 256 KB of text. Split it and submit the strongest part.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setContent(String(reader.result || ''));
      setFilename(file.name);
      setError(null);
    };
    reader.onerror = () => setError(`Could not read "${file.name}" — paste the text instead.`);
    reader.readAsText(file);
  };

  const walletAddress = publicKey ? publicKey.toString() : null;

  const fetchProfile = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const data = await apiGet(`/api/jev/rating/${walletAddress}`);
      setProfile(data);
      if (data.latest && !rating) {
        setRating({
          score: Number(data.latest.score),
          tier: data.latest.tier,
          clawdReward: data.latest.clawd_reward,
          source: data.latest.source,
          model: data.latest.model,
          verdicts: data.latest.verdicts,
          ratedAt: data.latest.created_at,
        });
      }
    } catch (err) {
      console.error('Failed to load Jev profile:', err);
    }
  }, [walletAddress, rating]);

  useEffect(() => {
    if (connected && walletAddress) {
      fetchProfile();
    } else {
      setProfile(null);
      setRating(null);
    }
  }, [connected, walletAddress, fetchProfile]);

  const submitRating = async () => {
    if (!walletAddress || !content.trim()) return;
    setRatingBusy(true);
    setError(null);
    try {
      const data = await apiPost('/api/jev/rate', {
        walletAddress,
        content,
        filename,
        metadata: { source: 'jev-panel' },
      });
      setRating(data.rating);
      await fetchProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setRatingBusy(false);
    }
  };

  if (!connected || !walletAddress) {
    return (
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FiZap color="#9945FF" size={20} />
          <h3 style={{ margin: 0 }}>Jev Training-Data Rating</h3>
        </div>
        <p className="text-secondary" style={{ marginTop: '10px', fontSize: '14px', lineHeight: 1.6 }}>
          Get a realtime Jev rating on the quality of your Solana training data — and earn
          $CLAWD rewards for high-scoring contributions. Ratings are saved to your wallet,
          so step one is signing in:
        </p>
        <ol style={{ margin: '12px 0 0', paddingLeft: '20px', fontSize: '14px', lineHeight: 1.7 }}>
          <li>
            Click <strong>Select Wallet</strong> in the top-right corner and pick Phantom,
            Solflare, or Backpack. No wallet yet? Install one free at{' '}
            <a href="https://phantom.app" target="_blank" rel="noreferrer">phantom.app</a> or{' '}
            <a href="https://solflare.com" target="_blank" rel="noreferrer">solflare.com</a>,
            then come back.
          </li>
          <li>Approve the connection in your wallet — that is your sign-in. No email, no password.</li>
          <li>Come back to this panel on the Portfolio tab, paste or upload your training data, and hit <strong>Rate with Jev</strong>.</li>
        </ol>
      </div>
    );
  }

  const tierColor = rating ? TIER_COLORS[rating.tier] || '#14F195' : '#14F195';

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <FiZap color="#9945FF" size={20} />
        <h3 style={{ margin: 0, flex: 1 }}>Jev Training-Data Rating</h3>
        <button type="button" className="btn" onClick={fetchProfile} title="Refresh rating">
          <FiRefreshCw size={14} />
        </button>
      </div>

      {profile?.stats?.ratingsCount > 0 && (
        <div className="grid grid-3" style={{ marginTop: '14px', gap: '12px' }}>
          <div>
            <div className="text-secondary" style={{ fontSize: '12px' }}>Ratings</div>
            <strong>{profile.stats.ratingsCount}</strong>
          </div>
          <div>
            <div className="text-secondary" style={{ fontSize: '12px' }}>Average score</div>
            <strong>{profile.stats.averageScore}</strong>
          </div>
          <div>
            <div className="text-secondary" style={{ fontSize: '12px' }}>Rewards earned</div>
            <strong>{profile.stats.totalClawdReward} CLAWD</strong>
          </div>
        </div>
      )}

      {rating && (
        <div style={{ marginTop: '16px', padding: '14px', borderRadius: '12px', background: 'rgba(153,69,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
            <span className="gradient-text" style={{ fontSize: '36px', fontWeight: 700 }}>
              {rating.score}
            </span>
            <span style={{ color: tierColor, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FiAward size={16} /> {rating.tier}
            </span>
            <span style={{ fontSize: '14px' }}>
              +{rating.clawdReward} CLAWD reward
            </span>
            <span className="text-secondary" style={{ fontSize: '12px', marginLeft: 'auto' }}>
              {rating.source === 'jev+heuristic' ? `Jev · ${rating.model}` : 'Heuristic (Jev unavailable)'}
            </span>
          </div>
          {rating.verdicts && (
            <div style={{ marginTop: '10px' }}>
              <VerdictRow label="Solana-specific" verdict={rating.verdicts.solana_specific} />
              <VerdictRow label="Teaches something" verdict={rating.verdicts.teaches_something} />
              <VerdictRow label="Original content" verdict={rating.verdicts.original} />
              <VerdictRow label="Well-formed" verdict={rating.verdicts.well_formed} />
              <VerdictRow label="Safe to train on" verdict={rating.verdicts.safe_to_train} />
              {typeof rating.verdicts.quality_score === 'number' && (
                <div style={{ display: 'flex', padding: '4px 0', fontSize: '13px' }}>
                  <span>Jev quality score</span>
                  <span className="text-secondary" style={{ marginLeft: 'auto', fontSize: '12px' }}>
                    {rating.verdicts.quality_score}/100
                  </span>
                </div>
              )}
            </div>
          )}
          {rating.unsafe && (
            <p style={{ color: '#FF6B6B', fontSize: '13px', marginTop: '8px' }}>
              Flagged unsafe — score capped. Remove secrets or harmful content and resubmit.
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: '16px' }}>
        <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(20,241,149,0.06)', border: '1px solid rgba(20,241,149,0.18)', marginBottom: '12px' }}>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.65 }}>
            <strong>What to submit:</strong> Solana training data in instruction/response
            form — e.g. <em>“Instruction: How do SPL token accounts work? Response: …”</em>{' '}
            Jev scores five things: Solana-specific, teaches something, original,
            well-formed, and safe to train on. Complete explanations with a worked
            example score highest; short snippets and copied filler score low.
            Never include seed phrases or private keys.
          </p>
        </div>
        <input
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="filename (e.g. solana-pda-guide.md)"
          style={{ width: '100%', marginBottom: '8px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(153,69,255,0.25)', color: 'inherit' }}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the Solana training data you want Jev to rate…"
          rows={7}
          style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(153,69,255,0.25)', color: 'inherit', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <span className="text-secondary" style={{ fontSize: '12px' }}>
            {wordCount} words
          </span>
          {content.trim() && wordCount < 40 && (
            <span style={{ fontSize: '12px', color: '#FFD700' }}>
              Short samples score low — a full explanation with an example rates much higher.
            </span>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.json,.jsonl,.csv,text/plain"
          onChange={onFileChosen}
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submitRating}
            disabled={ratingBusy || !content.trim()}
          >
            {ratingBusy ? 'Jev is rating…' : 'Rate with Jev'}
          </button>
          <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
            <FiUploadCloud size={14} style={{ marginRight: '6px' }} />
            Upload a file
          </button>
          <button type="button" className="btn" onClick={() => setContent(SAMPLE)}>
            Try a sample
          </button>
        </div>
        {error && <p style={{ color: '#FF6B6B', fontSize: '13px', marginTop: '8px' }}>Error: {error}</p>}
      </div>
    </div>
  );
}
