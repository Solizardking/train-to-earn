import React, { useState } from 'react';
import { FaImage, FaCoins, FaLayerGroup } from 'react-icons/fa';

function WalletAssets({ assets }) {
  const [view, setView] = useState('all');
  const items = assets?.items || [];

  const filteredItems = items.filter(item => {
    if (view === 'all') return true;
    if (view === 'nft') return item.interface !== 'FungibleToken' && item.interface !== 'FungibleAsset';
    if (view === 'token') return item.interface === 'FungibleToken' || item.interface === 'FungibleAsset';
    if (view === 'compressed') return item.compression?.compressed;
    return true;
  });

  return (
    <div className="mt-4">
      <div className="flex-between mb-3">
        <h2 style={styles.sectionTitle}>Your Assets</h2>
        <div style={styles.filterButtons}>
          <button
            className={`btn ${view === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('all')}
            style={styles.filterBtn}
          >
            All
          </button>
          <button
            className={`btn ${view === 'nft' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('nft')}
            style={styles.filterBtn}
          >
            NFTs
          </button>
          <button
            className={`btn ${view === 'token' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('token')}
            style={styles.filterBtn}
          >
            Tokens
          </button>
          <button
            className={`btn ${view === 'compressed' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('compressed')}
            style={styles.filterBtn}
          >
            Compressed
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="card text-center" style={styles.emptyState}>
          <FaLayerGroup size={48} color="#B0B0B0" />
          <p className="text-secondary mt-2">No assets found in this category</p>
        </div>
      ) : (
        <div className="grid grid-3">
          {filteredItems.slice(0, 12).map((item, index) => (
            <AssetCard key={item.id || index} asset={item} />
          ))}
        </div>
      )}

      {filteredItems.length > 12 && (
        <div className="text-center mt-3">
          <p className="text-secondary">
            Showing 12 of {filteredItems.length} assets
          </p>
        </div>
      )}
    </div>
  );
}

function AssetCard({ asset }) {
  const metadata = asset.content?.metadata;
  const image = asset.content?.links?.image || asset.content?.files?.[0]?.uri;
  const isCompressed = asset.compression?.compressed;
  const collection = asset.grouping?.find(g => g.group_key === 'collection')?.group_value;

  return (
    <div className="card" style={styles.assetCard}>
      <div style={styles.imageContainer}>
        {image ? (
          <img
            src={image}
            alt={metadata?.name || 'Asset'}
            style={styles.image}
            onError={(e) => {
              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%232A2B35" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239945FF" font-size="48"%3E?%3C/text%3E%3C/svg%3E';
            }}
          />
        ) : (
          <div style={styles.placeholderImage}>
            <FaImage size={32} color="#9945FF" />
          </div>
        )}
        {isCompressed && (
          <span style={styles.badge}>
            Compressed
          </span>
        )}
      </div>

      <div style={styles.assetInfo}>
        <h3 style={styles.assetName}>
          {metadata?.name || `Asset ${asset.id.slice(0, 4)}...`}
        </h3>
        {metadata?.symbol && (
          <p className="text-secondary" style={styles.symbol}>
            {metadata.symbol}
          </p>
        )}
        {collection && (
          <p className="text-secondary" style={styles.collection}>
            <FaLayerGroup size={12} /> Collection
          </p>
        )}
        <div style={styles.assetFooter}>
          <span style={styles.interface}>{asset.interface}</span>
          {asset.token_info?.balance && (
            <span className="text-success">
              <FaCoins size={12} /> {asset.token_info.balance}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  sectionTitle: {
    fontSize: '24px',
    fontWeight: '700',
    margin: 0,
  },
  filterButtons: {
    display: 'flex',
    gap: '8px',
  },
  filterBtn: {
    padding: '8px 16px',
    fontSize: '13px',
  },
  emptyState: {
    padding: '60px 20px',
  },
  assetCard: {
    padding: '0',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    paddingTop: '100%',
    background: 'linear-gradient(135deg, #2A2B35 0%, #1A1B23 100%)',
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholderImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(20, 241, 149, 0.9)',
    color: '#1A1B23',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
  },
  assetInfo: {
    padding: '16px',
  },
  assetName: {
    fontSize: '16px',
    fontWeight: '600',
    margin: '0 0 4px 0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  symbol: {
    fontSize: '13px',
    margin: '0 0 8px 0',
  },
  collection: {
    fontSize: '12px',
    margin: '0 0 12px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  assetFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '12px',
    borderTop: '1px solid rgba(153, 69, 255, 0.1)',
  },
  interface: {
    fontSize: '11px',
    color: '#9945FF',
    fontWeight: '600',
  },
};

export default WalletAssets;
