import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  FiActivity,
  FiCheckCircle,
  FiCpu,
  FiDatabase,
  FiExternalLink,
  FiGitBranch,
  FiGlobe,
  FiLayers,
  FiLock,
  FiSearch,
  FiServer,
  FiShield,
  FiTerminal,
  FiZap,
} from 'react-icons/fi';
import { MODEL_REGISTRATION_SCHEMA, MODEL_REGISTRY_ID } from '../utils/modelRegistry';
import { apiGet, apiPost } from '../utils/api';
import {
  HAUHAU_GATEWAY_BASE_URL,
  HAUHAU_MODEL_ID,
  chatHauhau,
  probeHauhauEndpoint,
} from '../utils/inference';

// Registry stats are computed from the models actually loaded from the
// registry + Arweave at render time. (The previous hardcoded stats —
// "2,418 registered models", "91% verified", "18.7M inferences" — were
// invented and have been removed.)

// Verified first-party models & datasets published on Hugging Face by solanaclawd and ordlibrary.
// Sourced from the on-chain registry seed (registry_seed.py FIRST_PARTY_ARTIFACTS).
const FIRST_PARTY_CATALOG = [
  {
    rank: 0,
    id: 'clawd-trading-wallet',
    kind: 'model',
    name: 'Clawd Trading Wallet',
    hfId: 'ordlibrary/clawd-trading-wallet',
    hubUrl: 'https://huggingface.co/ordlibrary/clawd-trading-wallet',
    base: 'Qwen2.5-1.5B',
    examples: 986,
    summary: 'Wallet-bearing Solana trading agent. Speaks natural language — "buy 100 SOL", "short ETH 5x", "create a wallet". Encrypted BIP39 key derivation inside the LLM. Jupiter swaps + Phoenix perps.',
    tags: ['solana', 'trading', 'wallet', 'agent', 'natural-language'],
  },
  {
    rank: 1,
    id: 'hauhau-qwen36-onchain',
    kind: 'model',
    name: 'Hauhau Qwen3.6 Onchain GGUF',
    hfId: 'ordlibrary/hauhau-qwen36-onchain',
    hubUrl: 'https://huggingface.co/ordlibrary/hauhau-qwen36-onchain',
    base: 'Qwen3.6-35B-A3B (IQ2_M)',
    examples: 0,
    summary: 'Qwen3.6-35B-A3B IQ2_M GGUF with The Onchain Constitution etched as the default system prompt. ~11 GB, 262K native context.',
    tags: ['solana', 'onchain', 'constitution', 'gguf', 'qwen'],
  },
  {
    rank: 2,
    id: 'hauhau-qwen36-uncensored',
    kind: 'model',
    name: 'Hauhau Qwen3.6 Uncensored GGUF',
    hfId: 'ordlibrary/hauhau-qwen36-uncensored',
    hubUrl: 'https://huggingface.co/ordlibrary/hauhau-qwen36-uncensored',
    base: 'Qwen3.6-35B-A3B (IQ2_M)',
    examples: 0,
    summary: 'Qwen3.6-35B-A3B IQ2_M GGUF uncensored fine-tune — same weights as the Onchain build, no constitution system prompt. ~11.7 GB, 35B total / ~3B active MoE, 262K native context. Runs via scripts/hauhau_qwen36_llama_cpp.py.',
    tags: ['uncensored', 'gguf', 'qwen', 'llama.cpp'],
  },
  {
    rank: 3,
    id: 'core-ai-clawd-1.5b',
    kind: 'model',
    name: 'Clawd Core AI 1.5B GGUF',
    hfId: 'ordlibrary/core-ai-clawd-1.5b',
    hubUrl: 'https://huggingface.co/ordlibrary/core-ai-clawd-1.5b',
    base: 'Qwen2.5-1.5B',
    examples: 35173,
    summary: 'Qwen2.5-1.5B GGUF Q4_K_M fine-tuned on 35K Solana/DeFi instructions. Eval: 94.4%. Tags: latest (986 MB) + finetuned (4.9 GB Hermes-3-8B).',
    tags: ['solana', 'defi', 'gguf', 'qwen2.5', 'clawd'],
  },
  {
    rank: 4,
    id: 'core-ai-lora',
    kind: 'model',
    name: 'Solana Clawd Core AI 1.5B LoRA',
    hfId: 'solanaclawd/solana-clawd-core-ai-1.5b-lora',
    hubUrl: 'https://huggingface.co/solanaclawd/solana-clawd-core-ai-1.5b-lora',
    base: 'Qwen2.5-1.5B',
    examples: 35173,
    summary: 'Qwen2.5-1.5B Solana/DeFi adapter trained from the Core AI instruction corpus.',
    tags: ['solana', 'defi', 'lora', 'qwen2.5'],
  },
  {
    rank: 5,
    id: 'trading-factory-lora',
    kind: 'model',
    name: 'Solana NVIDIA Trading Factory 8B LoRA',
    hfId: 'solanaclawd/solana-nvidia-trading-factory-8b-lora',
    hubUrl: 'https://huggingface.co/solanaclawd/solana-nvidia-trading-factory-8b-lora',
    base: 'Hermes-3-Llama-3.1-8B',
    examples: 195,
    summary: 'Hermes-3-Llama-3.1-8B LoRA for the paper-mode NVIDIA Solana trading factory.',
    tags: ['solana', 'trading', 'nvidia', 'lora'],
  },
  {
    rank: 6,
    id: 'clawd-fable',
    kind: 'model',
    name: 'Clawd Fable GGUF',
    hfId: 'solanaclawd/clawd-fable',
    hubUrl: 'https://huggingface.co/solanaclawd/clawd-fable',
    base: 'AliesTaha/fable-traces',
    examples: 5000,
    summary: 'Fable-traces fine-tune for agentic reasoning and multi-turn tool-use conversations.',
    tags: ['solana', 'agent', 'fable', 'gguf'],
  },
  {
    rank: 7,
    id: 'tx-foundation-cpt',
    kind: 'dataset',
    name: 'Solana Transaction Foundation CPT',
    hfId: 'solanaclawd/solana-tx-foundation-cpt',
    hubUrl: 'https://huggingface.co/datasets/solanaclawd/solana-tx-foundation-cpt',
    examples: 19542,
    summary: 'Foundation continual-pretraining corpus for Solana transaction text.',
    tags: ['solana', 'transactions', 'cpt', 'foundation'],
  },
  {
    rank: 8,
    id: 'realtime-research-dataset',
    kind: 'dataset',
    name: 'Solana Clawd Realtime Research Instruct',
    hfId: 'solanaclawd/solana-clawd-realtime-research-instruct',
    hubUrl: 'https://huggingface.co/datasets/solanaclawd/solana-clawd-realtime-research-instruct',
    examples: 29058,
    summary: 'Realtime research instruction data from PDFs, notebooks, parquet QA rows, JSONL, and references.',
    tags: ['solana', 'research', 'pdf', 'realtime-ingestion'],
  },
  {
    rank: 9,
    id: 'core-ai-dataset',
    kind: 'dataset',
    name: 'Solana Clawd Core AI Instruct',
    hfId: 'solanaclawd/solana-clawd-core-ai-instruct',
    hubUrl: 'https://huggingface.co/datasets/solanaclawd/solana-clawd-core-ai-instruct',
    examples: 35173,
    summary: 'Core Solana AI instruction dataset from local source trees and the existing Clawd corpus.',
    tags: ['solana', 'clawd', 'core-ai', 'constitutional-ai'],
  },
  {
    rank: 10,
    id: 'nvidia-trading-factory-dataset',
    kind: 'dataset',
    name: 'Solana Clawd NVIDIA Trading Factory Instruct',
    hfId: 'solanaclawd/solana-clawd-nvidia-trading-factory-instruct',
    hubUrl: 'https://huggingface.co/datasets/solanaclawd/solana-clawd-nvidia-trading-factory-instruct',
    examples: 195,
    summary: 'Specialized SFT data for a Solana-native NVIDIA algorithmic trading factory with 175 train, 9 eval, and 11 test examples.',
    tags: ['solana', 'trading', 'nvidia', 'risk-management'],
  },
  {
    rank: 11,
    id: 'fable-traces-dataset',
    kind: 'dataset',
    name: 'Fable 5 Traces',
    hfId: 'Glint-Research/Fable-5-traces',
    hubUrl: 'https://huggingface.co/datasets/Glint-Research/Fable-5-traces',
    examples: 15000,
    summary: 'Multi-turn agent interaction traces used for fable-style reasoning fine-tuning.',
    tags: ['solana', 'fable', 'agent', 'traces'],
  },
];

// Hau Hau Qwen3.6 — facts from the Hugging Face model card and
// configs/hauhau_qwen36_llama_cpp.yaml. Runtime guide: docs/hauhau_qwen36.md.
const HAUHAU_FACTS = [
  { label: 'Upstream', value: 'HauhauCS/Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive' },
  { label: 'Mirror', value: 'ordlibrary/hauhau-qwen36-uncensored' },
  { label: 'Weights', value: 'GGUF IQ2_M · ~11.7 GB' },
  { label: 'Architecture', value: 'MoE · 35B total / ~3B active per token' },
  { label: 'Context', value: '262K native · 8192 recommended minimum' },
  { label: 'License', value: 'MIT' },
  { label: 'Runtime', value: 'llama.cpp (llama-cpp-python / llama-server)' },
  { label: 'Gateway id', value: 'clawd/hauhau-uncensored' },
];

const HAUHAU_LOCAL_RUN = `python3 -m pip install "llama-cpp-python>=0.3.32"
python3 scripts/hauhau_qwen36_llama_cpp.py --no-image --constitution-mode minimal`;

const HAUHAU_SERVE_RUN = `llama-server \\
  -m Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive-IQ2_M.gguf \\
  --alias clawd/hauhau-uncensored \\
  --host 0.0.0.0 --port 8080 -ngl 99 -c 8192 --jinja \\
  --api-key "$API_KEY"`;

function HauhauSection() {
  const [probe, setProbe] = useState({ state: 'checking', detail: '' });
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [chatError, setChatError] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const runProbe = useCallback(async () => {
    setProbe({ state: 'checking', detail: '' });
    const result = await probeHauhauEndpoint();
    setProbe({ state: result.live ? 'live' : 'offline', detail: result.detail });
  }, []);

  useEffect(() => {
    runProbe();
  }, [runProbe]);

  const handleAsk = async (event) => {
    event.preventDefault();
    if (!prompt.trim()) return;
    setIsAsking(true);
    setChatError('');
    setAnswer('');
    try {
      setAnswer(await chatHauhau(prompt.trim()));
    } catch (error) {
      setChatError(error.message);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="hauhau-section">
      <div className="firstparty-head">
        <div>
          <span className="eyebrow">Hau Hau · GGUF Runtime</span>
          <h3>Hauhau Qwen3.6 Uncensored</h3>
          <p>
            The uncensored fine-tune of Qwen3.6-35B-A3B, published as a single
            IQ2_M GGUF. Same weights as the Onchain Constitution build, with no
            system prompt etched in. Described plainly: it is the uncensored
            variant, and it runs locally with llama.cpp — no account, no API key.
          </p>
        </div>
        <a
          className="btn btn-secondary"
          href="https://huggingface.co/ordlibrary/hauhau-qwen36-uncensored"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FiExternalLink />
          View on Hugging Face
        </a>
      </div>

      <dl className="hauhau-facts">
        {HAUHAU_FACTS.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="hauhau-launch-grid">
        <div className="hauhau-launch-card">
          <h4><FiTerminal /> Run it locally</h4>
          <p>
            The repo runner (<code>configs/hauhau_qwen36_llama_cpp.yaml</code>)
            downloads the GGUF from Hugging Face and answers one prompt, with
            The Onchain Constitution injected as the system message
            (<code>--constitution-mode full|minimal</code>, or
            <code> --no-constitution</code> for the raw uncensored model):
          </p>
          <pre>{HAUHAU_LOCAL_RUN}</pre>
          <p>
            Ollama equivalent: <code>ollama run hf.co/ordlibrary/hauhau-qwen36-uncensored</code>
          </p>
        </div>
        <div className="hauhau-launch-card">
          <h4><FiServer /> Serve it over HTTP</h4>
          <p>
            Under llama-server the model takes the gateway alias
            <code> clawd/hauhau-uncensored</code> and exposes an
            OpenAI-compatible API on port 8080:
          </p>
          <pre>{HAUHAU_SERVE_RUN}</pre>
          <p>
            Hosting paths: <strong>Phala GPU TEE</strong> (H100 80 GB,
            confidential VM with TDX + NVIDIA attestation; the larger Q6_K_P
            quant replaces IQ2_M there) or a <strong>RunPod RTX 4090</strong>
            pilot serving IQ2_M. Full notes: <code>docs/hauhau_qwen36.md</code>.
          </p>
        </div>
      </div>

      <div className="hauhau-endpoint">
        <div className="hauhau-endpoint-head">
          <span className="eyebrow">Hosted endpoint</span>
          <span className={`hauhau-status is-${probe.state}`}>
            {probe.state === 'checking' && 'Probing gateway…'}
            {probe.state === 'live' && 'Live on the gateway'}
            {probe.state === 'offline' && 'Endpoint not live yet'}
          </span>
        </div>
        <p>
          Gateway: <code>{HAUHAU_GATEWAY_BASE_URL}</code> · Model:{' '}
          <code>{HAUHAU_MODEL_ID}</code>
          {probe.detail && <> · {probe.detail}</>}
        </p>
        {probe.state === 'offline' && (
          <p className="hauhau-offline-note">
            The GPU host is still being stood up, so the gateway does not list
            this model yet. Nothing here is simulated — run the model locally
            with the commands above, and this panel lights up on its own once
            the gateway lists <code>{HAUHAU_MODEL_ID}</code>.
            <button type="button" className="btn-link" onClick={runProbe}>Re-check</button>
          </p>
        )}
        {probe.state === 'live' && (
          <form className="hauhau-tryit" onSubmit={handleAsk}>
            <label>
              <span>Ask Hau Hau</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask the hosted model something…"
                rows={3}
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={isAsking || !prompt.trim()}>
              <FiZap />
              {isAsking ? 'Asking…' : 'Send to gateway'}
            </button>
            {chatError && <div className="workbench-error">{chatError}</div>}
            {answer && (
              <div className="output-panel">
                <span className="eyebrow">Response</span>
                <pre>{answer}</pre>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

const INTEGRATIONS = [
  {
    name: 'Solana',
    role: 'Registry authority',
    detail: 'Program-derived model accounts anchor ownership, pricing, usage rights, slashing state, and governance.',
    status: 'On-chain',
  },
  {
    name: 'Metaplex',
    role: 'Model identity',
    detail: 'Each model can mint programmable metadata for creator attribution, license terms, royalties, and collection verification.',
    status: 'Metadata',
  },
  {
    name: 'Hugging Face',
    role: 'Model lineage',
    detail: 'Repository, commit hash, safetensors digest, model card, evals, and dataset disclosures become signed registry fields.',
    status: 'Lineage',
  },
  {
    name: 'Consensus Learning',
    role: 'Training coordination',
    detail: 'Private local models exchange predictions and confidence through gossip before Solana records contribution proofs and rewards.',
    status: 'Gossip',
  },
  {
    name: 'Google',
    role: 'Evaluation + compute',
    detail: 'Vertex AI evaluations, Gemini safety reviews, and Cloud Run inference endpoints can publish signed attestations.',
    status: 'Attested',
  },
];



const typeLabels = {
  LLM_REASONING: 'LLM reasoning',
  IMAGE_CLASSIFICATION: 'Vision',
  CODE_GENERATION: 'Code generation',
  CONSENSUS_LEARNING: 'Consensus learning',
  EMBEDDINGS: 'Embeddings',
  AUDIO: 'Audio',
  MULTIMODAL: 'Multimodal',
  PIEDPIPER_PIPELINE: 'PiedPiper pipeline',
};

// The registration form starts blank. It previously shipped pre-filled
// with a fabricated model's asset, authority, and URIs — removed so nobody
// can prepare a registration for a model that does not exist.
const INITIAL_REGISTRATION_FORM = {
  asset: '',
  authority: '',
  registrationUri: '',
  name: '',
  description: '',
  image: '',
  modelType: 'CODE_GENERATION',
  architecture: '',
  parameterCount: '',
  license: 'MIT',
  artifactUri: '',
  artifactSha256: '',
  modelCardUri: '',
  huggingFaceRepo: '',
  huggingFaceCommit: '',
  googleAttestationUri: '',
  googleAttestor: '',
  price: '',
  royaltyBps: '',
};

function normalizeModel(raw) {
  return {
    id: raw.id || raw.model_id || raw.txId || String(Date.now() + Math.random()),
    name: raw.name || raw.modelName || 'Unnamed model',
    modelType: raw.modelType || raw.model_type || 'LLM_REASONING',
    version: raw.version || '1.0.0',
    creator: raw.creator || raw.authority || '—',
    registryPda: raw.modelIdentityPda || raw.registryPda || '—',
    mint: raw.asset || raw.mint || '—',
    huggingFaceRepo: raw.huggingFaceRepo || raw.hugging_face_repo || '—',
    hfCommit: raw.hfCommit || raw.hugging_face_commit || '—',
    googleAttestation: raw.googleAttestationUri || raw.googleAttestation || '—',
    storageUri: raw.artifactUri || raw.storageUri || raw.model_registration_uri || '—',
    cid: raw.cid || raw.artifact_sha256 || '—',
    description: raw.description || '—',
    size: raw.size || 0,
    accuracy: raw.accuracy || raw.evalScore || 0,
    downloads: raw.downloads || raw.total_downloads || 0,
    inferenceCount: raw.inferenceCount || raw.total_inferences || 0,
    zkProofVerified: Boolean(raw.zkProofVerified),
    metaplexVerified: Boolean(raw.metaplexVerified || raw.attestations?.metaplex?.valid),
    hfVerified: Boolean(raw.hfVerified || raw.attestations?.huggingFace?.valid),
    googleVerified: Boolean(raw.googleVerified || raw.attestations?.google?.valid),
    license: raw.license || 'Unknown',
    royaltyBps: raw.royaltyBps || 0,
    risk: raw.risk || 'Unknown',
    lastUpdated: raw.lastUpdated || (raw.updated_at ? new Date(raw.updated_at).getTime() : Date.now()),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
  };
}

function formatSize(bytes) {
  if (bytes >= 1000000000) return `${(bytes / 1000000000).toFixed(1)} GB`;
  if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(0)} MB`;
  return `${(bytes / 1000).toFixed(0)} KB`;
}

function formatDate(timestamp) {
  const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function VerificationPill({ active, children }) {
  return (
    <span className={`registry-pill ${active ? 'is-active' : 'is-muted'}`}>
      {active ? <FiCheckCircle /> : <FiLock />}
      {children}
    </span>
  );
}

export default function AIModels() {
  const { publicKey } = useWallet();
  const [liveModels, setLiveModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('downloads');
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [registrationForm, setRegistrationForm] = useState(INITIAL_REGISTRATION_FORM);
  const [registrationResult, setRegistrationResult] = useState(null);
  const [attestationResult, setAttestationResult] = useState(null);
  const [registrationError, setRegistrationError] = useState('');
  const [isPreparingRegistration, setIsPreparingRegistration] = useState(false);

  const fetchLiveModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const [registryRes, arweaveRes] = await Promise.allSettled([
        apiGet('/api/models/list'),
        apiGet('/api/arweave/models'),
      ]);

      const registryModels = registryRes.status === 'fulfilled'
        ? (registryRes.value.models || [])
        : [];
      const arweaveModels = arweaveRes.status === 'fulfilled'
        ? (arweaveRes.value.models || [])
        : [];

      const seen = new Set();
      const merged = [...registryModels, ...arweaveModels]
        .map((m) => normalizeModel(m))
        .filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });

      // Real data only: whatever the registry + Arweave actually return,
      // including nothing. There is no mock fallback.
      setLiveModels(merged);
      setSelectedModelId(merged[0]?.id ?? null);
    } catch (err) {
      setModelsError(err.message);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveModels();
  }, [fetchLiveModels]);

  const filteredModels = useMemo(() => {
    return liveModels
      .filter((model) => {
        const query = searchTerm.toLowerCase();
        const matchesFilter = filter === 'all' || model.modelType === filter;
        const matchesSearch = !query ||
          model.name.toLowerCase().includes(query) ||
          model.description.toLowerCase().includes(query) ||
          model.huggingFaceRepo.toLowerCase().includes(query) ||
          model.tags.some((tag) => tag.toLowerCase().includes(query));

        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'accuracy') return b.accuracy - a.accuracy;
        if (sortBy === 'recent') return b.lastUpdated - a.lastUpdated;
        if (sortBy === 'inference') return b.inferenceCount - a.inferenceCount;
        return b.downloads - a.downloads;
      });
  }, [filter, liveModels, searchTerm, sortBy]);

  const selectedModel = filteredModels.find((model) => model.id === selectedModelId) || filteredModels[0];

  const updateRegistrationField = (field, value) => {
    setRegistrationForm((current) => ({ ...current, [field]: value }));
  };

  const buildRegistrationPayload = () => ({
    ...registrationForm,
    price: Number(registrationForm.price),
    royaltyBps: Number(registrationForm.royaltyBps),
  });

  const handleValidateProviders = async () => {
    setRegistrationError('');

    try {
      const payload = buildRegistrationPayload();
      const identity = await apiGet(`/api/models/identity/${payload.asset}`);
      const response = await apiPost('/api/models/provider-attestations', {
        asset: payload.asset,
        modelIdentityPda: identity.pda,
        huggingFaceRepo: payload.huggingFaceRepo,
        googleAttestationUri: payload.googleAttestationUri,
        googleAttestor: payload.googleAttestor,
      });
      setAttestationResult(response.attestations);
    } catch (error) {
      setRegistrationError(error.message);
    }
  };

  const handlePrepareRegistration = async (event) => {
    event.preventDefault();
    setIsPreparingRegistration(true);
    setRegistrationError('');

    try {
      const response = await apiPost('/api/models/register-intent', buildRegistrationPayload());
      setRegistrationResult(response);
      setAttestationResult(response.identity ? null : attestationResult);
    } catch (error) {
      setRegistrationResult(null);
      setRegistrationError(error.message);
    } finally {
      setIsPreparingRegistration(false);
    }
  };

  return (
    <section className="registry-shell">
      {modelsLoading && (
        <div className="registry-fetch-banner">
          <span className="spinner-sm" />
          Loading live model registry…
        </div>
      )}
      {!modelsLoading && modelsError && (
        <div className="registry-fetch-banner registry-fetch-error">
          Registry fetch failed: {modelsError} — showing cached data.
          <button type="button" className="btn-link" onClick={fetchLiveModels}>Retry</button>
        </div>
      )}
      <div className="registry-hero">
        <div className="registry-hero-copy">
          <span className="eyebrow">Solana AI Model Registry</span>
          <h2>Register AI models the same way Metaplex registers agents.</h2>
          <p>
            Train2Earn adapts the agent identity pattern for model identity: mint an
            MPL Core asset, bind a discoverable model PDA, attach lifecycle checks,
            and point to a permanent model registration document.
          </p>
          <div className="registry-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => document.querySelector('.registration-workbench')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <FiLayers />
              Register model
            </button>
          </div>
        </div>
        <div className="registry-proof-panel">
          <div className="proof-header">
            <FiShield />
            Model identity chain
          </div>
          <div className="proof-step">
            <span>1</span>
            Mint MPL Core model asset
          </div>
          <div className="proof-step">
            <span>2</span>
            Upload model registration JSON to Arweave
          </div>
          <div className="proof-step">
            <span>3</span>
            Bind ModelIdentity PDA to the asset
          </div>
          <div className="proof-step">
            <span>4</span>
            Read model data from PDA, plugin, and URI
          </div>
        </div>
      </div>

      <div className="registry-stats">
        <div className="registry-stat">
          <span>Registered models</span>
          <strong>{modelsLoading ? '…' : liveModels.length}</strong>
          <small>live from the registry + Arweave</small>
        </div>
        <div className="registry-stat">
          <span>Model types</span>
          <strong>{modelsLoading ? '…' : new Set(liveModels.map((m) => m.modelType)).size}</strong>
          <small>across loaded models</small>
        </div>
      </div>

      <div className="integration-grid">
        {INTEGRATIONS.map((integration) => (
          <article className="integration-card" key={integration.name}>
            <div>
              <span className="integration-status">{integration.status}</span>
              <h3>{integration.name}</h3>
              <strong>{integration.role}</strong>
            </div>
            <p>{integration.detail}</p>
          </article>
        ))}
      </div>

      <div className="firstparty-section">
        <div className="firstparty-head">
          <div>
            <span className="eyebrow">Verified First-Party</span>
            <h3>Official Solana Clawd models &amp; datasets</h3>
            <p>Published on Hugging Face by <code>solanaclawd</code> and anchored to the on-chain registry.</p>
          </div>
          <a
            className="btn btn-secondary"
            href="https://huggingface.co/solanaclawd"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FiExternalLink />
            View on Hugging Face
          </a>
        </div>
        <div className="firstparty-grid">
          {FIRST_PARTY_CATALOG.map((item) => (
            <a
              className={`firstparty-card is-${item.kind}`}
              key={item.id}
              href={item.hubUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="firstparty-card-top">
                <span className={`fp-kind fp-${item.kind}`}>
                  {item.kind === 'model' ? <FiCpu /> : <FiDatabase />}
                  {item.kind === 'model' ? 'Model' : 'Dataset'}
                </span>
                <span className="fp-verified" title="Published by the Train2Earn team on Hugging Face">
                  <FiCheckCircle /> First-party
                </span>
              </div>
              <h4>{item.name}</h4>
              <p>{item.summary}</p>
              <div className="firstparty-meta">
                {item.base && <span><FiGitBranch /> {item.base}</span>}
                <span><FiLayers /> {item.examples.toLocaleString()} examples</span>
              </div>
              <div className="firstparty-tags">
                {item.tags.slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}
              </div>
              <span className="firstparty-link"><FiExternalLink /> {item.hfId}</span>
            </a>
          ))}
        </div>
      </div>

      <HauhauSection />

      <div className="registry-toolbar">
        <label className="search-box">
          <FiSearch />
          <input
            type="text"
            placeholder="Search by model, repo, tag, or use case"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All model types</option>
          <option value="LLM_REASONING">LLM reasoning</option>
          <option value="CONSENSUS_LEARNING">Consensus learning</option>
          <option value="CODE_GENERATION">Code generation</option>
          <option value="IMAGE_CLASSIFICATION">Vision</option>
          <option value="PIEDPIPER_PIPELINE">PiedPiper pipeline</option>
        </select>
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="downloads">Most used</option>
          <option value="inference">Inference volume</option>
          <option value="accuracy">Highest eval score</option>
          <option value="recent">Recently updated</option>
        </select>
      </div>

      <div className="registry-layout">
        <div className="model-list">
          {!modelsLoading && filteredModels.length === 0 && (
            <p className="text-secondary" style={{ padding: '16px', fontSize: '14px', lineHeight: 1.6 }}>
              No models are registered yet. When a creator registers a model through
              the workbench below, it appears here with its real registry data.
            </p>
          )}
          {filteredModels.map((model) => (
            <button
              className={`model-row ${selectedModel?.id === model.id ? 'is-selected' : ''}`}
              key={model.id}
              type="button"
              onClick={() => setSelectedModelId(model.id)}
            >
              <span className="model-row-icon"><FiCpu /></span>
              <span>
                <strong>{model.name}</strong>
                <small>{typeLabels[model.modelType]} · {model.huggingFaceRepo}</small>
              </span>
              <b>{model.accuracy}%</b>
            </button>
          ))}
        </div>

        {selectedModel && (
          <article className="model-detail">
            <div className="model-detail-header">
              <div>
                <span className="eyebrow">{typeLabels[selectedModel.modelType]}</span>
                <h3>{selectedModel.name}</h3>
                <p>{selectedModel.description}</p>
              </div>
              <div className={`risk-badge risk-${selectedModel.risk.toLowerCase()}`}>
                {selectedModel.risk} risk
              </div>
            </div>

            <div className="model-metrics">
              <div><span>Eval score</span><strong>{selectedModel.accuracy}%</strong></div>
              <div><span>Artifact size</span><strong>{formatSize(selectedModel.size)}</strong></div>
              <div><span>Inferences</span><strong>{selectedModel.inferenceCount.toLocaleString()}</strong></div>
              <div><span>Royalty</span><strong>{selectedModel.royaltyBps / 100}%</strong></div>
            </div>

            <div className="verification-grid">
              <VerificationPill active={selectedModel.zkProofVerified}>ZK proof</VerificationPill>
              <VerificationPill active={selectedModel.metaplexVerified}>Metaplex</VerificationPill>
              <VerificationPill active={selectedModel.hfVerified}>Hugging Face</VerificationPill>
              <VerificationPill active={selectedModel.googleVerified}>Google eval</VerificationPill>
            </div>

            <dl className="registry-fields">
              <div><dt>Registry PDA</dt><dd>{selectedModel.registryPda}</dd></div>
              <div><dt>Metaplex mint</dt><dd>{selectedModel.mint}</dd></div>
              <div><dt>Registry ID</dt><dd>{MODEL_REGISTRY_ID}</dd></div>
              <div><dt>Schema</dt><dd>{MODEL_REGISTRATION_SCHEMA}</dd></div>
              <div><dt>HF repo</dt><dd>{selectedModel.huggingFaceRepo}@{selectedModel.hfCommit}</dd></div>
              <div><dt>Storage URI</dt><dd>{selectedModel.storageUri}</dd></div>
              <div><dt>License</dt><dd>{selectedModel.license}</dd></div>
              <div><dt>Updated</dt><dd>{formatDate(selectedModel.lastUpdated)}</dd></div>
            </dl>

            <div className="tag-list">
              {selectedModel.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>

          </article>
        )}
      </div>

      <div className="registration-flow">
        <div>
          <span className="eyebrow">Creator flow</span>
          <h3>Publish once, prove everywhere.</h3>
          <p>
            A creator links a Hugging Face repository, pins artifacts to Arweave or IPFS,
            mints Metaplex metadata, and writes the canonical model account on Solana.
          </p>
        </div>
        <div className="flow-grid">
          <span><FiGitBranch /> Import repo</span>
          <span><FiDatabase /> Pin weights</span>
          <span><FiGlobe /> Attach evals</span>
          <span><FiActivity /> Set pricing</span>
        </div>
      </div>

      <form className="registration-workbench" onSubmit={handlePrepareRegistration}>
        <div className="workbench-header">
          <div>
            <span className="eyebrow">Register model identity</span>
            <h3>Build the registration document and transaction plan.</h3>
            <p>
              Enter the model asset, Hugging Face lineage, Google attestation, storage
              digest, and pricing terms. The API returns the same off-chain JSON and
              on-chain account plan a wallet client will use.
            </p>
          </div>
          <div className="schema-card">
            <span>Registry</span>
            <strong>{MODEL_REGISTRY_ID}</strong>
            <small>{MODEL_REGISTRATION_SCHEMA}</small>
          </div>
        </div>

        <div className="workbench-grid">
          <label>
            <span>Model asset</span>
            <input value={registrationForm.asset} onChange={(event) => updateRegistrationField('asset', event.target.value)} />
          </label>
          <label>
            <span>Authority</span>
            <input value={registrationForm.authority} onChange={(event) => updateRegistrationField('authority', event.target.value)} />
          </label>
          <label>
            <span>Registration URI</span>
            <input value={registrationForm.registrationUri} onChange={(event) => updateRegistrationField('registrationUri', event.target.value)} />
          </label>
          <label>
            <span>Model name</span>
            <input value={registrationForm.name} onChange={(event) => updateRegistrationField('name', event.target.value)} />
          </label>
          <label className="wide-field">
            <span>Description</span>
            <textarea value={registrationForm.description} onChange={(event) => updateRegistrationField('description', event.target.value)} />
          </label>
          <label>
            <span>Image URI</span>
            <input value={registrationForm.image} onChange={(event) => updateRegistrationField('image', event.target.value)} />
          </label>
          <label>
            <span>Model type</span>
            <select value={registrationForm.modelType} onChange={(event) => updateRegistrationField('modelType', event.target.value)}>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Architecture</span>
            <input value={registrationForm.architecture} onChange={(event) => updateRegistrationField('architecture', event.target.value)} />
          </label>
          <label>
            <span>Parameters</span>
            <input value={registrationForm.parameterCount} onChange={(event) => updateRegistrationField('parameterCount', event.target.value)} />
          </label>
          <label>
            <span>License</span>
            <input value={registrationForm.license} onChange={(event) => updateRegistrationField('license', event.target.value)} />
          </label>
          <label>
            <span>Artifact URI</span>
            <input value={registrationForm.artifactUri} onChange={(event) => updateRegistrationField('artifactUri', event.target.value)} />
          </label>
          <label className="wide-field">
            <span>Artifact SHA-256</span>
            <input value={registrationForm.artifactSha256} onChange={(event) => updateRegistrationField('artifactSha256', event.target.value)} />
          </label>
          <label>
            <span>Hugging Face repo</span>
            <input value={registrationForm.huggingFaceRepo} onChange={(event) => updateRegistrationField('huggingFaceRepo', event.target.value)} />
          </label>
          <label>
            <span>HF commit</span>
            <input value={registrationForm.huggingFaceCommit} onChange={(event) => updateRegistrationField('huggingFaceCommit', event.target.value)} />
          </label>
          <label>
            <span>Google attestation URI</span>
            <input value={registrationForm.googleAttestationUri} onChange={(event) => updateRegistrationField('googleAttestationUri', event.target.value)} />
          </label>
          <label>
            <span>Google attestor</span>
            <input value={registrationForm.googleAttestor} onChange={(event) => updateRegistrationField('googleAttestor', event.target.value)} />
          </label>
          <label>
            <span>Price SOL</span>
            <input type="number" step="0.0001" value={registrationForm.price} onChange={(event) => updateRegistrationField('price', event.target.value)} />
          </label>
          <label>
            <span>Royalty bps</span>
            <input type="number" min="0" max="10000" value={registrationForm.royaltyBps} onChange={(event) => updateRegistrationField('royaltyBps', event.target.value)} />
          </label>
        </div>

        {registrationError && <div className="workbench-error">{registrationError}</div>}

        <div className="workbench-actions">
          <button className="btn btn-secondary" type="button" onClick={handleValidateProviders}>
            <FiShield />
            Validate providers
          </button>
          <button className="btn btn-primary" disabled={isPreparingRegistration} type="submit">
            <FiLayers />
            {isPreparingRegistration ? 'Preparing...' : 'Prepare register intent'}
          </button>
        </div>

        {(attestationResult || registrationResult) && (
          <div className="workbench-output">
            {attestationResult && (
              <div className="output-panel">
                <span className="eyebrow">Provider attestations</span>
                <pre>{JSON.stringify(attestationResult, null, 2)}</pre>
              </div>
            )}
            {registrationResult && (
              <>
                <div className="output-panel">
                  <span className="eyebrow">Model identity</span>
                  <pre>{JSON.stringify(registrationResult.identity, null, 2)}</pre>
                </div>
                <div className="output-panel">
                  <span className="eyebrow">Transaction plan</span>
                  <pre>{JSON.stringify(registrationResult.transactionPlan, null, 2)}</pre>
                </div>
                <div className="output-panel wide-output">
                  <span className="eyebrow">Registration document</span>
                  <pre>{JSON.stringify(registrationResult.document, null, 2)}</pre>
                </div>
              </>
            )}
          </div>
        )}
      </form>
    </section>
  );
}
