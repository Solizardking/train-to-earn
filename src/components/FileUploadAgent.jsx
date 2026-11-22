import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiCpu,
  FiFile,
  FiGitBranch,
  FiStar,
  FiUploadCloud,
  FiZap,
} from 'react-icons/fi';

const CLAWD_MINT = import.meta.env.VITE_CLAWD_MINT || '8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const PIPELINE_STAGES = [
  { id: 'index', label: 'Indexing file', icon: FiFile },
  { id: 'analyze', label: 'CLAWD agent analyzing', icon: FiCpu },
  { id: 'search', label: 'Searching Hugging Face', icon: FiGitBranch },
  { id: 'rate', label: 'Rating contribution', icon: FiStar },
  { id: 'reward', label: 'Calculating CLAWD reward', icon: FiZap },
];

function formatBytes(bytes) {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

function PipelineStage({ stage, status }) {
  const Icon = stage.icon;
  const isActive = status === 'active';
  const isDone = status === 'done';
  const isPending = status === 'pending';
  return (
    <div style={{ ...stageStyle, ...(isActive ? stageActiveStyle : isDone ? stageDoneStyle : {}) }}>
      <span style={{ ...stageIconStyle, ...(isActive ? stageIconActiveStyle : {}) }}>
        {isDone ? <FiCheckCircle /> : <Icon />}
      </span>
      <span style={stageLabelStyle}>{stage.label}</span>
      {isActive && <span style={spinnerDotStyle} />}
      {isPending && <span style={pendingDotStyle} />}
      {isDone && <span style={doneDotStyle} />}
    </div>
  );
}

export default function FileUploadAgent() {
  const { publicKey } = useWallet();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pipelineStage, setPipelineStage] = useState(null);
  const [stageIndex, setStageIndex] = useState(-1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [particles, setParticles] = useState([]);
  const fileInputRef = useRef(null);
  const particleIntervalRef = useRef(null);

  useEffect(() => {
    if (stageIndex >= 0 && stageIndex < PIPELINE_STAGES.length) {
      particleIntervalRef.current = setInterval(() => {
        setParticles((prev) => {
          const next = [...prev, { id: Date.now() + Math.random(), x: Math.random() * 100, delay: Math.random() * 0.5 }];
          return next.length > 12 ? next.slice(-12) : next;
        });
      }, 200);
      return () => clearInterval(particleIntervalRef.current);
    }
    clearInterval(particleIntervalRef.current);
    setParticles([]);
  }, [stageIndex]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) selectFile(dropped);
  }, []);

  function selectFile(f) {
    setFile(f);
    setResult(null);
    setError(null);
    setStageIndex(-1);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }

  async function runPipeline() {
    if (!file) return;
    setResult(null);
    setError(null);

    const form = new FormData();
    form.append('file', file);
    if (publicKey) form.append('walletAddress', publicKey.toString());
    form.append('clawdMint', CLAWD_MINT);

    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      setStageIndex(i);
      setPipelineStage(PIPELINE_STAGES[i].id);
      if (i < PIPELINE_STAGES.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    try {
      const resp = await fetch(`${API_BASE}/api/upload/analyze`, {
        method: 'POST',
        body: form,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Analysis failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setStageIndex(PIPELINE_STAGES.length);
      setPipelineStage(null);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStageIndex(-1);
    setPipelineStage(null);
    setParticles([]);
  }

  const isProcessing = stageIndex >= 0 && stageIndex < PIPELINE_STAGES.length;

  return (
    <div style={shellStyle}>
      <div style={headerStyle}>
        <span className="eyebrow">CLAWD Agent Pipeline</span>
        <h2 style={titleStyle}>Drop any file — CLAWD indexes and rates it.</h2>
        <p style={subtitleStyle}>
          Files and images are analyzed by the CLAWD agent using xAI Grok, cross-referenced
          against Hugging Face, and scored for contribution quality. The score here is an
          estimate — $CLAWD rewards are earned through Jev-rated submissions on the
          Portfolio tab.
        </p>
      </div>

      {!file && (
        <div
          style={{ ...dropZoneStyle, ...(isDragging ? dropZoneActiveStyle : {}) }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          aria-label="Drop a file or click to upload"
        >
          <div style={dropIconWrapStyle}>
            <FiUploadCloud size={48} style={{ color: isDragging ? '#14F195' : '#9945FF' }} />
            {isDragging && <div style={dropRingStyle} />}
          </div>
          <p style={dropLabelStyle}>
            {isDragging ? 'Release to analyze' : 'Drop any file or image here'}
          </p>
          <p style={dropSubStyle}>Supports images, code, datasets, PDFs, and more</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files[0] && selectFile(e.target.files[0])}
          />
        </div>
      )}

      {file && !isProcessing && !result && (
        <div style={fileCardStyle}>
          {preview && (
            <div style={previewWrapStyle}>
              <img src={preview} alt="Preview" style={previewImgStyle} />
            </div>
          )}
          <div style={fileInfoStyle}>
            <FiFile size={20} style={{ color: '#9945FF' }} />
            <div>
              <strong style={{ color: '#fff', fontSize: 15 }}>{file.name}</strong>
              <div style={{ color: '#999', fontSize: 13, marginTop: 2 }}>
                {file.type || 'binary'} · {formatBytes(file.size)}
              </div>
            </div>
          </div>
          <div style={fileActionsStyle}>
            <button type="button" className="btn btn-primary" onClick={runPipeline}>
              <FiZap />
              Run CLAWD Pipeline
            </button>
            <button type="button" className="btn btn-secondary" onClick={reset}>
              Choose different file
            </button>
          </div>
        </div>
      )}

      {isProcessing && (
        <div style={pipelineWrapStyle}>
          <div style={particleFieldStyle} aria-hidden>
            {particles.map((p) => (
              <div
                key={p.id}
                style={{
                  ...particleStyle,
                  left: `${p.x}%`,
                  animationDelay: `${p.delay}s`,
                }}
              />
            ))}
          </div>
          <div style={pipelineLabelStyle}>
            <FiCpu size={18} style={{ color: '#14F195' }} />
            Processing {file.name}
          </div>
          <div style={stagesListStyle}>
            {PIPELINE_STAGES.map((stage, i) => (
              <PipelineStage
                key={stage.id}
                stage={stage}
                status={i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'pending'}
              />
            ))}
          </div>
          <div style={pulseBarStyle}>
            <div
              style={{
                ...pulseBarFillStyle,
                width: `${Math.round(((stageIndex + 1) / PIPELINE_STAGES.length) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div style={errorCardStyle}>
          <FiAlertCircle style={{ color: '#FF6B6B' }} />
          <span>{error}</span>
          <button type="button" className="btn-link" onClick={reset}>Reset</button>
        </div>
      )}

      {result && (
        <div style={resultShellStyle}>
          <div style={resultHeaderStyle}>
            <FiCheckCircle size={22} style={{ color: '#14F195' }} />
            <h3 style={{ margin: 0, color: '#fff' }}>Analysis complete</h3>
            <button type="button" className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={reset}>
              Upload another
            </button>
          </div>

          <div style={resultGridStyle}>
            <div style={resultCardStyle}>
              <span style={resultEyebrowStyle}>File summary</span>
              <p style={resultBodyStyle}>{result.summary || '—'}</p>
            </div>

            <div style={resultCardStyle}>
              <span style={resultEyebrowStyle}>xAI Grok analysis</span>
              <p style={resultBodyStyle}>{result.analysis || '—'}</p>
            </div>

            {result.hfModels && result.hfModels.length > 0 && (
              <div style={resultCardStyle}>
                <span style={resultEyebrowStyle}>
                  <FiGitBranch style={{ verticalAlign: 'middle' }} /> Related Hugging Face models
                </span>
                <ul style={hfListStyle}>
                  {result.hfModels.slice(0, 5).map((m) => (
                    <li key={m.id || m.modelId} style={hfItemStyle}>
                      <a
                        href={`https://huggingface.co/${m.id || m.modelId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#9945FF' }}
                      >
                        {m.id || m.modelId}
                      </a>
                      <span style={{ color: '#888', fontSize: 12 }}>
                        {m.downloads ? ` · ${m.downloads.toLocaleString()} downloads` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ ...resultCardStyle, background: 'rgba(153,69,255,0.08)', border: '1px solid rgba(153,69,255,0.25)' }}>
              <span style={resultEyebrowStyle}>Contribution score</span>
              <div style={scoreRowStyle}>
                <div style={scoreMeterStyle}>
                  <div style={{ ...scoreFillStyle, width: `${result.score || 0}%` }} />
                </div>
                <strong style={{ color: '#14F195', fontSize: 24 }}>{result.score ?? '—'}<span style={{ fontSize: 14, color: '#888' }}>/100</span></strong>
              </div>
              {result.scoreRationale && (
                <p style={{ ...resultBodyStyle, marginTop: 8 }}>{result.scoreRationale}</p>
              )}
            </div>

            <div style={{ ...resultCardStyle, background: 'rgba(20,241,149,0.05)', border: '1px solid rgba(20,241,149,0.2)' }}>
              <span style={resultEyebrowStyle}>
                <FiZap style={{ verticalAlign: 'middle' }} /> CLAWD reward
              </span>
              <div style={rewardRowStyle}>
                <span style={rewardAmountStyle}>{result.clawdReward ?? '0'}</span>
                <span style={rewardTokenStyle}>CLAWD</span>
              </div>
              {result.rewardBreakdown && (
                <p style={{ ...resultBodyStyle, marginTop: 6 }}>{result.rewardBreakdown}</p>
              )}
              {result.tracked && result.jevRating && (
                <p style={{ color: '#14F195', fontSize: 13, marginTop: 8 }}>
                  ✓ Tracked as Jev rating #{result.jevRating.id} — visible in the live
                  submissions feed on the home page. Claim from the Portfolio tab.
                </p>
              )}
              {!publicKey && (
                <p style={{ color: '#FF6B6B', fontSize: 13, marginTop: 8 }}>
                  Connect a wallet before uploading so your file is Jev-rated,
                  tracked, and credited.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const shellStyle = {
  padding: '0 0 40px',
};

const headerStyle = {
  marginBottom: 32,
};

const titleStyle = {
  fontSize: 28,
  fontWeight: 700,
  color: '#fff',
  margin: '8px 0 12px',
};

const subtitleStyle = {
  color: '#999',
  fontSize: 15,
  maxWidth: 640,
  lineHeight: 1.6,
};

const dropZoneStyle = {
  border: '2px dashed rgba(153,69,255,0.4)',
  borderRadius: 16,
  padding: '60px 40px',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  background: 'rgba(153,69,255,0.03)',
  position: 'relative',
  overflow: 'hidden',
};

const dropZoneActiveStyle = {
  border: '2px dashed #14F195',
  background: 'rgba(20,241,149,0.06)',
  boxShadow: '0 0 40px rgba(20,241,149,0.15)',
};

const dropIconWrapStyle = {
  position: 'relative',
  display: 'inline-block',
  marginBottom: 16,
};

const dropRingStyle = {
  position: 'absolute',
  inset: -12,
  borderRadius: '50%',
  border: '2px solid #14F195',
  animation: 'ping 1s ease-out infinite',
};

const dropLabelStyle = {
  fontSize: 18,
  fontWeight: 600,
  color: '#fff',
  margin: '0 0 6px',
};

const dropSubStyle = {
  color: '#888',
  fontSize: 13,
  margin: 0,
};

const fileCardStyle = {
  background: 'rgba(153,69,255,0.06)',
  border: '1px solid rgba(153,69,255,0.2)',
  borderRadius: 12,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
};

const previewWrapStyle = {
  borderRadius: 8,
  overflow: 'hidden',
  maxHeight: 240,
  display: 'flex',
  justifyContent: 'center',
};

const previewImgStyle = {
  maxHeight: 240,
  maxWidth: '100%',
  objectFit: 'contain',
  borderRadius: 8,
};

const fileInfoStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const fileActionsStyle = {
  display: 'flex',
  gap: 12,
};

const pipelineWrapStyle = {
  background: 'rgba(10,10,18,0.8)',
  border: '1px solid rgba(153,69,255,0.3)',
  borderRadius: 16,
  padding: 32,
  position: 'relative',
  overflow: 'hidden',
};

const particleFieldStyle = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
};

const particleStyle = {
  position: 'absolute',
  bottom: 0,
  width: 3,
  height: 3,
  borderRadius: '50%',
  background: '#9945FF',
  animation: 'riseUp 1.2s ease-out forwards',
};

const pipelineLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: '#fff',
  fontWeight: 600,
  fontSize: 15,
  marginBottom: 24,
};

const stagesListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginBottom: 24,
};

const pulseBarStyle = {
  height: 4,
  background: 'rgba(153,69,255,0.15)',
  borderRadius: 4,
  overflow: 'hidden',
};

const pulseBarFillStyle = {
  height: '100%',
  background: 'linear-gradient(90deg, #9945FF, #14F195)',
  borderRadius: 4,
  transition: 'width 0.5s ease',
  boxShadow: '0 0 8px rgba(20,241,149,0.5)',
};

const stageStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.02)',
  color: '#666',
  fontSize: 14,
  transition: 'all 0.2s',
};

const stageActiveStyle = {
  background: 'rgba(153,69,255,0.1)',
  color: '#fff',
  border: '1px solid rgba(153,69,255,0.3)',
  boxShadow: '0 0 20px rgba(153,69,255,0.1)',
};

const stageDoneStyle = {
  color: '#14F195',
  background: 'rgba(20,241,149,0.04)',
};

const stageIconStyle = {
  display: 'flex',
  alignItems: 'center',
};

const stageIconActiveStyle = {
  color: '#9945FF',
  animation: 'pulse 1s ease-in-out infinite',
};

const stageLabelStyle = {
  flex: 1,
};

const spinnerDotStyle = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#9945FF',
  boxShadow: '0 0 8px #9945FF',
  animation: 'pulse 0.8s ease-in-out infinite',
};

const pendingDotStyle = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: '#333',
};

const doneDotStyle = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#14F195',
  boxShadow: '0 0 6px #14F195',
};

const errorCardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: 'rgba(255,107,107,0.08)',
  border: '1px solid rgba(255,107,107,0.25)',
  borderRadius: 10,
  padding: '14px 18px',
  color: '#FF6B6B',
  fontSize: 14,
};

const resultShellStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const resultHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const resultGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: 16,
};

const resultCardStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12,
  padding: 20,
};

const resultEyebrowStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#9945FF',
  marginBottom: 10,
};

const resultBodyStyle = {
  color: '#ccc',
  fontSize: 14,
  lineHeight: 1.6,
  margin: 0,
};

const hfListStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const hfItemStyle = {
  fontSize: 14,
};

const scoreRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginTop: 8,
};

const scoreMeterStyle = {
  flex: 1,
  height: 8,
  background: 'rgba(255,255,255,0.08)',
  borderRadius: 4,
  overflow: 'hidden',
};

const scoreFillStyle = {
  height: '100%',
  background: 'linear-gradient(90deg, #9945FF, #14F195)',
  borderRadius: 4,
  transition: 'width 1s ease',
};

const rewardRowStyle = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  marginTop: 10,
};

const rewardAmountStyle = {
  fontSize: 40,
  fontWeight: 800,
  background: 'linear-gradient(135deg, #9945FF, #14F195)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

const rewardTokenStyle = {
  fontSize: 18,
  fontWeight: 600,
  color: '#14F195',
};
