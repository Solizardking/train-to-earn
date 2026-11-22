// src/utils/arweaveStorage.js
// Arweave Permanent Storage Integration for AI Models

import Arweave from 'arweave';
import { Connection, PublicKey } from '@solana/web3.js';

// Initialize Arweave
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
  timeout: 60000,
  logging: false,
});

// Arweave gateway URLs
const ARWEAVE_GATEWAY = 'https://arweave.net';
const BUNDLR_GATEWAY = 'https://node2.bundlr.network'; // For faster uploads

// AR token price estimation (approximate, check real-time)
const AR_PER_MB = 0.00001; // Very approximate, varies with network

/**
 * Generate Arweave wallet from Solana keypair
 * Note: In production, use a dedicated Arweave wallet
 */
export async function generateArweaveWallet() {
  const key = await arweave.wallets.generate();
  const address = await arweave.wallets.jwkToAddress(key);

  return {
    key,
    address
  };
}

/**
 * Get Arweave wallet balance
 * @param {string} address - Arweave wallet address
 * @returns {Promise<number>} Balance in AR
 */
export async function getArweaveBalance(address) {
  try {
    const winstonBalance = await arweave.wallets.getBalance(address);
    const arBalance = arweave.ar.winstonToAr(winstonBalance);
    return parseFloat(arBalance);
  } catch (error) {
    console.error('Error getting Arweave balance:', error);
    return 0;
  }
}

/**
 * Upload AI model to Arweave with metadata
 * @param {Buffer|Uint8Array} modelData - Model binary data
 * @param {Object} metadata - Model metadata
 * @param {Object} wallet - Arweave wallet JWK
 * @returns {Promise<{txId: string, cost: number}>}
 */
export async function uploadModelToArweave(modelData, metadata, wallet) {
  try {
    console.log('Uploading model to Arweave...');

    // Create transaction
    const transaction = await arweave.createTransaction({
      data: modelData
    }, wallet);

    // Add tags for indexing
    transaction.addTag('Content-Type', 'application/octet-stream');
    transaction.addTag('App-Name', 'SolanaAI');
    transaction.addTag('Model-Name', metadata.name || 'Unnamed Model');
    transaction.addTag('Model-Version', metadata.version || '1.0.0');
    transaction.addTag('Model-Type', metadata.modelType || 'general');
    transaction.addTag('Model-Size', modelData.length.toString());
    transaction.addTag('Created-At', Date.now().toString());
    transaction.addTag('Creator', metadata.creator || 'anonymous');
    transaction.addTag('Description', metadata.description || 'AI Model');
    transaction.addTag('Solana-Address', metadata.solanaAddress || '');
    transaction.addTag('License', metadata.license || 'MIT');
    transaction.addTag('Framework', metadata.framework || 'pytorch');
    transaction.addTag('Accuracy', metadata.accuracy?.toString() || '0');

    // Add custom tags
    if (metadata.tags) {
      metadata.tags.forEach(tag => {
        transaction.addTag('Tag', tag);
      });
    }

    // Sign transaction
    await arweave.transactions.sign(transaction, wallet);

    // Get cost
    const cost = await arweave.transactions.getPrice(modelData.length);
    const costInAR = arweave.ar.winstonToAr(cost);

    console.log(`Upload cost: ${costInAR} AR`);

    // Post transaction
    const response = await arweave.transactions.post(transaction);

    if (response.status === 200) {
      console.log('Model uploaded successfully:', transaction.id);

      return {
        txId: transaction.id,
        cost: parseFloat(costInAR),
        url: `${ARWEAVE_GATEWAY}/${transaction.id}`,
        status: 'pending' // Will be confirmed in ~2 hours
      };
    } else {
      throw new Error(`Upload failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error uploading to Arweave:', error);
    throw error;
  }
}

/**
 * Upload model metadata to Arweave
 * @param {Object} metadata - Model metadata
 * @param {Object} wallet - Arweave wallet JWK
 * @returns {Promise<{txId: string, cost: number}>}
 */
export async function uploadMetadataToArweave(metadata, wallet) {
  try {
    const metadataJSON = JSON.stringify(metadata, null, 2);
    const transaction = await arweave.createTransaction({
      data: metadataJSON
    }, wallet);

    // Add tags
    transaction.addTag('Content-Type', 'application/json');
    transaction.addTag('App-Name', 'SolanaAI');
    transaction.addTag('Type', 'Model-Metadata');
    transaction.addTag('Model-Name', metadata.name || 'Unnamed');

    await arweave.transactions.sign(transaction, wallet);

    const cost = await arweave.transactions.getPrice(metadataJSON.length);
    const costInAR = arweave.ar.winstonToAr(cost);

    const response = await arweave.transactions.post(transaction);

    if (response.status === 200) {
      return {
        txId: transaction.id,
        cost: parseFloat(costInAR),
        url: `${ARWEAVE_GATEWAY}/${transaction.id}`
      };
    } else {
      throw new Error(`Metadata upload failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Error uploading metadata:', error);
    throw error;
  }
}

/**
 * Download model from Arweave
 * @param {string} txId - Arweave transaction ID
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<ArrayBuffer>}
 */
export async function downloadModelFromArweave(txId, onProgress) {
  try {
    console.log('Downloading model from Arweave:', txId);

    const url = `${ARWEAVE_GATEWAY}/${txId}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const contentLength = +response.headers.get('Content-Length');

    let receivedLength = 0;
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      if (onProgress && contentLength) {
        onProgress(Math.floor((receivedLength / contentLength) * 100));
      }
    }

    // Concatenate chunks
    const allChunks = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }

    return allChunks.buffer;
  } catch (error) {
    console.error('Error downloading from Arweave:', error);
    throw error;
  }
}

/**
 * Get model metadata from Arweave
 * @param {string} txId - Transaction ID
 * @returns {Promise<Object>}
 */
export async function getModelMetadataFromArweave(txId) {
  try {
    const response = await fetch(`${ARWEAVE_GATEWAY}/${txId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return null;
  }
}

/**
 * Get transaction status
 * @param {string} txId - Transaction ID
 * @returns {Promise<Object>}
 */
export async function getTransactionStatus(txId) {
  try {
    const status = await arweave.transactions.getStatus(txId);

    return {
      confirmed: status.confirmed,
      confirmations: status.confirmed?.number_of_confirmations || 0,
      blockHeight: status.confirmed?.block_height || null,
      blockHash: status.confirmed?.block_indep_hash || null,
      status: status.confirmed ? 'confirmed' : 'pending'
    };
  } catch (error) {
    console.error('Error getting transaction status:', error);
    return { confirmed: false, status: 'unknown' };
  }
}

/**
 * Query models by tags using GraphQL
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Array>}
 */
export async function queryModels(filters = {}) {
  try {
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["SolanaAI"] }
            ${filters.modelType ? `{ name: "Model-Type", values: ["${filters.modelType}"] }` : ''}
            ${filters.creator ? `{ name: "Creator", values: ["${filters.creator}"] }` : ''}
          ]
          first: ${filters.limit || 50}
          sort: HEIGHT_DESC
        ) {
          edges {
            node {
              id
              tags {
                name
                value
              }
              block {
                height
                timestamp
              }
            }
          }
        }
      }
    `;

    const response = await fetch(`${ARWEAVE_GATEWAY}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();

    if (result.data && result.data.transactions) {
      return result.data.transactions.edges.map(edge => {
        const tags = {};
        edge.node.tags.forEach(tag => {
          tags[tag.name] = tag.value;
        });

        return {
          txId: edge.node.id,
          name: tags['Model-Name'] || 'Unnamed',
          version: tags['Model-Version'] || '1.0.0',
          modelType: tags['Model-Type'] || 'general',
          size: parseInt(tags['Model-Size']) || 0,
          creator: tags['Creator'] || 'anonymous',
          description: tags['Description'] || '',
          accuracy: parseFloat(tags['Accuracy']) || 0,
          createdAt: parseInt(tags['Created-At']) || 0,
          blockHeight: edge.node.block?.height || null,
          timestamp: edge.node.block?.timestamp || null,
          url: `${ARWEAVE_GATEWAY}/${edge.node.id}`,
          tags: edge.node.tags.filter(t => t.name === 'Tag').map(t => t.value)
        };
      });
    }

    return [];
  } catch (error) {
    console.error('Error querying models:', error);
    return [];
  }
}

/**
 * Estimate upload cost
 * @param {number} sizeInBytes - File size in bytes
 * @returns {Promise<{ar: number, usd: number}>}
 */
export async function estimateUploadCost(sizeInBytes) {
  try {
    const winston = await arweave.transactions.getPrice(sizeInBytes);
    const ar = parseFloat(arweave.ar.winstonToAr(winston));

    // Approximate USD price (check real-time AR price)
    const arPriceUSD = 8.5; // Approximate, should fetch from API
    const usd = ar * arPriceUSD;

    return {
      ar: ar,
      usd: usd,
      winston: winston
    };
  } catch (error) {
    console.error('Error estimating cost:', error);
    return { ar: 0, usd: 0, winston: '0' };
  }
}

/**
 * Check if transaction is confirmed
 * @param {string} txId - Transaction ID
 * @param {number} maxAttempts - Maximum polling attempts
 * @returns {Promise<boolean>}
 */
export async function waitForConfirmation(txId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getTransactionStatus(txId);

    if (status.confirmed) {
      return true;
    }

    // Wait 10 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  return false;
}

/**
 * Get Arweave network info
 * @returns {Promise<Object>}
 */
export async function getNetworkInfo() {
  try {
    const info = await arweave.network.getInfo();
    return {
      height: info.height,
      current: info.current,
      blocks: info.blocks,
      peers: info.peers,
      queueLength: info.queue_length,
      nodeVersion: info.release
    };
  } catch (error) {
    console.error('Error getting network info:', error);
    return null;
  }
}

/**
 * Verify model integrity using Arweave transaction
 * @param {string} txId - Transaction ID
 * @param {ArrayBuffer} modelData - Downloaded model data
 * @returns {Promise<boolean>}
 */
export async function verifyModelIntegrity(txId, modelData) {
  try {
    // Get transaction
    const tx = await arweave.transactions.get(txId);

    // Get data from transaction
    const txData = tx.get('data', { decode: true, string: false });

    // Compare
    const downloadedArray = new Uint8Array(modelData);
    const txArray = new Uint8Array(txData);

    if (downloadedArray.length !== txArray.length) {
      console.error('Size mismatch');
      return false;
    }

    // Compare byte by byte (for small files, use hash for large files)
    for (let i = 0; i < downloadedArray.length; i++) {
      if (downloadedArray[i] !== txArray[i]) {
        console.error('Content mismatch at byte', i);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error verifying integrity:', error);
    return false;
  }
}

/**
 * Format size for display
 * @param {number} bytes - Size in bytes
 * @returns {string}
 */
export function formatSize(bytes) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

/**
 * Get model URL
 * @param {string} txId - Transaction ID
 * @returns {string}
 */
export function getModelUrl(txId) {
  return `${ARWEAVE_GATEWAY}/${txId}`;
}

/**
 * Check if wallet has sufficient AR balance
 * @param {string} address - Arweave wallet address
 * @param {number} sizeInBytes - File size to upload
 * @returns {Promise<boolean>}
 */
export async function hasSufficientBalance(address, sizeInBytes) {
  try {
    const balance = await getArweaveBalance(address);
    const cost = await estimateUploadCost(sizeInBytes);

    return balance >= cost.ar;
  } catch (error) {
    console.error('Error checking balance:', error);
    return false;
  }
}

export default {
  arweave,
  generateArweaveWallet,
  getArweaveBalance,
  uploadModelToArweave,
  uploadMetadataToArweave,
  downloadModelFromArweave,
  getModelMetadataFromArweave,
  getTransactionStatus,
  queryModels,
  estimateUploadCost,
  waitForConfirmation,
  getNetworkInfo,
  verifyModelIntegrity,
  formatSize,
  getModelUrl,
  hasSufficientBalance
};
