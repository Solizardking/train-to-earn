import { useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiArchive,
  FiBarChart2,
  FiCamera,
  FiCheckCircle,
  FiCopy,
  FiCpu,
  FiDatabase,
  FiDollarSign,
  FiEye,
  FiGitBranch,
  FiHash,
  FiLayers,
  FiRefreshCw,
  FiShield,
  FiTrendingUp,
} from 'react-icons/fi';
import { apiGet, apiPost } from '../utils/api';

const financeTemplates = [
  {
    id: 'wallet-risk',
    title: 'Wallet Risk Explainer',
    Icon: FiShield,
    accent: '#14F195',
    useCase: 'Explain wallet activity without asking for secrets or giving financial advice.',
    prompt:
      'System: You are a Solana wallet risk explainer. Separate observed facts from risk interpretation. Never request seed phrases or private keys.\n\nUser: Wallet summary: 12 token accounts, 3 new mints received today, 1 unknown NFT airdrop, 0.42 SOL balance. Explain the beginner risk signals.',
    output:
      'Observed facts: the wallet received several new assets and has a low SOL balance. Risk interpretation: unknown token and NFT airdrops can be spam or phishing bait. Do not visit links from unknown metadata or approve transactions you do not understand.',
    metrics: ['secret-safe', 'fact vs risk', 'beginner-readable'],
  },
  {
    id: 'defi-position',
    title: 'DeFi Position Summary',
    Icon: FiDollarSign,
    accent: '#6EE7F9',
    useCase: 'Summarize exposure, concentration, and missing context for Solana DeFi users.',
    prompt:
      'System: You summarize Solana DeFi positions for education. Do not make buy or sell recommendations.\n\nUser: Position: 62% SOL, 21% USDC, 12% liquid staking token, 5% memecoin. Recent activity: added liquidity to a SOL-USDC pool.',
    output:
      'The portfolio is concentrated in SOL and SOL-correlated exposure. USDC reduces some volatility. The liquidity pool may introduce impermanent loss and smart-contract risk. Missing data: protocol, position size, lockups, and reward terms.',
    metrics: ['concentration', 'missing data', 'no advice'],
  },
  {
    id: 'treasury',
    title: 'DAO Treasury Brief',
    Icon: FiDatabase,
    accent: '#FFD166',
    useCase: 'Turn treasury numbers into a voter-readable brief.',
    prompt:
      'System: You write concise DAO treasury briefs. Identify inflows, outflows, runway impact, and open questions.\n\nUser: Treasury update: 820 SOL, 185,000 USDC, monthly grants 22,000 USDC, monthly infra 4,000 USDC, proposed model-evaluation budget 30,000 USDC.',
    output:
      'Recurring spend is 26,000 USDC per month. The proposed model-evaluation budget is a one-time spend equal to about 1.15 months of recurring spend. Voters should ask how evaluations are selected and whether attestations become public.',
    metrics: ['runway', 'budget', 'governance'],
  },
  {
    id: 'phoenix-vulcan',
    title: 'Phoenix Paper Analyst',
    Icon: FiTrendingUp,
    accent: '#FF8A4C',
    useCase: 'Explain Phoenix/Vulcan market data with paper-safe defaults and explicit live-trade barriers.',
    prompt:
      'System: You are a Phoenix/Vulcan analyst for Solana perpetual futures. Default to read-only or paper mode. Do not place live orders. Never request wallet private keys, seed phrases, or wallet passwords.\n\nUser: Build a paper-safe analysis plan for SOL-PERP using JSON output. Include market checks, margin checks, and missing context.',
    output:
      'Plan: fetch the official Phoenix docs index, confirm current Vulcan commands, inspect exchange status, market snapshot, orderbook, funding, account health, positions, and open orders. Use paper mode for any strategy test. Missing context: wallet state, collateral, risk limits, market status, and exact command flags.',
    metrics: ['paper-safe', 'json-ready', 'live-trade barrier'],
  },
];

const visionTemplates = [
  {
    id: 'dashboard',
    title: 'Portfolio Screenshot QA',
    Icon: FiEye,
    prompt:
      'User content: [image: portfolio dashboard]\nQuestion: Which asset has the largest visible allocation, and what caveat should a beginner keep in mind?',
    answer:
      'SOL has the largest visible allocation. Caveat: this is a visual estimate unless exact chart labels or structured balances are also provided.',
  },
  {
    id: 'chart',
    title: 'Chart Vision QA',
    Icon: FiBarChart2,
    prompt:
      'User content: [image: Solana volume chart]\nQuestion: Which period has the highest visible volume, and is the value exact or approximate?',
    answer:
      'The final period has the highest visible bar. The value is approximate if axis labels or data labels are unclear.',
  },
  {
    id: 'registry',
    title: 'Registry Diagram Reader',
    Icon: FiLayers,
    prompt:
      'User content: [image: model registration flow]\nQuestion: Which step creates the permanent registration URI?',
    answer:
      'The storage step creates the permanent registration URI after the model registration JSON is uploaded to Arweave or IPFS.',
  },
];

const chartModes = {
  candles: {
    label: 'Candles',
    question: 'What is the visible direction and what can the chart not prove?',
    answer: 'The visible direction is upward into the final candles, but the chart does not prove future price movement.',
  },
  allocation: {
    label: 'Allocation',
    question: 'Which asset is largest and what risk should be mentioned?',
    answer: 'SOL is largest, so concentration risk should be mentioned before any other interpretation.',
  },
  flow: {
    label: 'Flow',
    question: 'Where is volume increasing and what caveat applies?',
    answer: 'Volume increases on the right side. Without exact labels, treat the magnitude as approximate.',
  },
};

function PipelineVisual() {
  return (
    <svg className="studio-pipeline" viewBox="0 0 720 260" role="img" aria-label="On-chain AI training to registration flow">
      <defs>
        <linearGradient id="studioFlow" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#14F195" />
          <stop offset="100%" stopColor="#9945FF" />
        </linearGradient>
      </defs>
      <path d="M70 132 C160 52 230 210 322 126 C414 42 500 215 646 86" fill="none" stroke="url(#studioFlow)" strokeWidth="8" strokeLinecap="round" />
      {[
        ['Data', 78, 132],
        ['SFT', 236, 164],
        ['Eval', 370, 118],
        ['Hub', 510, 150],
        ['PDA', 646, 86],
      ].map(([label, x, y]) => (
        <g key={label}>
          <circle cx={x} cy={y} r="28" fill="#1A1B23" stroke="#14F195" strokeWidth="3" />
          <text x={x} y={y + 5} textAnchor="middle" fill="#FFFFFF" fontSize="15" fontWeight="700">{label}</text>
        </g>
      ))}
      <rect x="44" y="210" width="632" height="34" rx="8" fill="rgba(255,255,255,0.08)" />
      <text x="360" y="232" textAnchor="middle" fill="#B0B0B0" fontSize="14">Fine-tune off-chain. Register provenance, identity, pricing, and lifecycle on-chain.</text>
    </svg>
  );
}

function ChartVisionVisual({ mode }) {
  if (mode === 'allocation') {
    return (
      <svg className="chart-vision-svg" viewBox="0 0 560 260" role="img" aria-label="Token allocation chart">
        <rect x="28" y="22" width="504" height="216" rx="8" fill="#111827" />
        {[
          ['SOL', 64, 58, 132, '#14F195'],
          ['USDC', 206, 120, 78, '#6EE7F9'],
          ['LST', 348, 146, 52, '#FFD166'],
          ['MEME', 450, 172, 26, '#9945FF'],
        ].map(([label, x, y, height, color]) => (
          <g key={label}>
            <rect x={x} y={y} width="66" height={height} rx="6" fill={color} />
            <text x={x + 33} y="216" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="700">{label}</text>
          </g>
        ))}
        <path d="M54 198 H504" stroke="rgba(255,255,255,0.22)" />
        <text x="280" y="44" textAnchor="middle" fill="#B0B0B0" fontSize="14">Largest visible allocation: SOL</text>
      </svg>
    );
  }

  if (mode === 'flow') {
    return (
      <svg className="chart-vision-svg" viewBox="0 0 560 260" role="img" aria-label="Volume flow chart">
        <rect x="28" y="22" width="504" height="216" rx="8" fill="#111827" />
        <polyline points="54,184 118,172 182,178 246,136 310,146 374,98 438,110 502,62" fill="none" stroke="#14F195" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        {[54, 118, 182, 246, 310, 374, 438, 502].map((x, index) => (
          <circle key={x} cx={x} cy={[184, 172, 178, 136, 146, 98, 110, 62][index]} r="6" fill="#6EE7F9" />
        ))}
        <text x="280" y="222" textAnchor="middle" fill="#B0B0B0" fontSize="14">Visible flow rises toward the right side</text>
      </svg>
    );
  }

  return (
    <svg className="chart-vision-svg" viewBox="0 0 560 260" role="img" aria-label="Solana candlestick chart">
      <rect x="28" y="22" width="504" height="216" rx="8" fill="#111827" />
      {[78, 142, 206, 270, 334, 398, 462].map((x, index) => {
        const candle = [
          [126, 78, 70, '#FF6B6B'],
          [152, 102, 88, '#14F195'],
          [136, 88, 66, '#14F195'],
          [166, 118, 96, '#FF6B6B'],
          [128, 76, 58, '#14F195'],
          [104, 56, 42, '#14F195'],
          [82, 42, 34, '#14F195'],
        ][index];
        return (
          <g key={x}>
            <line x1={x} y1={candle[2]} x2={x} y2={candle[0] + 44} stroke="rgba(255,255,255,0.5)" strokeWidth="3" />
            <rect x={x - 17} y={candle[1]} width="34" height={Math.max(24, candle[0] - candle[1])} rx="5" fill={candle[3]} />
          </g>
        );
      })}
      <path d="M58 204 H502" stroke="rgba(255,255,255,0.22)" />
      <text x="280" y="44" textAnchor="middle" fill="#B0B0B0" fontSize="14">Visible trend: up. Forecast: not proven.</text>
    </svg>
  );
}

export default function OnChainAIStudio({ publicPreview = false }) {
  const [financeId, setFinanceId] = useState(financeTemplates[0].id);
  const [visionId, setVisionId] = useState(visionTemplates[0].id);
  const [chartMode, setChartMode] = useState('candles');
  const [copied, setCopied] = useState(null);
  const [piedInput, setPiedInput] = useState('Train2Earn registers deterministic compression and cellular automata agents on Solana.');
  const [piedCapabilities, setPiedCapabilities] = useState([]);
  const [piedAnalysis, setPiedAnalysis] = useState(null);
  const [piedLoading, setPiedLoading] = useState(true);
  const [piedError, setPiedError] = useState('');

  const finance = useMemo(
    () => financeTemplates.find((template) => template.id === financeId) || financeTemplates[0],
    [financeId],
  );
  const vision = useMemo(
    () => visionTemplates.find((template) => template.id === visionId) || visionTemplates[0],
    [visionId],
  );
  const chart = chartModes[chartMode];
  const runtimeCapabilities = useMemo(
    () => piedCapabilities.filter((capability) => capability.runtime?.includes('ported')).length,
    [piedCapabilities],
  );

  useEffect(() => {
    let active = true;

    async function loadPiedPiper() {
      setPiedLoading(true);
      setPiedError('');
      try {
        const [capabilityRes, analysisRes] = await Promise.all([
          apiGet('/api/piedpiper/capabilities'),
          apiPost('/api/piedpiper/analyze', { input: piedInput }),
        ]);
        if (!active) return;
        setPiedCapabilities(capabilityRes.capabilities || []);
        setPiedAnalysis(analysisRes.analysis);
      } catch (error) {
        if (active) setPiedError(error.message);
      } finally {
        if (active) setPiedLoading(false);
      }
    }

    loadPiedPiper();
    return () => {
      active = false;
    };
  }, []);

  async function copyTemplate(label, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1400);
    } catch (_error) {
      setCopied('copy unavailable');
      window.setTimeout(() => setCopied(null), 1400);
    }
  }

  async function runPiedPiperAnalysis(event) {
    event?.preventDefault();
    setPiedLoading(true);
    setPiedError('');

    try {
      const response = await apiPost('/api/piedpiper/analyze', { input: piedInput });
      setPiedAnalysis(response.analysis);
    } catch (error) {
      setPiedError(error.message);
    } finally {
      setPiedLoading(false);
    }
  }

  return (
    <div className="studio-shell">
      <section className="studio-hero">
        <div className="studio-hero-copy">
          <span className="eyebrow"><FiActivity /> On-chain AI studio</span>
          <h2>Solana finance templates, vision workflows, and registry-ready model plans.</h2>
          <p>
            Build focused datasets for wallet risk, DAO treasury review, chart reading,
            and model registration. Train off-chain, publish artifacts, then register
            provenance on-chain through Train2Earn.
          </p>
          <div className="studio-hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => copyTemplate('finance prompt', finance.prompt)}>
              <FiCopy /> Copy finance prompt
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setChartMode('allocation')}>
              <FiBarChart2 /> Open allocation visual
            </button>
          </div>
        </div>
        <PipelineVisual />
      </section>

      <section className="studio-kpis" aria-label="On-chain AI milestones">
        {[
          ['4', 'finance templates'],
          ['3', 'vision modes'],
          ['9', 'registry fields'],
          ['0', 'wallet secrets needed'],
        ].map(([value, label]) => (
          <div className="studio-kpi" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="studio-grid">
        <div className="studio-panel">
          <div className="studio-section-heading">
            <span className="eyebrow"><FiDollarSign /> Solana finance</span>
            <h3>Instruction templates</h3>
          </div>
          <div className="studio-template-switcher">
            {financeTemplates.map(({ id, title, Icon, accent }) => (
              <button
                key={id}
                type="button"
                className={financeId === id ? 'studio-template-button is-active' : 'studio-template-button'}
                onClick={() => setFinanceId(id)}
                style={{ '--template-accent': accent }}
              >
                <Icon />
                <span>{title}</span>
              </button>
            ))}
          </div>
          <div className="studio-template-detail">
            <div>
              <h4>{finance.title}</h4>
              <p>{finance.useCase}</p>
            </div>
            <pre>{finance.prompt}</pre>
            <div className="studio-output">
              <FiCheckCircle />
              <p>{finance.output}</p>
            </div>
            <div className="studio-chip-row">
              {finance.metrics.map((metric) => <span key={metric}>{metric}</span>)}
            </div>
          </div>
        </div>

        <div className="studio-panel">
          <div className="studio-section-heading">
            <span className="eyebrow"><FiCamera /> Vision model</span>
            <h3>Multimodal prompt builder</h3>
          </div>
          <div className="studio-vision-list">
            {visionTemplates.map(({ id, title, Icon }) => (
              <button
                key={id}
                type="button"
                className={visionId === id ? 'studio-vision-button is-active' : 'studio-vision-button'}
                onClick={() => setVisionId(id)}
              >
                <Icon />
                <span>{title}</span>
              </button>
            ))}
          </div>
          <div className="studio-vision-preview">
            <div className="studio-image-frame">
              <ChartVisionVisual mode={vision.id === 'chart' ? 'flow' : vision.id === 'dashboard' ? 'allocation' : 'candles'} />
            </div>
            <pre>{vision.prompt}</pre>
            <div className="studio-output">
              <FiEye />
              <p>{vision.answer}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="studio-piedpiper-band">
        <div className="studio-piedpiper-copy">
          <span className="eyebrow"><FiArchive /> PiedPiper toolkit</span>
          <h3>Compression, automata, and protocol primitives for registry-ready agents.</h3>
          <p>
            The local PiedPiper bundle is normalized into deterministic model capabilities
            that can produce compression metrics, cellular automata commitments, and a
            Train2Earn registration draft.
          </p>
          <div className="piedpiper-metrics">
            <div><strong>{piedCapabilities.length || 8}</strong><span>capabilities</span></div>
            <div><strong>{runtimeCapabilities || 4}</strong><span>ported runtimes</span></div>
            <div><strong>MIT</strong><span>source license</span></div>
          </div>
          <form className="piedpiper-form" onSubmit={runPiedPiperAnalysis}>
            <label>
              <span>Pipeline input</span>
              <textarea value={piedInput} onChange={(event) => setPiedInput(event.target.value)} />
            </label>
            <div className="studio-hero-actions">
              <button type="submit" className="btn btn-primary" disabled={piedLoading}>
                <FiRefreshCw /> {piedLoading ? 'Running...' : 'Run pipeline'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!piedAnalysis}
                onClick={() => copyTemplate('PiedPiper registry draft', JSON.stringify(piedAnalysis?.registryDraft || {}, null, 2))}
              >
                <FiCopy /> Copy registry draft
              </button>
            </div>
          </form>
        </div>

        <div className="studio-piedpiper-results">
          <div className="studio-section-heading">
            <span className="eyebrow"><FiHash /> Deterministic output</span>
            <h3>PiedPiper analysis</h3>
          </div>
          {piedError && <div className="studio-error">{piedError}</div>}
          {!piedError && piedLoading && <div className="studio-loading-line"><span className="spinner-sm" /> Running analysis</div>}
          {!piedError && piedAnalysis && (
            <>
              <div className="pied-result-grid">
                <div>
                  <span>Huffman ratio</span>
                  <strong>{piedAnalysis.compression.huffman.compressionRatio}</strong>
                </div>
                <div>
                  <span>RLE ratio</span>
                  <strong>{piedAnalysis.compression.rle.compressionRatio}</strong>
                </div>
                <div>
                  <span>Rule30</span>
                  <strong>{piedAnalysis.automata.rule30.hexPreview.slice(0, 8)}</strong>
                </div>
                <div>
                  <span>PBIC stroke</span>
                  <strong>{piedAnalysis.imageCompression.best.id.replace(/-/g, ' ')}</strong>
                </div>
              </div>
              <div className="pied-automata-grid">
                <div>
                  <span><FiCpu /> Game of Life</span>
                  <pre>{piedAnalysis.automata.gameOfLife.finalGrid.slice(0, 8).join('\n')}</pre>
                </div>
                <div>
                  <span><FiGitBranch /> Forest fire</span>
                  <pre>{piedAnalysis.automata.forestFire.finalGrid.slice(0, 8).join('\n')}</pre>
                </div>
              </div>
              <div className="pied-registry-preview">
                <span className="eyebrow"><FiDatabase /> Registry draft</span>
                <pre>{JSON.stringify(piedAnalysis.registryDraft, null, 2)}</pre>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="studio-capability-strip">
        {piedCapabilities.slice(0, 8).map((capability) => (
          <article key={capability.id}>
            <span>{capability.category}</span>
            <strong>{capability.name}</strong>
            <small>{capability.runtime}</small>
          </article>
        ))}
      </section>

      <section className="studio-chart-band">
        <div className="studio-chart-copy">
          <span className="eyebrow"><FiTrendingUp /> Chart vision</span>
          <h3>Evidence-grounded chart QA for Solana finance.</h3>
          <p>
            Chart models should describe visible evidence, name uncertainty, and
            avoid price predictions. Use preference pairs to reward cautious,
            non-advisory answers.
          </p>
          <div className="studio-chart-tabs">
            {Object.entries(chartModes).map(([id, item]) => (
              <button
                key={id}
                type="button"
                className={chartMode === id ? 'is-active' : ''}
                onClick={() => setChartMode(id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="studio-chart-qa">
            <strong>{chart.question}</strong>
            <span>{chart.answer}</span>
          </div>
        </div>
        <ChartVisionVisual mode={chartMode} />
      </section>

      <section className="studio-registry-strip">
        <div>
          <span className="eyebrow"><FiDatabase /> Registry package</span>
          <h3>What gets registered on-chain</h3>
        </div>
        <div className="studio-registry-list">
          {[
            'MPL Core asset',
            'artifact URI',
            'artifact hash',
            'Hugging Face repo',
            'training data URI',
            'evaluation links',
            'pricing',
            'royalty bps',
            'creator authority',
          ].map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>

      {copied && <div className="studio-toast">{copied === 'copy unavailable' ? 'Copy unavailable' : `Copied ${copied}`}</div>}

      {publicPreview && (
        <p className="studio-preview-note">
          Connect a wallet to pair these templates with live wallet assets and model registration flows.
        </p>
      )}
    </div>
  );
}
