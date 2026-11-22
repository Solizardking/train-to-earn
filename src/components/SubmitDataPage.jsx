import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  FiAward,
  FiCheckCircle,
  FiFilm,
  FiImage,
  FiDatabase,
  FiCpu,
  FiFileText,
  FiPlus,
  FiTrash2,
  FiUploadCloud,
  FiXCircle,
  FiZap,
} from 'react-icons/fi';
import { apiGet, apiPost } from '../utils/api';
import { apiAuthGet, apiUpload, getToken } from '../utils/auth';

// Submit Data — one surface for every data form (Jev-2):
//   Text    -> POST /api/jev/rate            (live, unchanged)
//   Image   -> POST /api/jev/rate-media      { wallet, kind: "image", items }
//   Video   -> POST /api/jev/rate-media      { wallet, kind: "video", ... }  (by reference)
//   Dataset -> POST /api/jev/rate-dataset    { wallet, kind: "dataset", manifest } -> { jobId }
//   Robot   -> POST /api/jev/rate-dataset    { wallet, kind: "robot", manifest }   -> { jobId }
// Async kinds are polled at GET /api/jev/jobs/:id -> { status, result }.
//
// Rewards use verified data weight, and bulk / robot / video weight only
// earns above the 25 CLAWD floor at Silver (>= 65). Scores are labelled
// honestly: "heuristic-fallback" is never presented as a Jev verdict.

const TIER_COLORS = {
  Platinum: '#E5E4E2',
  Diamond: '#7DD3FC',
  Gold: '#FFD700',
  Silver: '#C0C0C0',
  Bronze: '#CD7F32',
};

const TABS = [
  { id: 'text', label: 'Text', Icon: FiFileText },
  { id: 'image', label: 'Image + caption', Icon: FiImage },
  { id: 'video', label: 'Video', Icon: FiFilm },
  { id: 'dataset', label: 'Dataset', Icon: FiDatabase },
  { id: 'robot', label: 'Robot data', Icon: FiCpu },
];

const inputStyle = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: '8px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(153,69,255,0.25)',
  color: 'inherit',
  fontSize: '14px',
};

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  color: '#B0B0B0',
  marginBottom: '5px',
  fontWeight: 600,
};

function engineLabel(result) {
  if (!result) return '';
  const source = result.source || result.rating?.source;
  if (source === 'heuristic-fallback') return 'Heuristic fallback — Jev was unavailable; this is not a Jev verdict';
  if (source === 'jev+heuristic') return `Jev + heuristic${result.model || result.rating?.model ? ` · ${result.model || result.rating?.model}` : ''}`;
  if (source) return source;
  return '';
}

function VerdictRow({ label, verdict }) {
  if (!verdict || typeof verdict !== 'object') return null;
  const ok = verdict.value;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', fontSize: '13px' }}>
      {ok ? <FiCheckCircle color="#14F195" size={14} /> : <FiXCircle color="#FF6B6B" size={14} />}
      <span>{label}</span>
      <span className="text-secondary" style={{ fontSize: '12px', marginLeft: 'auto' }}>
        {verdict.label || (ok ? 'yes' : 'no')}
      </span>
    </div>
  );
}

function RatingResult({ result }) {
  if (!result) return null;
  const rating = result.rating || result.result || result;
  const score = rating.score ?? result.score;
  if (typeof score !== 'number' && !rating.tier) {
    return (
      <div style={{ marginTop: '16px', padding: '14px', borderRadius: '12px', background: 'rgba(153,69,255,0.08)' }}>
        <pre style={{ margin: 0, fontSize: '12px', overflow: 'auto' }}>{JSON.stringify(result, null, 2)}</pre>
      </div>
    );
  }
  const tier = rating.tier || result.tier;
  const reward = rating.clawdReward ?? rating.reward ?? result.clawdReward ?? result.reward ?? result.estimatedReward;
  const verifiedWeight = rating.verifiedWeight ?? result.verifiedWeight;
  const verdicts = rating.verdicts || result.verdicts;
  return (
    <div style={{ marginTop: '16px', padding: '14px', borderRadius: '12px', background: 'rgba(153,69,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
        {typeof score === 'number' && (
          <span className="gradient-text" style={{ fontSize: '36px', fontWeight: 700 }}>{score}</span>
        )}
        {tier && (
          <span style={{ color: TIER_COLORS[tier] || '#14F195', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <FiAward size={16} /> {tier}
          </span>
        )}
        {typeof reward === 'number' && <span style={{ fontSize: '14px' }}>+{reward} CLAWD estimated reward</span>}
        {typeof verifiedWeight === 'number' && (
          <span className="text-secondary" style={{ fontSize: '12px' }}>verified weight {verifiedWeight}</span>
        )}
        <span className="text-secondary" style={{ fontSize: '12px', marginLeft: 'auto' }}>{engineLabel(result)}</span>
      </div>
      {rating.visionSource !== undefined && (
        <p className="text-secondary" style={{ fontSize: '12px', marginTop: '6px' }}>
          Vision sensor: {rating.visionSource || 'unavailable — rated without the vision leg'}
        </p>
      )}
      {verdicts && (
        <div style={{ marginTop: '10px' }}>
          <VerdictRow label="Solana-specific" verdict={verdicts.solana_specific} />
          <VerdictRow label="Teaches something" verdict={verdicts.teaches_something} />
          <VerdictRow label="Original content" verdict={verdicts.original} />
          <VerdictRow label="Well-formed" verdict={verdicts.well_formed} />
          <VerdictRow label="Safe to train on" verdict={verdicts.safe_to_train} />
        </div>
      )}
      {(rating.unsafe || result.unsafe) && (
        <p style={{ color: '#FF6B6B', fontSize: '13px', marginTop: '8px' }}>
          Flagged unsafe — score capped at 20. Remove secrets or harmful content and resubmit.
        </p>
      )}
      {rating.validation && (
        <p className="text-secondary" style={{ fontSize: '12px', marginTop: '8px' }}>
          Validation: {typeof rating.validation === 'string' ? rating.validation : JSON.stringify(rating.validation)}
        </p>
      )}
    </div>
  );
}

export default function SubmitDataPage() {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey ? publicKey.toString() : null;

  const [tab, setTab] = useState('text');
  const [busy, setBusy] = useState(false);
  const [jobStatus, setJobStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  // text
  const [filename, setFilename] = useState('training-data.txt');
  const [content, setContent] = useState('');
  // image
  const [pairs, setPairs] = useState([{ mediaRef: '', mediaHash: '', caption: '', context: '' }]);
  // video
  const [video, setVideo] = useState({ title: '', sourceUrl: '', durationMinutes: '', caption: '', context: '' });
  // dataset / robot shared manifest fields
  const [manifest, setManifest] = useState({
    title: '', hostType: 'huggingface', hostRef: '', hostRevision: '', format: 'jsonl',
    declaredRows: '', declaredEpisodes: '', declaredBytes: '', contentHash: '', license: '',
    captionSample: '', taskDescription: '', schema: '',
  });
  // uploads (login-gated)
  const [uploads, setUploads] = useState(null);
  const [uploadNote, setUploadNote] = useState(null);
  const uploadFileRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const loadUploads = useCallback(async () => {
    if (!getToken()) {
      setUploads(null);
      return;
    }
    try {
      const data = await apiAuthGet('/api/uploads/mine');
      setUploads(Array.isArray(data) ? data : (data.uploads || []));
    } catch {
      setUploads(null);
    }
  }, []);

  useEffect(() => {
    loadUploads();
  }, [loadUploads, walletAddress]);

  const pollJob = useCallback((jobId) => {
    stopPolling();
    setJobStatus('queued');
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiGet(`/api/jev/jobs/${jobId}`);
        const status = data.status || 'queued';
        setJobStatus(status);
        if (status === 'scored' || status === 'completed' || status === 'done') {
          stopPolling();
          setBusy(false);
          setResult(data.result || data.rating || data);
        } else if (status === 'failed' || status === 'error') {
          stopPolling();
          setBusy(false);
          setError(data.error || data.result?.error || 'The rating job failed. Check the reference and resubmit.');
        }
      } catch (err) {
        stopPolling();
        setBusy(false);
        setError(`Lost track of job ${jobId}: ${err.message}`);
      }
    }, 2500);
  }, [stopPolling]);

  // Handles both sync ratings and async { jobId } responses.
  const handleResponse = (data) => {
    const jobId = data.jobId || data.job_id || data.id;
    const hasRating = data.rating || typeof data.score === 'number' || data.result;
    if (jobId && !hasRating && (data.status === 'queued' || data.status === 'validating' || data.accepted)) {
      pollJob(jobId);
      return;
    }
    if (jobId && !hasRating) {
      pollJob(jobId);
      return;
    }
    setBusy(false);
    setResult(data);
  };

  const submit = async () => {
    if (!walletAddress) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setJobStatus(null);
    try {
      if (tab === 'text') {
        const data = await apiPost('/api/jev/rate', {
          walletAddress,
          wallet: walletAddress,
          content,
          filename,
          metadata: { source: 'submit-page' },
        });
        setBusy(false);
        setResult(data);
      } else if (tab === 'image') {
        const items = pairs.filter((p) => p.mediaRef.trim() && p.caption.trim());
        if (items.length === 0) throw new Error('Add at least one image reference with a caption — an uncaptioned image is not training data.');
        const data = await apiPost('/api/jev/rate-media', {
          wallet: walletAddress,
          walletAddress,
          kind: 'image',
          items,
        });
        handleResponse(data);
      } else if (tab === 'video') {
        if (!video.sourceUrl.trim()) throw new Error('Video is by reference only — paste the Hugging Face or Arweave URL.');
        const data = await apiPost('/api/jev/rate-media', {
          wallet: walletAddress,
          walletAddress,
          kind: 'video',
          title: video.title,
          sourceUrl: video.sourceUrl,
          mediaRef: video.sourceUrl,
          durationMinutes: video.durationMinutes ? Number(video.durationMinutes) : undefined,
          caption: video.caption,
          context: video.context,
        });
        handleResponse(data);
      } else {
        const kind = tab; // 'dataset' | 'robot'
        const built = {
          manifestVersion: 1,
          kind,
          walletAddress,
          title: manifest.title,
          host: { type: manifest.hostType, ref: manifest.hostRef, revision: manifest.hostRevision || undefined },
          format: manifest.format,
          declaredRows: manifest.declaredRows ? Number(manifest.declaredRows) : undefined,
          declaredEpisodes: manifest.declaredEpisodes ? Number(manifest.declaredEpisodes) : undefined,
          declaredBytes: manifest.declaredBytes ? Number(manifest.declaredBytes) : undefined,
          contentHash: manifest.contentHash,
          license: manifest.license,
          captionSample: manifest.captionSample
            ? manifest.captionSample.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20)
            : undefined,
          taskDescription: kind === 'robot' ? manifest.taskDescription : undefined,
          schema: kind === 'robot' && manifest.schema ? manifest.schema : undefined,
        };
        if (!built.host.ref) throw new Error('Bulk data is by reference only — publish it to Hugging Face or Arweave first (Data Hub tab), then submit the manifest.');
        if (!built.contentHash) throw new Error('A content hash is required — it binds the rating to the exact bytes you published.');
        const data = await apiPost('/api/jev/rate-dataset', {
          wallet: walletAddress,
          walletAddress,
          kind,
          manifest: built,
        });
        handleResponse(data);
      }
    } catch (err) {
      setBusy(false);
      setError(err.message);
    }
  };

  const uploadByReference = async () => {
    setUploadNote(null);
    try {
      const ref = tab === 'video' ? video.sourceUrl : manifest.hostRef;
      const data = await apiUpload({
        kind: tab,
        name: manifest.title || video.title || filename,
        description: manifest.taskDescription || video.caption || '',
        sourceUrl: ref,
      });
      setUploadNote(`Saved to your uploads${data.id ? ` (#${data.id})` : ''}.`);
      loadUploads();
    } catch (err) {
      setUploadNote(`Upload failed: ${err.message}`);
    }
  };

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadNote(null);
    try {
      const data = await apiUpload(file);
      setUploadNote(`Uploaded ${file.name}${data.id ? ` (#${data.id})` : ''}.`);
      loadUploads();
    } catch (err) {
      setUploadNote(`Upload failed: ${err.message}`);
    }
  };

  if (!connected || !walletAddress) {
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FiZap color="#9945FF" size={20} />
          <h3 style={{ margin: 0 }}>Submit training data</h3>
        </div>
        <p className="text-secondary" style={{ marginTop: '10px', fontSize: '14px', lineHeight: 1.6 }}>
          Submit text, image + caption pairs, video, bulk datasets, or robot episode data and
          let the Jev engine rate it — quality data earns $CLAWD credited to your wallet.
          Submissions are tied to the earning wallet, so connect a wallet first with{' '}
          <strong>Select Wallet</strong> (top-right). No email, no password.
        </p>
      </div>
    );
  }

  const setM = (field, value) => setManifest((m) => ({ ...m, [field]: value }));
  const setV = (field, value) => setVideo((v) => ({ ...v, [field]: value }));
  const setPair = (index, field, value) => setPairs((ps) => ps.map((p, i) => (i === index ? { ...p, [field]: value } : p)));

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <FiZap color="#9945FF" size={20} />
        <h3 style={{ margin: 0, flex: 1 }}>Submit training data — every form, one Jev</h3>
        <span className="text-secondary" style={{ fontSize: '12px' }}>
          Earning wallet {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
        </span>
      </div>
      <p className="text-secondary" style={{ fontSize: '13px', lineHeight: 1.6, marginTop: '8px' }}>
        Text rates instantly. Images and video are rated from references + captions (publish
        media in the Data Hub first — raw bulk data never transits the rating API). Datasets
        and robot data are submitted as a manifest and rated asynchronously; bulk weight only
        earns above the 25 CLAWD floor at Silver (≥ 65), and duplicates earn zero. Never
        include seed phrases or private keys in any submission.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setTab(id); setResult(null); setError(null); setJobStatus(null); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '9px 14px', borderRadius: '999px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              background: tab === id ? 'linear-gradient(135deg, #9945FF, #7928CA)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${tab === id ? '#9945FF' : 'rgba(153,69,255,0.25)'}`,
              color: '#fff',
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: '16px' }}>
        {tab === 'text' && (
          <div>
            <label style={labelStyle}>Filename</label>
            <input value={filename} onChange={(e) => setFilename(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} placeholder="solana-pda-guide.md" />
            <label style={labelStyle}>Training data (≤ 256 KB of text)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Instruction: … Response: …"
            />
            <span className="text-secondary" style={{ fontSize: '12px' }}>
              {content.trim() ? content.trim().split(/\s+/).length : 0} words — complete explanations with a worked example score highest.
            </span>
          </div>
        )}

        {tab === 'image' && (
          <div>
            <p className="text-secondary" style={{ fontSize: '13px', lineHeight: 1.6, marginTop: 0 }}>
              Up to 50 pairs. Each image lives on your Hugging Face dataset or Arweave upload;
              submit its reference + hash + a real caption (≥ 20 characters earns full weight).
            </p>
            {pairs.map((pair, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px', padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)' }}>
                <div>
                  <label style={labelStyle}>Image reference (URL or ar:// tx)</label>
                  <input value={pair.mediaRef} onChange={(e) => setPair(i, 'mediaRef', e.target.value)} style={inputStyle} placeholder="https://huggingface.co/datasets/…/chart.png" />
                </div>
                <div>
                  <label style={labelStyle}>Image SHA-256 (optional)</label>
                  <input value={pair.mediaHash} onChange={(e) => setPair(i, 'mediaHash', e.target.value)} style={inputStyle} placeholder="sha256:…" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Caption — what does this image teach?</label>
                  <input value={pair.caption} onChange={(e) => setPair(i, 'caption', e.target.value)} style={inputStyle} placeholder="A Solana wallet approval screen showing…" />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px' }}>
                  <input value={pair.context} onChange={(e) => setPair(i, 'context', e.target.value)} style={inputStyle} placeholder="Context (optional): where was this captured?" />
                  {pairs.length > 1 && (
                    <button type="button" className="btn" onClick={() => setPairs((ps) => ps.filter((_, j) => j !== i))} title="Remove pair">
                      <FiTrash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {pairs.length < 50 && (
              <button type="button" className="btn btn-secondary" onClick={() => setPairs((ps) => [...ps, { mediaRef: '', mediaHash: '', caption: '', context: '' }])}>
                <FiPlus size={14} style={{ marginRight: '6px' }} /> Add a pair
              </button>
            )}
          </div>
        )}

        {tab === 'video' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input value={video.title} onChange={(e) => setV('title', e.target.value)} style={inputStyle} placeholder="Deploying an Anchor program, start to finish" />
            </div>
            <div>
              <label style={labelStyle}>Duration (minutes, ≤ 10 rated)</label>
              <input value={video.durationMinutes} onChange={(e) => setV('durationMinutes', e.target.value)} style={inputStyle} type="number" min="0" step="0.5" placeholder="6" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Video URL (Hugging Face or Arweave — by reference only)</label>
              <input value={video.sourceUrl} onChange={(e) => setV('sourceUrl', e.target.value)} style={inputStyle} placeholder="https://huggingface.co/datasets/…/deploy.mp4" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Caption / transcript summary</label>
              <textarea value={video.caption} onChange={(e) => setV('caption', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="What happens in the video, step by step…" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Context (optional)</label>
              <input value={video.context} onChange={(e) => setV('context', e.target.value)} style={inputStyle} placeholder="Screen recording of my own terminal, devnet" />
            </div>
          </div>
        )}

        {(tab === 'dataset' || tab === 'robot') && (
          <div>
            <p className="text-secondary" style={{ fontSize: '13px', lineHeight: 1.6, marginTop: 0 }}>
              By reference + manifest only — no raw bulk upload. Validators sample the hosted
              data and check it against these declarations; declared-but-unverifiable rows,
              episodes, and steps earn nothing.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input value={manifest.title} onChange={(e) => setM('title', e.target.value)} style={inputStyle} placeholder={tab === 'robot' ? 'Terminal-task episodes, sim v2' : 'Solana instruction corpus v3'} />
              </div>
              <div>
                <label style={labelStyle}>License</label>
                <input value={manifest.license} onChange={(e) => setM('license', e.target.value)} style={inputStyle} placeholder="Apache-2.0" />
              </div>
              <div>
                <label style={labelStyle}>Host</label>
                <select value={manifest.hostType} onChange={(e) => setM('hostType', e.target.value)} style={inputStyle}>
                  <option value="huggingface">Hugging Face</option>
                  <option value="arweave">Arweave</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Format</label>
                <select value={manifest.format} onChange={(e) => setM('format', e.target.value)} style={inputStyle}>
                  {tab === 'dataset'
                    ? <><option value="jsonl">JSONL</option><option value="parquet">Parquet</option><option value="csv">CSV</option></>
                    : <><option value="lerobot">LeRobot (Parquet + media refs)</option><option value="hdf5">HDF5 episodes</option><option value="jsonl">JSONL episode traces</option></>}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Host reference (HF repo id or ar:// transaction)</label>
                <input value={manifest.hostRef} onChange={(e) => setM('hostRef', e.target.value)} style={inputStyle} placeholder="your-name/your-dataset" />
              </div>
              <div>
                <label style={labelStyle}>Host revision (commit / tx id, optional)</label>
                <input value={manifest.hostRevision} onChange={(e) => setM('hostRevision', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Content hash (sha256 of the canonical file list)</label>
                <input value={manifest.contentHash} onChange={(e) => setM('contentHash', e.target.value)} style={inputStyle} placeholder="sha256:…" />
              </div>
              {tab === 'dataset' ? (
                <>
                  <div>
                    <label style={labelStyle}>Declared rows</label>
                    <input value={manifest.declaredRows} onChange={(e) => setM('declaredRows', e.target.value)} style={inputStyle} type="number" min="0" placeholder="120000" />
                  </div>
                  <div>
                    <label style={labelStyle}>Declared bytes</label>
                    <input value={manifest.declaredBytes} onChange={(e) => setM('declaredBytes', e.target.value)} style={inputStyle} type="number" min="0" placeholder="84000000" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={labelStyle}>Declared episodes</label>
                    <input value={manifest.declaredEpisodes} onChange={(e) => setM('declaredEpisodes', e.target.value)} style={inputStyle} type="number" min="0" placeholder="240" />
                  </div>
                  <div>
                    <label style={labelStyle}>Declared bytes</label>
                    <input value={manifest.declaredBytes} onChange={(e) => setM('declaredBytes', e.target.value)} style={inputStyle} type="number" min="0" placeholder="84000000" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Task description (required for robot data)</label>
                    <textarea value={manifest.taskDescription} onChange={(e) => setM('taskDescription', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="The robot / agent performs … in (sim name + version, or the real platform). Episodes carry success labels." />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Episode schema (optional, JSON or plain text)</label>
                    <textarea value={manifest.schema} onChange={(e) => setM('schema', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder='{"observation": ["joint_states", "camera_ref"], "action": "deltas", "timestamp": "ms"}' />
                  </div>
                </>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Representative sample (up to 20 rows / captions, one per line — verified against the hosted data)</label>
                <textarea value={manifest.captionSample} onChange={(e) => setM('captionSample', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || (tab === 'text' && !content.trim())}>
            {busy ? (jobStatus ? `Rating job: ${jobStatus}…` : 'Jev is rating…') : 'Rate with Jev'}
          </button>
          {getToken() && (
            <>
              <button type="button" className="btn btn-secondary" onClick={uploadByReference}>
                <FiUploadCloud size={14} style={{ marginRight: '6px' }} /> Save reference to my uploads
              </button>
              <button type="button" className="btn" onClick={() => uploadFileRef.current?.click()}>
                Upload a file
              </button>
              <input ref={uploadFileRef} type="file" onChange={uploadFile} style={{ display: 'none' }} />
            </>
          )}
          {jobStatus && !result && (
            <span className="text-secondary" style={{ fontSize: '12px' }}>
              Async job {jobStatus} — validators run first, then Jev judges. Keep this tab open.
            </span>
          )}
        </div>
        {error && <p style={{ color: '#FF6B6B', fontSize: '13px', marginTop: '8px' }}>Error: {error}</p>}
        {uploadNote && <p className="text-secondary" style={{ fontSize: '13px', marginTop: '8px' }}>{uploadNote}</p>}
        <RatingResult result={result} />
      </div>

      {getToken() && uploads && uploads.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div className="text-secondary" style={{ fontSize: '13px', marginBottom: '8px' }}>Your uploads</div>
          {uploads.map((u, i) => (
            <div key={u.id || i} style={{ display: 'flex', gap: '10px', fontSize: '13px', padding: '5px 0', flexWrap: 'wrap' }}>
              <strong>{u.name || u.filename || 'upload'}</strong>
              <span className="text-secondary">{u.kind || ''}</span>
              {u.sourceUrl && <span className="text-secondary" style={{ overflowWrap: 'anywhere' }}>{u.sourceUrl}</span>}
              {u.createdAt && <span className="text-secondary">{new Date(u.createdAt).toLocaleDateString()}</span>}
            </div>
          ))}
        </div>
      )}
      {!getToken() && (
        <p className="text-secondary" style={{ fontSize: '12px', marginTop: '16px' }}>
          Tip: use the <strong>Log in</strong> button in the header (wallet signature, no password)
          to save uploads to your account and list them here.
        </p>
      )}
    </div>
  );
}
