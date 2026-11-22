import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  FiCpu,
  FiDatabase,
  FiFileText,
  FiGrid,
  FiBookOpen,
  FiExternalLink,
  FiCheckCircle,
  FiClock,
  FiBarChart2,
  FiLayers,
  FiCode,
  FiGitBranch,
  FiZap,
  FiServer,
  FiTag,
  FiChevronDown,
  FiChevronRight,
  FiSearch,
  FiDownload,
} from 'react-icons/fi';
import {
  FiTerminal,
} from 'react-icons/fi';
import { apiGet } from '../utils/api';

const TABS = [
  { id: 'overview', label: 'Overview', Icon: FiBarChart2 },
  { id: 'models', label: 'Models', Icon: FiCpu },
  { id: 'datasets', label: 'Datasets', Icon: FiDatabase },
  { id: 'configs', label: 'Training Configs', Icon: FiCode },
  { id: 'docs', label: 'Docs', Icon: FiBookOpen },
  { id: 'data', label: 'Data Files', Icon: FiFileText },
  { id: 'nvidia', label: 'NVIDIA', Icon: FiZap },
  { id: 'dao', label: 'DAO', Icon: FiGitBranch },
];

function StatusBadge({ status }) {
  const colors = {
    live: { bg: 'rgba(20, 241, 149, 0.15)', color: '#14F195' },
    training: { bg: 'rgba(255, 215, 0, 0.15)', color: '#FFD700' },
    external: { bg: 'rgba(153, 69, 255, 0.15)', color: '#9945FF' },
    default: { bg: 'rgba(176, 176, 176, 0.15)', color: '#B0B0B0' },
  };
  const c = colors[status] || colors.default;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
      background: c.bg, color: c.color,
    }}>
      {status === 'live' && <FiCheckCircle size={10} />}
      {status === 'training' && <FiClock size={10} />}
      {status}
    </span>
  );
}

function Section({ title, Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '16px 20px', borderBottom: open ? '1px solid rgba(153, 69, 255, 0.15)' : 'none' }}
      >
        {Icon && <Icon size={20} color="#9945FF" />}
        <h3 style={{ margin: 0, fontSize: '16px', flex: 1 }}>{title}</h3>
        {open ? <FiChevronDown size={18} color="#B0B0B0" /> : <FiChevronRight size={18} color="#B0B0B0" />}
      </div>
      {open && <div style={{ padding: '16px 20px' }}>{children}</div>}
    </div>
  );
}

function TrainingPage() {
  const { publicKey, connected } = useWallet();
  const [activeTab, setActiveTab] = useState('overview');
  const [trainingData, setTrainingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTrainingData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet('/api/training/data');
      setTrainingData(data);
    } catch (err) {
      console.error('Failed to fetch training data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrainingData();
  }, [fetchTrainingData]);

  const models = trainingData?.models || {};
  const datasets = trainingData?.datasets || {};
  const nvidia = trainingData?.nvidia || [];
  const files = trainingData?.files || { configs: [], docs: [], data: [] };
  const dao = trainingData?.files?.dao || { configs: [], docs: [] };
  const summary = trainingData?.summary || {};

  const filteredConfigs = files.configs.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDocs = files.docs.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDataFiles = files.data.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header Stats */}
      <div className="grid grid-3 mb-4">
        <div className="card">
          <div className="flex-between mb-2">
            <span className="text-secondary">Models</span>
            <FiCpu color="#9945FF" />
          </div>
          <h2 className="gradient-text">{summary.totalModels || 0}</h2>
          <small className="text-secondary">Trained & deployed</small>
        </div>
        <div className="card">
          <div className="flex-between mb-2">
            <span className="text-secondary">Datasets</span>
            <FiDatabase color="#14F195" />
          </div>
          <h2 className="text-success">{summary.totalDatasets || 0}</h2>
          <small className="text-secondary">Training datasets</small>
        </div>
        <div className="card">
          <div className="flex-between mb-2">
            <span className="text-secondary">Config Files</span>
            <FiCode color="#FFD700" />
          </div>
          <h2>{summary.totalConfigs || 0}</h2>
          <small className="text-secondary">Training configurations</small>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex', gap: '8px', flexWrap: 'wrap',
        marginBottom: '32px', borderBottom: '1px solid rgba(153, 69, 255, 0.2)',
      }}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setActiveTab(id); setSearchQuery(''); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', background: 'transparent', border: 'none',
              borderBottom: `2px solid ${activeTab === id ? '#9945FF' : 'transparent'}`,
              color: activeTab === id ? '#9945FF' : '#B0B0B0',
              fontSize: '14px', fontWeight: 500, cursor: 'pointer',
              marginBottom: '-1px',
            }}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex-center" style={{ flexDirection: 'column', gap: '16px', padding: '60px 0' }}>
          <div className="spinner"></div>
          <p style={{ color: '#B0B0B0' }}>Loading training data...</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="text-error">Error: {error}</p>
          <button type="button" className="btn btn-primary mt-2" onClick={fetchTrainingData}>Retry</button>
        </div>
      )}

      {!loading && !error && trainingData && (
        <>
          {/* SEARCH BAR (shown in data tabs) */}
          {['configs', 'docs', 'data', 'dao'].includes(activeTab) && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FiSearch size={20} color="#B0B0B0" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1, background: 'transparent', border: 'none',
                    outline: 'none', color: '#fff', fontSize: '14px',
                  }}
                />
              </div>
            </div>
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div>
              <Section title="AI Model Training Pipeline" Icon={FiGitBranch}>
                <div style={{ lineHeight: 1.8, color: '#C0C0C0', fontSize: '14px' }}>
                  <p>This training directory contains the complete AI model training pipeline for the Solana Clawd agent ecosystem.</p>
                  <div className="grid grid-2" style={{ marginTop: '20px', gap: '16px' }}>
                    <div className="card" style={{ padding: '16px', background: 'rgba(153, 69, 255, 0.05)' }}>
                      <h4 style={{ color: '#9945FF', marginTop: 0 }}>Data Pipeline</h4>
                      <ul style={{ paddingLeft: '20px', margin: 0 }}>
                        <li>{files.data.length} data files across multiple datasets</li>
                        <li>{summary.totalDatasets} curated Hugging Face datasets</li>
                        <li>JSONL, CSV, and processed Parquet formats</li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: '16px', background: 'rgba(20, 241, 149, 0.05)' }}>
                      <h4 style={{ color: '#14F195', marginTop: 0 }}>Training Infrastructure</h4>
                      <ul style={{ paddingLeft: '20px', margin: 0 }}>
                        <li>{summary.totalConfigs} LoRA/CPT training configs</li>
                        <li>NVIDIA A100, H200 GPU support</li>
                        <li>Mac MPS, local Ollama inference</li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: '16px', background: 'rgba(255, 215, 0, 0.05)' }}>
                      <h4 style={{ color: '#FFD700', marginTop: 0 }}>Model Registry</h4>
                      <ul style={{ paddingLeft: '20px', margin: 0 }}>
                        <li>{summary.totalModels} published models on Hugging Face</li>
                        <li>On-chain PDA registration via Anchor</li>
                        <li>ZK attestations (Light Protocol)</li>
                      </ul>
                    </div>
                    <div className="card" style={{ padding: '16px', background: 'rgba(153, 69, 255, 0.05)' }}>
                      <h4 style={{ color: '#14F195', marginTop: 0 }}>NVIDIA Integration</h4>
                      <ul style={{ paddingLeft: '20px', margin: 0 }}>
                        <li>Nemotron NIM API reasoning</li>
                        <li>Trading Factory signal agents</li>
                        <li>Transaction Foundation pipeline</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Quick Commands" Icon={FiTerminal}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="card" style={{ padding: '12px 16px' }}>
                    <code style={{ color: '#14F195', fontSize: '13px' }}>
                      ./dao/register_model.sh --hf-model "YOUR_ORG/your-model" --eval-accuracy 0.60
                    </code>
                  </div>
                  <div className="card" style={{ padding: '12px 16px' }}>
                    <code style={{ color: '#14F195', fontSize: '13px' }}>
                      python3 scripts/train_lora.py --config configs/core_ai_lora_config.yaml --num-epochs 1
                    </code>
                  </div>
                  <div className="card" style={{ padding: '12px 16px' }}>
                    <code style={{ color: '#14F195', fontSize: '13px' }}>
                      hf upload solanaclawd/solana-clawd-core-ai-instruct data/core_ai_processed . --repo-type dataset
                    </code>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {/* MODELS TAB */}
          {activeTab === 'models' && (
            <div>
              {Object.entries(models).map(([key, model]) => (
                <div className="card" key={key} style={{ marginBottom: '16px' }}>
                  <div className="flex-between" style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FiCpu size={20} color="#9945FF" />
                      <h3 style={{ margin: 0, fontSize: '16px' }}>{model.name}</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <StatusBadge status={model.status} />
                      {model.hubUrl && (
                        <a href={model.hubUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#14F195' }}>
                          <FiExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                  <p className="text-secondary" style={{ fontSize: '13px', lineHeight: 1.6 }}>{model.description}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                    <span className="card" style={{ padding: '4px 10px', fontSize: '12px', background: 'rgba(153, 69, 255, 0.1)' }}>{model.baseModel}</span>
                    <span className="card" style={{ padding: '4px 10px', fontSize: '12px', background: 'rgba(20, 241, 149, 0.1)' }}>{model.type}</span>
                    {model.tags?.map((tag) => (
                      <span key={tag} style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: 'rgba(176, 176, 176, 0.15)', color: '#B0B0B0' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  {model.metrics && (
                    <div className="grid grid-3" style={{ marginTop: '12px', gap: '8px' }}>
                      <div><small className="text-secondary">Train Loss</small><div style={{ fontWeight: 600 }}>{model.metrics.trainLoss}</div></div>
                      <div><small className="text-secondary">Token Accuracy</small><div style={{ fontWeight: 600 }}>{model.metrics.tokenAccuracy}</div></div>
                      <div><small className="text-secondary">Tokens</small><div style={{ fontWeight: 600 }}>{model.metrics.tokens}</div></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* DATASETS TAB */}
          {activeTab === 'datasets' && (
            <div>
              <div className="grid grid-2">
                {Object.entries(datasets).map(([key, ds]) => (
                  <div className="card" key={key}>
                    <div className="flex-between" style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FiDatabase size={18} color="#14F195" />
                        <h3 style={{ margin: 0, fontSize: '15px' }}>{ds.name}</h3>
                      </div>
                      {ds.hubUrl && (
                        <a href={ds.hubUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#14F195' }}>
                          <FiExternalLink size={16} />
                        </a>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: 'rgba(255, 215, 0, 0.15)', color: '#FFD700' }}>
                        {ds.type}
                      </span>
                      <span style={{ fontSize: '12px', color: '#B0B0B0' }}>{ds.examples?.toLocaleString()} examples</span>
                    </div>
                    <small className="text-secondary">License: {ds.license}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONFIGS TAB */}
          {activeTab === 'configs' && (
            <div>
              {filteredConfigs.length === 0 && <div className="card" style={{ textAlign: 'center', padding: '40px' }}><p className="text-secondary">No training configs found</p></div>}
              {filteredConfigs.map((config, i) => (
                <div className="card" key={i} style={{ marginBottom: '12px' }}>
                  <div className="flex-between" style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FiCode size={16} color="#FFD700" />
                      <h4 style={{ margin: 0, fontSize: '14px' }}>{config.name}</h4>
                    </div>
                    <small className="text-secondary">{(config.size / 1024).toFixed(1)} KB</small>
                  </div>
                  <pre style={{
                    background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px',
                    fontSize: '11px', lineHeight: 1.5, overflowX: 'auto', maxHeight: '200px',
                    color: '#A0A0A0', margin: 0,
                  }}>{config.preview}</pre>
                </div>
              ))}
            </div>
          )}

          {/* DOCS TAB */}
          {activeTab === 'docs' && (
            <div>
              {filteredDocs.length === 0 && <div className="card" style={{ textAlign: 'center', padding: '40px' }}><p className="text-secondary">No docs found</p></div>}
              {filteredDocs.map((doc, i) => (
                <div className="card" key={i} style={{ marginBottom: '12px' }}>
                  <div className="flex-between" style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FiBookOpen size={16} color="#9945FF" />
                      <h4 style={{ margin: 0, fontSize: '14px' }}>{doc.title}</h4>
                    </div>
                    <small className="text-secondary">{doc.lineCount} lines</small>
                  </div>
                  <p className="text-secondary" style={{ fontSize: '12px', marginBottom: '8px' }}>{doc.name}</p>
                  <pre style={{
                    background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px',
                    fontSize: '11px', lineHeight: 1.5, overflowX: 'auto', maxHeight: '150px',
                    color: '#A0A0A0', margin: 0, whiteSpace: 'pre-wrap',
                  }}>{doc.preview}</pre>
                </div>
              ))}
            </div>
          )}

          {/* DATA FILES TAB */}
          {activeTab === 'data' && (
            <div>
              {filteredDataFiles.length === 0 && <div className="card" style={{ textAlign: 'center', padding: '40px' }}><p className="text-secondary">No data files found</p></div>}
              <div className="grid grid-2">
                {filteredDataFiles.map((f, i) => (
                  <div className="card" key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FiFileText size={16} color="#14F195" />
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px' }}>{f.name}</h4>
                        <small className="text-secondary">
                          {(f.size / 1024 / 1024).toFixed(2)} MB · {f.ext}
                        </small>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NVIDIA TAB */}
          {activeTab === 'nvidia' && (
            <div>
              <Section title="NVIDIA AI Integration" Icon={FiZap}>
                <p className="text-secondary" style={{ margin: 0, fontSize: '13px', lineHeight: 1.6 }}>
                  The Solana Clawd training pipeline integrates with NVIDIA's AI infrastructure through NIM APIs,
                  Nemotron models, and specialized trading factory blueprints. Endpoint routing priority:
                  NVIDIA_API_KEY → HF Inference API → CLAWD_INFERENCE_URL → Ollama localhost.
                </p>
              </Section>
              {nvidia.map((item, i) => (
                <div className="card" key={i} style={{ marginBottom: '12px' }}>
                  <div className="flex-between" style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FiServer size={18} color="#9945FF" />
                      <h3 style={{ margin: 0, fontSize: '15px' }}>{item.name}</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <StatusBadge status={item.status} />
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#14F195' }}>
                          <FiExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                  <p className="text-secondary" style={{ fontSize: '13px' }}>{item.description}</p>
                  <small className="text-secondary">{item.type}</small>
                </div>
              ))}
            </div>
          )}

          {/* DAO TAB */}
          {activeTab === 'dao' && (
            <div>
              <Section title="Clawd DAO Architecture" Icon={FiGitBranch}>
                <p className="text-secondary" style={{ margin: 0, fontSize: '13px', lineHeight: 1.6 }}>
                  The Clawd DAO manages model registry, data submission attribution, validator staking,
                  and SAS attestations through Solana programs. User capital lives in Percolator insurance pools
                  (genesis programs do attribution only). Governance requires 72h voting + 1-week Squads timelock.
                </p>
              </Section>
              {dao.docs?.map((doc, i) => (
                <div className="card" key={i} style={{ marginBottom: '12px' }}>
                  <div className="flex-between" style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FiGitBranch size={16} color="#FFD700" />
                      <h4 style={{ margin: 0, fontSize: '14px' }}>{doc.title}</h4>
                    </div>
                    <small className="text-secondary">{doc.lineCount} lines</small>
                  </div>
                  <p className="text-secondary" style={{ fontSize: '12px' }}>{doc.name}</p>
                  {doc.preview && (
                    <pre style={{
                      background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px',
                      fontSize: '11px', lineHeight: 1.5, overflowX: 'auto', maxHeight: '150px',
                      color: '#A0A0A0', margin: 0, whiteSpace: 'pre-wrap',
                    }}>{doc.preview}</pre>
                  )}
                </div>
              ))}
              {dao.configs?.map((config, i) => (
                <div className="card" key={`dao-cfg-${i}`} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FiCode size={16} color="#FFD700" />
                    <h4 style={{ margin: 0, fontSize: '14px' }}>{config.name}</h4>
                    <small className="text-secondary">{(config.size / 1024).toFixed(1)} KB</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default TrainingPage;