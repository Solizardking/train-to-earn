import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import WalletAssets from './WalletAssets';
import AIAnalysis from './AIAnalysis';
import RewardsPanel from './RewardsPanel';
import JevRatingPanel from './JevRatingPanel';
import HowItWorks from './HowItWorks';
import RatedShowcase from './RatedShowcase';
import AIModels from './AIModels';
import ArweaveUpload from './ArweaveUpload';
import HuggingFacePanel from './HuggingFacePanel';
import FileUploadAgent from './FileUploadAgent';
import ConsensusTraining from './ConsensusTraining';
import AgentMint from './AgentMint';
import OnChainAIStudio from './OnChainAIStudio';
import TrainingPage from './TrainingPage';
import RegistryPage from './RegistryPage';
import SubmitDataPage from './SubmitDataPage';
import CliPage from './CliPage';
import AuthStatus from './AuthStatus';
import { apiPost } from '../utils/api';
import { FaWallet, FaRocket, FaBrain, FaTrophy } from 'react-icons/fa';
import { FiBarChart2, FiCpu, FiGitBranch, FiUploadCloud, FiHome, FiZap, FiGlobe, FiTerminal, FiSend } from 'react-icons/fi';

const TABS = [
  { id: 'portfolio', label: 'Portfolio', Icon: FiHome },
  { id: 'studio', label: 'AI Studio', Icon: FiBarChart2 },
  { id: 'training', label: 'Consensus', Icon: FiGitBranch },
  { id: 'models', label: 'AI Models', Icon: FiCpu },
  { id: 'registry', label: 'Registry', Icon: FiGlobe },
  { id: 'submit', label: 'Submit Data', Icon: FiSend },
  { id: 'upload', label: 'Data Hub', Icon: FiUploadCloud },
  { id: 'agent', label: 'CLAWD Agent', Icon: FiZap },
  { id: 'mint', label: 'Mint Agent', Icon: FiZap },
  { id: 'ai-training', label: 'Training', Icon: FiBarChart2 },
  { id: 'cli', label: 'CLI', Icon: FiTerminal },
];

// Pages reachable without a wallet connection (public reads + info).
const PUBLIC_TABS = [
  { id: 'models', label: 'AI Models', Icon: FiCpu },
  { id: 'registry', label: 'Registry', Icon: FiGlobe },
  { id: 'submit', label: 'Submit Data', Icon: FiSend },
  { id: 'cli', label: 'CLI', Icon: FiTerminal },
];

const TAB_PATHS = {
  studio: '/studio',
  mint: '/mint',
  'ai-training': '/training',
  models: '/models',
  registry: '/registry',
  submit: '/submit',
  cli: '/cli',
};

function tabFromPath() {
  if (typeof window === 'undefined') return 'portfolio';
  const path = window.location.pathname;
  const match = Object.entries(TAB_PATHS).find(([, p]) => path.startsWith(p));
  return match ? match[0] : 'portfolio';
}

function Dashboard() {
  const { publicKey, connected } = useWallet();
  const [assets, setAssets] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(tabFromPath);

  useEffect(() => {
    const onPopState = () => setActiveTab(tabFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const selectTab = useCallback((tabId) => {
    setActiveTab(tabId);
    const target = TAB_PATHS[tabId];
    if (target) {
      if (window.location.pathname !== target) {
        window.history.pushState({}, '', target);
      }
    } else if (Object.values(TAB_PATHS).some((p) => window.location.pathname.startsWith(p))) {
      window.history.pushState({}, '', '/');
    }
  }, []);

  const fetchWalletData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const walletAddress = publicKey.toString();

      const assetsData = await apiPost('/api/assets/search', {
        ownerAddress: walletAddress,
        tokenType: 'all',
        limit: 50,
        page: 1,
      });

      const tokensData = await apiPost('/api/tokens/accounts', {
        owner: walletAddress,
        limit: 100,
      });

      setAssets(assetsData.result || assetsData);
      setTokens(tokensData.result || tokensData);
    } catch (err) {
      console.error('Error fetching wallet data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchWalletData();
    } else {
      setAssets(null);
      setTokens(null);
    }
  }, [connected, publicKey, fetchWalletData]);

  return (
    <div className="container">
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <FaRocket size={32} color="#9945FF" />
          <h1 className="gradient-text" style={styles.title}>Train2Earn</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <AuthStatus />
          <WalletMultiButton />
        </div>
      </header>

      {/* Navbar (disconnected) — public pages: models, registry, submit, CLI */}
      {!connected && (
        <div style={{...styles.tabBar, marginTop: '12px'}}>
          {PUBLIC_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              style={{...styles.tab, ...(activeTab === id ? styles.tabActive : {})}}
              onClick={() => selectTab(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* AI Models (disconnected — public page) */}
      {!connected && activeTab === 'models' && <AIModels />}

      {/* Omnichain Registry (disconnected — public page) */}
      {!connected && activeTab === 'registry' && <RegistryPage />}

      {/* Submit Data (disconnected — shows the connect prompt) */}
      {!connected && activeTab === 'submit' && <SubmitDataPage />}

      {/* Official CLI (disconnected — public page) */}
      {!connected && activeTab === 'cli' && <CliPage />}

      {/* Hero (disconnected) */}
      {!connected && !['mint', 'studio', 'models', 'registry', 'submit', 'cli'].includes(activeTab) && (
        <div style={styles.hero}>
          <FaBrain size={64} color="#14F195" style={styles.heroIcon} />
          <h2 style={styles.heroTitle}>
            Welcome to <span className="gradient-text">Train2Earn</span>
          </h2>
          <p style={styles.heroSubtitle}>
            Connect your Solana wallet, submit Solana training data, and let the Jev
            decision engine rate its quality in realtime — high scores earn CLAWD rewards.
            Your wallet is your account: no email, no password.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <WalletMultiButton />
          </div>
          <div style={styles.features}>
            <div className="card" style={styles.featureCard}>
              <FaWallet size={32} color="#9945FF" />
              <h3 style={styles.featureTitle}>Wallet Analysis</h3>
              <p className="text-secondary">
                View all your Solana assets, NFTs, and tokens in one place
              </p>
            </div>
            <div className="card" style={styles.featureCard}>
              <FaBrain size={32} color="#14F195" />
              <h3 style={styles.featureTitle}>AI Insights</h3>
              <p className="text-secondary">
                Get intelligent analysis of your portfolio powered by advanced AI
              </p>
            </div>
            <div className="card" style={styles.featureCard}>
              <FaTrophy size={32} color="#FFD700" />
              <h3 style={styles.featureTitle}>Earn CLAWD</h3>
              <p className="text-secondary">
                Complete training milestones and earn CLAWD tokens based on your activity
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginTop: '24px', textAlign: 'left' }}>
            <div className="card" style={{ padding: '24px' }}>
              <FiGlobe size={28} color="#14F195" />
              <h3 style={{ ...styles.featureTitle, margin: '12px 0 8px' }}>Omnichain Model Registry</h3>
              <p className="text-secondary" style={{ lineHeight: 1.6 }}>
                Models from any chain register a signed manifest, anchored natively on
                Solana — public, no holder gate, with verification tiers that say exactly
                what has been checked.
              </p>
              <button type="button" className="btn btn-secondary mt-2" onClick={() => selectTab('registry')}>
                Browse the registry
              </button>
            </div>
            <div className="card" style={{ padding: '24px' }}>
              <FiTerminal size={28} color="#9945FF" />
              <h3 style={{ ...styles.featureTitle, margin: '12px 0 8px' }}>Official CLI</h3>
              <p className="text-secondary" style={{ lineHeight: 1.6 }}>
                Log in with a wallet signature, submit data in every form, upload, and
                register models — all from your terminal. Keys never leave your machine.
              </p>
              <button type="button" className="btn btn-secondary mt-2" onClick={() => selectTab('cli')}>
                Get the CLI
              </button>
            </div>
            <div className="card" style={{ padding: '24px' }}>
              <FiSend size={28} color="#FFD700" />
              <h3 style={{ ...styles.featureTitle, margin: '12px 0 8px' }}>Submit any data form</h3>
              <p className="text-secondary" style={{ lineHeight: 1.6 }}>
                Text, image + caption pairs, video, bulk datasets, and robot episode data —
                all rated by the same Jev engine, all earning to your wallet.
              </p>
              <button type="button" className="btn btn-secondary mt-2" onClick={() => selectTab('submit')}>
                Submit data
              </button>
            </div>
          </div>
          <HowItWorks />
          <div style={{ maxWidth: '860px', margin: '32px auto 0', textAlign: 'left' }}>
            <JevRatingPanel />
          </div>
          <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'left' }}>
            <RatedShowcase />
          </div>
        </div>
      )}

      {!connected && activeTab === 'studio' && <OnChainAIStudio publicPreview />}

      {!connected && activeTab === 'mint' && <AgentMint publicPreview />}

      {/* Connected */}
      {connected && (
        <div style={styles.content}>
          {/* Tab Bar */}
          <div style={styles.tabBar}>
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                style={{
                  ...styles.tab,
                  ...(activeTab === id ? styles.tabActive : {}),
                }}
                onClick={() => selectTab(id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Portfolio Tab */}
          {activeTab === 'portfolio' && (
            <>
              <JevRatingPanel />

              {loading && (
                <div className="flex-center" style={styles.loading}>
                  <div className="spinner"></div>
                  <p style={styles.loadingText}>Loading your wallet data...</p>
                </div>
              )}

              {error && (
                <div className="card" style={styles.errorCard}>
                  <p className="text-error">Error: {error}</p>
                  <button type="button" className="btn btn-primary mt-2" onClick={fetchWalletData}>
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && assets && (
                <>
                  <div className="grid grid-3 mb-4">
                    <div className="card">
                      <div className="flex-between mb-2">
                        <span className="text-secondary">Total Assets</span>
                        <FaWallet color="#9945FF" />
                      </div>
                      <h2 className="gradient-text">
                        {assets.total || assets.items?.length || 0}
                      </h2>
                    </div>
                    <div className="card">
                      <div className="flex-between mb-2">
                        <span className="text-secondary">Token Accounts</span>
                        <FaRocket color="#14F195" />
                      </div>
                      <h2 className="text-success">
                        {tokens?.total || tokens?.token_accounts?.length || 0}
                      </h2>
                    </div>
                    <div className="card">
                      <div className="flex-between mb-2">
                        <span className="text-secondary">SOL Balance</span>
                        <FaTrophy color="#FFD700" />
                      </div>
                      <h2>
                        {((assets.nativeBalance?.lamports || 0) / 1e9).toFixed(4)} SOL
                      </h2>
                    </div>
                  </div>

                  <RewardsPanel
                    walletAddress={publicKey.toString()}
                    assetsCount={assets.total || assets.items?.length || 0}
                    tokensCount={tokens?.total || tokens?.token_accounts?.length || 0}
                  />

                  <RatedShowcase />

                  <WalletAssets assets={assets} />

                  <AIAnalysis
                    assets={assets.items || []}
                    walletAddress={publicKey.toString()}
                  />
                </>
              )}
            </>
          )}

          {/* On-chain AI Studio Tab */}
          {activeTab === 'studio' && <OnChainAIStudio />}

          {/* Consensus Training Tab */}
          {activeTab === 'training' && <ConsensusTraining />}

          {/* AI Models Tab */}
          {activeTab === 'models' && <AIModels />}

          {/* Omnichain Registry Tab */}
          {activeTab === 'registry' && <RegistryPage />}

          {/* Submit Data Tab (all forms — Jev-2) */}
          {activeTab === 'submit' && <SubmitDataPage />}

          {/* Official CLI Tab */}
          {activeTab === 'cli' && <CliPage />}

          {/* Arweave Upload Tab */}
          {activeTab === 'upload' && (
            <>
              <HuggingFacePanel />
              <ArweaveUpload />
            </>
          )}

          {/* CLAWD Agent Tab */}
          {activeTab === 'agent' && <FileUploadAgent />}

          {/* Agent Mint Tab */}
          {activeTab === 'mint' && <AgentMint />}

          {/* AI Training Page Tab */}
          {activeTab === 'ai-training' && <TrainingPage />}
        </div>
      )}

      {/* Footer */}
      <footer style={styles.footer}>
        <p className="text-secondary">
          Powered by Helius DAS API, OpenRouter AI, Arweave Storage & the Jev decision
          engine (TypeSafe AI via the Neon AI Gateway)
        </p>
      </footer>
    </div>
  );
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 0',
    marginBottom: '40px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    margin: 0,
  },
  hero: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  heroIcon: {
    marginBottom: '24px',
    animation: 'pulse 2s infinite',
  },
  heroTitle: {
    fontSize: '48px',
    fontWeight: '700',
    marginBottom: '16px',
  },
  heroSubtitle: {
    fontSize: '18px',
    color: '#B0B0B0',
    maxWidth: '600px',
    margin: '0 auto 48px',
    lineHeight: '1.6',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    marginTop: '48px',
  },
  featureCard: {
    textAlign: 'center',
    padding: '32px',
  },
  featureTitle: {
    margin: '16px 0 8px',
    fontSize: '20px',
    fontWeight: '600',
  },
  content: {
    marginTop: '40px',
  },
  tabBar: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '32px',
    borderBottom: '1px solid rgba(153, 69, 255, 0.2)',
    paddingBottom: '0',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#B0B0B0',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '-1px',
  },
  tabActive: {
    color: '#9945FF',
    borderBottomColor: '#9945FF',
    background: 'rgba(153, 69, 255, 0.05)',
  },
  loading: {
    flexDirection: 'column',
    gap: '16px',
    padding: '60px 0',
  },
  loadingText: {
    color: '#B0B0B0',
    fontSize: '16px',
  },
  errorCard: {
    textAlign: 'center',
    padding: '40px',
  },
  footer: {
    textAlign: 'center',
    padding: '40px 0 20px',
    marginTop: '60px',
    borderTop: '1px solid rgba(153, 69, 255, 0.1)',
  },
};

export default Dashboard;
