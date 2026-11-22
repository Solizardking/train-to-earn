import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiAnchor,
  FiCheckCircle,
  FiClipboard,
  FiCpu,
  FiExternalLink,
  FiGlobe,
  FiHash,
  FiLayers,
  FiLock,
  FiRefreshCw,
  FiSearch,
  FiShield,
} from 'react-icons/fi';
import { apiGet } from '../utils/api';

// Omnichain AI Model Registry — public browser for
// GET /api/registry/models (falls back to the existing
// GET /api/models/list while the registry endpoints roll out).
//
// The registry is public and not gated: anyone can register a model
// from any chain, and anyone can read it. Solana is the anchor chain —
// hash commitments, timestamps, and rewards — not a home-chain
// requirement. See docs/omnichain-registry.md in the public repo:
// https://github.com/Solizardking/train-to-earn

const SPEC_URL = 'https://github.com/Solizardking/train-to-earn/blob/main/docs/omnichain-registry.md';
const REPO_URL = 'https://github.com/Solizardking/train-to-earn';

const TIERS = [
  { tier: 0, name: 'Unverified', color: '#B0B0B0', blurb: 'Manifest submitted and schema-valid. Nothing checked yet.' },
  { tier: 1, name: 'Hash-verified', color: '#7DD3FC', blurb: 'Publisher proof verifies on the home chain and a Solana anchor (memo tx or PDA) matches the manifest hash.' },
  { tier: 2, name: 'Jev-rated', color: '#14F195', blurb: 'The model card / sample data was rated through the Jev pipeline; the entry shows the real score. A heuristic-fallback rating is labelled as such, never as a Jev verdict.' },
  { tier: 3, name: 'Reproduced', color: '#FFD700', blurb: 'An independent party re-downloaded the weights, recomputed the hash to a match, and ran a recorded smoke inference.' },
];

function tierOf(model) {
  const raw = model.tier ?? model.verificationTier ?? model.registryTier;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 3 ? n : 0;
}

function chainOf(model) {
  return (
    model.chain_id ||
    model.chainId ||
    model.home_chain?.chain_id ||
    model.homeChain?.chain_id ||
    model.home_chain_id ||
    '—'
  );
}

function publisherOf(model) {
  return (
    model.publisher ||
    model.publisher_address ||
    model.publisherAddress ||
    model.home_chain?.publisher_address ||
    model.creator ||
    model.authority ||
    '—'
  );
}

function hashOf(model) {
  return model.manifest_sha256 || model.manifestSha256 || model.manifestHash || model.artifactSha256 || model.cid || '';
}

function normalize(model, index) {
  return {
    key: hashOf(model) || model.id || model.name || `model-${index}`,
    name: model.name || model.modelName || 'Unnamed model',
    version: model.version || '',
    description: model.description || '',
    publisher: publisherOf(model),
    chainId: chainOf(model),
    tier: tierOf(model),
    hash: hashOf(model),
    modality: model.modality || model.model?.modality || model.modelType || '',
    license: model.license || model.model?.license || '',
    repoUrl: model.repo_url || model.model?.repo_url || model.huggingFaceRepo || model.artifactUri || '',
    score: model.score ?? model.jevScore ?? model.rating?.score ?? null,
    anchorTx: model.anchor_tx || model.anchorTx || model.anchor?.tx_signature || '',
  };
}

function short(value, head = 8, tail = 6) {
  if (!value || value === '—') return '—';
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function TierBadge({ tier }) {
  const meta = TIERS[tier] || TIERS[0];
  return (
    <span
      title={meta.blurb}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 700,
        color: meta.color,
        border: `1px solid ${meta.color}55`,
        background: `${meta.color}14`,
        whiteSpace: 'nowrap',
      }}
    >
      {tier >= 1 ? <FiCheckCircle size={12} /> : <FiLock size={12} />}
      Tier {tier} · {meta.name}
    </span>
  );
}

function CopyHash({ hash }) {
  const [copied, setCopied] = useState(false);
  if (!hash) return <span className="text-secondary">—</span>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable (permissions) — the full hash is in the title
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={hash}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(153,69,255,0.25)',
        borderRadius: '8px',
        color: '#D8C4FF',
        cursor: 'pointer',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '12px',
        padding: '5px 9px',
      }}
    >
      <FiHash size={12} />
      {short(hash, 10, 8)}
      {copied ? <FiCheckCircle size={12} color="#14F195" /> : <FiClipboard size={12} />}
    </button>
  );
}

export default function RegistryPage() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [chainFilter, setChainFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet('/api/registry/models');
      const list = Array.isArray(data) ? data : (data.models || data.entries || []);
      setModels(list.map(normalize));
      setSource('registry');
    } catch (registryErr) {
      try {
        const data = await apiGet('/api/models/list');
        const list = Array.isArray(data) ? data : (data.models || []);
        setModels(list.map(normalize));
        setSource('models-list');
      } catch (fallbackErr) {
        setError(fallbackErr.message);
        setModels([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const chains = useMemo(
    () => [...new Set(models.map((m) => m.chainId).filter((c) => c && c !== '—'))].sort(),
    [models],
  );

  const filtered = useMemo(() => models.filter((m) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q
      || m.name.toLowerCase().includes(q)
      || m.publisher.toLowerCase().includes(q)
      || m.hash.toLowerCase().includes(q)
      || m.chainId.toLowerCase().includes(q);
    const matchesTier = tierFilter === 'all' || m.tier === Number(tierFilter);
    const matchesChain = chainFilter === 'all' || m.chainId === chainFilter;
    return matchesSearch && matchesTier && matchesChain;
  }), [models, search, tierFilter, chainFilter]);

  const tierCounts = useMemo(() => {
    const counts = [0, 0, 0, 0];
    models.forEach((m) => { counts[m.tier] += 1; });
    return counts;
  }, [models]);

  return (
    <section className="registry-shell">
      <div className="registry-hero">
        <div className="registry-hero-copy">
          <span className="eyebrow"><FiGlobe style={{ marginRight: '6px' }} /> Omnichain AI Model Registry</span>
          <h2>Models from any chain. Anchored on Solana.</h2>
          <p>
            A public registry where AI models from <strong>any</strong> blockchain ecosystem
            register a signed manifest and get a hash commitment anchored natively on
            Solana. Chain of origin is metadata, not a barrier — Solana is the{' '}
            <em>anchor</em> chain (commitments, timestamps, rewards), not a home-chain
            requirement. There is no $CLAWD-holder gate on registering, reading, rating,
            or anchoring; $CLAWD appears only as the rewards asset.
          </p>
          <p>
            Hash first, claims second: the registry stores manifests and hashes, and the
            verification tier on every entry says exactly how much has been checked — an
            entry is never presented as more verified than it is.
          </p>
          <div className="registry-actions">
            <a className="btn btn-primary" href={SPEC_URL} target="_blank" rel="noreferrer">
              <FiExternalLink size={14} /> Read the registry spec
            </a>
            <a className="btn btn-secondary" href={REPO_URL} target="_blank" rel="noreferrer">
              <FiLayers size={14} /> github.com/Solizardking/train-to-earn
            </a>
            <button type="button" className="btn btn-secondary" onClick={load}>
              <FiRefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
        <div className="registry-proof-panel">
          <div className="proof-header"><FiAnchor /> How anchoring works</div>
          <div className="proof-step"><span>1</span> Publisher signs <code>clawd-registry:v1:&lt;manifest_sha256&gt;</code> with their home-chain key (EIP-191, Ed25519, or BIP-322).</div>
          <div className="proof-step"><span>2</span> A Solana memo transaction carries <code>clawd-registry:v1:register:&lt;sha256&gt;:&lt;chain_id&gt;:&lt;publisher&gt;</code> — the tx signature + slot are the anchor record.</div>
          <div className="proof-step"><span>3</span> Anyone can recompute the manifest SHA-256 and confirm the memo, timestamp, and anchoring address on Solana, independently of this site.</div>
          <div className="proof-step"><span>4</span> Tiers only move up on recorded evidence: proof + anchor → Tier 1, a real Jev rating → Tier 2, an independent reproduction → Tier 3.</div>
        </div>
      </div>

      <div className="registry-stats">
        <div className="registry-stat">
          <span>Registered models</span>
          <strong>{loading ? '…' : models.length}</strong>
          <small>{source === 'models-list' ? 'via /api/models/list (registry endpoint rolling out)' : 'live from /api/registry/models'}</small>
        </div>
        {TIERS.map((meta) => (
          <div className="registry-stat" key={meta.tier}>
            <span>Tier {meta.tier} · {meta.name}</span>
            <strong>{loading ? '…' : tierCounts[meta.tier]}</strong>
            <small>{meta.blurb.split('.')[0]}.</small>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {TIERS.map((meta) => (
          <span key={meta.tier} className={`registry-pill ${tierCounts[meta.tier] > 0 ? 'is-active' : 'is-muted'}`} title={meta.blurb}>
            <FiShield size={12} /> Tier {meta.tier} — {meta.name}
          </span>
        ))}
        <span className="registry-pill is-muted">
          <FiAnchor size={12} /> Anchor chain: Solana (solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp)
        </span>
      </div>

      <div className="registry-toolbar">
        <label className="search-box">
          <FiSearch />
          <input
            type="text"
            placeholder="Search by model, publisher, chain, or manifest hash"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select value={chainFilter} onChange={(e) => setChainFilter(e.target.value)}>
          <option value="all">All home chains</option>
          {chains.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
          <option value="all">All tiers</option>
          {TIERS.map((meta) => <option key={meta.tier} value={meta.tier}>Tier {meta.tier} · {meta.name}</option>)}
        </select>
      </div>

      {loading && (
        <div className="registry-fetch-banner"><span className="spinner-sm" /> Loading the registry…</div>
      )}
      {!loading && error && (
        <div className="registry-fetch-banner registry-fetch-error">
          Registry fetch failed: {error}
          <button type="button" className="btn-link" onClick={load}>Retry</button>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '36px' }}>
          <FiCpu size={28} color="#9945FF" />
          <p className="text-secondary" style={{ marginTop: '10px', lineHeight: 1.6 }}>
            {models.length === 0
              ? 'No models are registered yet. Register the first one from the CLI (traintoearn models register) or with scripts/register-model.mjs in the public repo — registration is open to publishers on any chain.'
              : 'No entries match those filters.'}
          </p>
        </div>
      )}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {filtered.map((model) => (
          <article className="card" key={model.key} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: '19px', overflowWrap: 'anywhere' }}>
                  {model.name}
                  {model.version && <span className="text-secondary" style={{ fontSize: '13px', fontWeight: 500 }}> v{model.version}</span>}
                </h3>
                <div className="text-secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
                  Publisher {short(model.publisher, 10, 8)} · Home chain {model.chainId}
                  {model.modality && <> · {model.modality}</>}
                  {model.license && <> · {model.license}</>}
                </div>
              </div>
              <TierBadge tier={model.tier} />
            </div>
            {model.description && (
              <p className="text-secondary" style={{ margin: 0, fontSize: '13px', lineHeight: 1.6 }}>{model.description}</p>
            )}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="text-secondary" style={{ fontSize: '12px' }}>Manifest</span>
              <CopyHash hash={model.hash} />
              {typeof model.score === 'number' && (
                <span style={{ fontSize: '13px' }}>Jev score <strong className="gradient-text">{model.score}</strong></span>
              )}
              {model.anchorTx && (
                <a href={`https://solscan.io/tx/${model.anchorTx}`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                  <FiAnchor size={12} /> Solana anchor
                </a>
              )}
              {model.repoUrl && (
                <a href={model.repoUrl.startsWith('http') ? model.repoUrl : `https://${model.repoUrl}`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', display: 'inline-flex', gap: '4px', alignItems: 'center', marginLeft: 'auto' }}>
                  Weights / repo <FiExternalLink size={12} />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>

      <p className="text-secondary" style={{ fontSize: '12px', lineHeight: 1.6, textAlign: 'center' }}>
        Tiers describe verification performed — never that a model is safe, accurate, or fit for a
        purpose. The registry is not a model host and not a marketplace: weights stay at the
        publisher&apos;s repo, and anchors on Solana are immutable by design.
      </p>
    </section>
  );
}
