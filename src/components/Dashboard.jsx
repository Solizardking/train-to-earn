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
import { apiPost } from '../utils/api';
import { FaWallet, FaRocket, FaBrain, FaTrophy } from 'react-icons/fa';
import { FiBarChart2, FiCpu, FiGitBranch, FiUploadCloud, FiHome, FiZap } from 'react-icons/fi';

const TABS = [
  { id: 'portfolio', label: 'Portfolio', Icon: FiHome },
  { id: 'studio', label: 'AI Studio', Icon: FiBarChart2 },
  { id: 'training', label: 'Consensus', Icon: FiGitBranch },
  { id: 'models', label: 'AI Models', Icon: FiCpu },
  { id: 'upload', label: 'Data Hub', Icon: FiUploadCloud },
  { id: 'agent', label: 'CLAWD Agent', Icon: FiZap },
  { id: 'mint', label: 'Mint Agent', Icon: FiZap },
  { id: 'ai-training', label: 'Training', Icon: FiBarChart2 },
];

function tabFromPath() {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/studio')) {
    return 'studio';
  }
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/mint')) {
    return 'mint';
  }
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/training')) {
    return 'ai-training';
  }
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/models')) {
    return 'models';
  }
  return 'portfolio';
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
    if (tabId === 'studio' && window.location.pathname !== '/studio') {
      window.history.pushState({}, '', '/studio');
    } else if (tabId === 'mint' && window.location.pathname !== '/mint') {
      window.history.pushState({}, '', '/mint');
    } else if (tabId === 'ai-training' && window.location.pathname !== '/training') {
      window.history.pushState({}, '', '/training');
    } else if (!['mint', 'studio', 'ai-training'].includes(tabId) && (
      window.location.pathname.startsWith('/mint') ||
      window.location.pathname.startsWith('/studio') ||
      window.location.pathname.startsWith('/training')
    )) {
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
        <WalletMultiButton />
      </header>

      {/* Navbar (disconnected) — show models tab */}
      {!connected && (
        <div style={{...styles.tabBar, marginTop: '12px'}}>
          <button
            type="button"
            style={{...styles.tab, ...(activeTab === 'models' ? styles.tabActive : {})}}
            onClick={() => selectTab('models')}
          >
            <FiCpu size={16} />
            AI Models
          </button>
        </div>
      )}

      {/* AI Models (disconnected — public page) */}
      {!connected && activeTab === 'models' && <AIModels />}

      {/* Hero (disconnected) */}
      {!connected && activeTab !== 'mint' && activeTab !== 'studio' && activeTab !== 'models' && (
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
