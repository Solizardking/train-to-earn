import React, { useState } from 'react';
import { FaBrain, FaRocket, FaChartLine } from 'react-icons/fa';
import { apiPost } from '../utils/api';

function AIAnalysis({ assets, walletAddress }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateAnalysis = async () => {
    if (!assets || assets.length === 0) {
      setError('No assets to analyze');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiPost('/api/ai/analyze', {
        assets,
        walletAddress,
      });
      setAnalysis(data.analysis);
    } catch (err) {
      console.error('Error generating analysis:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="card" style={styles.analysisCard}>
        <div className="flex-between mb-3">
          <div className="flex" style={styles.header}>
            <FaBrain size={24} color="#14F195" />
            <h2 style={styles.title}>AI Portfolio Analysis</h2>
          </div>
          <button
            className="btn btn-primary"
            onClick={generateAnalysis}
            disabled={loading || !assets || assets.length === 0}
          >
            {loading ? (
              <>
                <div className="spinner" style={styles.smallSpinner}></div>
                Analyzing...
              </>
            ) : (
              <>
                <FaRocket /> Generate Insights
              </>
            )}
          </button>
        </div>

        {!analysis && !loading && !error && (
          <div style={styles.placeholder}>
            <FaChartLine size={48} color="#9945FF" />
            <p className="text-secondary mt-2">
              Click "Generate Insights" to get an AI-powered analysis of your portfolio
            </p>
            <div style={styles.features}>
              <div style={styles.feature}>
                <span className="text-success">✓</span> Portfolio Overview
              </div>
              <div style={styles.feature}>
                <span className="text-success">✓</span> Collection Analysis
              </div>
              <div style={styles.feature}>
                <span className="text-success">✓</span> Engagement Level
              </div>
              <div style={styles.feature}>
                <span className="text-success">✓</span> Personalized Recommendations
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex-center" style={styles.loadingState}>
            <div className="spinner"></div>
            <p className="text-secondary mt-2">
              Our AI is analyzing your portfolio...
            </p>
          </div>
        )}

        {error && (
          <div style={styles.errorState}>
            <p className="text-error">Error: {error}</p>
            <button className="btn btn-primary mt-2" onClick={generateAnalysis}>
              Try Again
            </button>
          </div>
        )}

        {analysis && !loading && (
          <div style={styles.analysisContent}>
            <div style={styles.badge}>
              <FaBrain size={16} /> Powered by {process.env.OPENROUTER_MODEL || 'AI'}
            </div>
            <div style={styles.analysisText}>
              {analysis.split('\n').map((paragraph, index) => (
                <p key={index} style={styles.paragraph}>
                  {paragraph}
                </p>
              ))}
            </div>
            <button
              className="btn btn-secondary mt-3"
              onClick={generateAnalysis}
              style={styles.refreshBtn}
            >
              <FaRocket /> Regenerate Analysis
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  analysisCard: {
    padding: '32px',
  },
  header: {
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    margin: 0,
  },
  smallSpinner: {
    width: '16px',
    height: '16px',
    borderWidth: '2px',
    display: 'inline-block',
    marginRight: '8px',
  },
  placeholder: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginTop: '32px',
  },
  feature: {
    padding: '16px',
    background: 'rgba(153, 69, 255, 0.1)',
    borderRadius: '12px',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  loadingState: {
    flexDirection: 'column',
    padding: '60px 20px',
  },
  errorState: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  analysisContent: {
    position: 'relative',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: 'rgba(20, 241, 149, 0.1)',
    border: '1px solid rgba(20, 241, 149, 0.3)',
    borderRadius: '8px',
    color: '#14F195',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '24px',
  },
  analysisText: {
    lineHeight: '1.8',
    fontSize: '15px',
    color: '#E0E0E0',
  },
  paragraph: {
    marginBottom: '16px',
  },
  refreshBtn: {
    width: '100%',
  },
};

export default AIAnalysis;
