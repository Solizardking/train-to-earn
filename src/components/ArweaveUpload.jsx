// src/components/ArweaveUpload.jsx
import { useState, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { FiUpload, FiFile, FiCheckCircle, FiAlertCircle, FiLoader } from 'react-icons/fi';
import {
  uploadModelToArweave,
  uploadMetadataToArweave,
  estimateUploadCost,
  formatSize,
  getArweaveBalance,
  generateArweaveWallet,
  waitForConfirmation
} from '../utils/arweaveStorage';

export default function ArweaveUpload() {
  const { publicKey } = useWallet();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState({
    name: '',
    version: '1.0.0',
    modelType: 'SENTIMENT_ANALYSIS',
    description: '',
    framework: 'pytorch',
    license: 'MIT',
    accuracy: '',
    tags: ''
  });

  const [arweaveWallet, setArweaveWallet] = useState(null);
  const [uploadCost, setUploadCost] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [arweaveRegistered, setArweaveRegistered] = useState(false);
  const [arweaveRegistering, setArweaveRegistering] = useState(false);
  const [error, setError] = useState(null);

  // Generate Arweave wallet
  const handleGenerateWallet = async () => {
    try {
      const wallet = await generateArweaveWallet();
      setArweaveWallet(wallet);
      alert(`Arweave wallet generated!\n\nAddress: ${wallet.address}\n\nPlease fund this wallet with AR tokens to upload models.\nSend AR to this address from an exchange or faucet.`);
    } catch (error) {
      console.error('Error generating wallet:', error);
      setError('Failed to generate Arweave wallet');
    }
  };

  // Handle file selection
  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    // Auto-fill name from filename
    if (!metadata.name) {
      setMetadata(prev => ({
        ...prev,
        name: selectedFile.name.replace(/\.[^/.]+$/, '')
      }));
    }

    // Estimate cost
    try {
      const cost = await estimateUploadCost(selectedFile.size);
      setUploadCost(cost);
    } catch (error) {
      console.error('Error estimating cost:', error);
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!file || !arweaveWallet) {
      setError('Please select a file and generate an Arweave wallet');
      return;
    }

    if (!metadata.name || !metadata.description) {
      setError('Please fill in model name and description');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Check balance
      const balance = await getArweaveBalance(arweaveWallet.address);
      console.log(`Arweave balance: ${balance} AR`);

      if (balance < uploadCost.ar) {
        throw new Error(`Insufficient AR balance. Required: ${uploadCost.ar} AR, Available: ${balance} AR`);
      }

      // Read file
      setUploadProgress(10);
      const fileBuffer = await file.arrayBuffer();

      // Prepare metadata
      const fullMetadata = {
        ...metadata,
        solanaAddress: publicKey?.toString() || '',
        creator: publicKey?.toString()?.substring(0, 8) + '...' + publicKey?.toString()?.slice(-4) || 'anonymous',
        size: file.size,
        tags: metadata.tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      // Upload metadata first
      setUploadProgress(20);
      console.log('Uploading metadata...');
      const metadataResult = await uploadMetadataToArweave(fullMetadata, arweaveWallet.key);
      console.log('Metadata uploaded:', metadataResult.txId);

      // Upload model
      setUploadProgress(40);
      console.log('Uploading model...');
      const modelResult = await uploadModelToArweave(
        new Uint8Array(fileBuffer),
        fullMetadata,
        arweaveWallet.key
      );

      setUploadProgress(80);
      console.log('Model uploaded:', modelResult.txId);

      // Wait for confirmation (optional - can take hours)
      setUploadProgress(90);
      console.log('Upload complete! Transaction pending confirmation...');

      setUploadResult({
        modelTxId: modelResult.txId,
        metadataTxId: metadataResult.txId,
        modelUrl: modelResult.url,
        cost: modelResult.cost,
        metadata: fullMetadata
      });

      setUploadProgress(100);

      // Reset form
      setFile(null);
      setMetadata({
        name: '',
        version: '1.0.0',
        modelType: 'SENTIMENT_ANALYSIS',
        description: '',
        framework: 'pytorch',
        license: 'MIT',
        accuracy: '',
        tags: ''
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="arweave-upload-container" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          background: 'linear-gradient(90deg, #9945FF 0%, #14F195 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px'
        }}>
          Upload to Arweave
        </h2>
        <p style={{ color: '#888', fontSize: '14px' }}>
          Store your AI models permanently on Arweave blockchain
        </p>
      </div>

      {/* Wallet Section */}
      <div style={{
        background: 'rgba(30, 30, 40, 0.8)',
        borderRadius: '16px',
        border: '1px solid rgba(153, 69, 255, 0.2)',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
          Arweave Wallet
        </h3>

        {!arweaveWallet ? (
          <div>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>
              Generate an Arweave wallet to upload models. You'll need AR tokens to pay for storage.
            </p>
            <button
              onClick={handleGenerateWallet}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(90deg, #9945FF 0%, #14F195 100%)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Generate Arweave Wallet
            </button>
          </div>
        ) : (
          <div>
            <div style={{
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '13px',
              color: '#14F195',
              marginBottom: '8px',
              wordBreak: 'break-all'
            }}>
              {arweaveWallet.address}
            </div>
            <p style={{ fontSize: '12px', color: '#888' }}>
              Fund this wallet with AR tokens before uploading
            </p>
          </div>
        )}
      </div>

      {/* File Upload */}
      <div style={{
        background: 'rgba(30, 30, 40, 0.8)',
        borderRadius: '16px',
        border: '1px solid rgba(153, 69, 255, 0.2)',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
          Select Model File
        </h3>

        <div
          style={{
            border: '2px dashed rgba(153, 69, 255, 0.3)',
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <FiUpload style={{ fontSize: '48px', color: '#9945FF', marginBottom: '16px' }} />
          <p style={{ color: '#fff', marginBottom: '8px' }}>
            {file ? file.name : 'Click to select model file'}
          </p>
          <p style={{ color: '#888', fontSize: '13px' }}>
            {file ? `Size: ${formatSize(file.size)}` : 'Supported: .pt, .onnx, .h5, .pb, etc.'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept=".pt,.onnx,.h5,.pb,.pth,.pkl,.bin,.safetensors"
          />
        </div>

        {uploadCost && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(20, 241, 149, 0.1)',
            borderRadius: '8px',
            fontSize: '13px'
          }}>
            <div style={{ color: '#14F195' }}>
              Estimated Cost: {uploadCost.ar.toFixed(6)} AR (~${uploadCost.usd.toFixed(2)} USD)
            </div>
          </div>
        )}
      </div>

      {/* Metadata Form */}
      {file && (
        <div style={{
          background: 'rgba(30, 30, 40, 0.8)',
          borderRadius: '16px',
          border: '1px solid rgba(153, 69, 255, 0.2)',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
            Model Metadata
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                Model Name *
              </label>
              <input
                type="text"
                value={metadata.name}
                onChange={(e) => setMetadata({ ...metadata, name: e.target.value })}
                placeholder="e.g., GPT-Nano"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                  Version
                </label>
                <input
                  type="text"
                  value={metadata.version}
                  onChange={(e) => setMetadata({ ...metadata, version: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                  Model Type
                </label>
                <select
                  value={metadata.modelType}
                  onChange={(e) => setMetadata({ ...metadata, modelType: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: '#fff',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="SENTIMENT_ANALYSIS">Sentiment Analysis</option>
                  <option value="TEXT_GENERATION">Text Generation</option>
                  <option value="IMAGE_CLASSIFICATION">Image Classification</option>
                  <option value="CODE_GENERATION">Code Generation</option>
                  <option value="PRICE_PREDICTION">Price Prediction</option>
                  <option value="DOCUMENT_ANALYSIS">Document Analysis</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                Description *
              </label>
              <textarea
                value={metadata.description}
                onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                placeholder="Describe what your model does..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#fff',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                  Framework
                </label>
                <input
                  type="text"
                  value={metadata.framework}
                  onChange={(e) => setMetadata({ ...metadata, framework: e.target.value })}
                  placeholder="e.g., pytorch"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                  License
                </label>
                <input
                  type="text"
                  value={metadata.license}
                  onChange={(e) => setMetadata({ ...metadata, license: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                  Accuracy (%)
                </label>
                <input
                  type="number"
                  value={metadata.accuracy}
                  onChange={(e) => setMetadata({ ...metadata, accuracy: e.target.value })}
                  placeholder="e.g., 94.5"
                  min="0"
                  max="100"
                  step="0.1"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={metadata.tags}
                onChange={(e) => setMetadata({ ...metadata, tags: e.target.value })}
                placeholder="e.g., nlp, transformer, bert"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Upload Button */}
      {file && arweaveWallet && (
        <button
          onClick={handleUpload}
          disabled={uploading || !metadata.name || !metadata.description}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '12px',
            border: 'none',
            background: uploading
              ? 'rgba(153, 69, 255, 0.3)'
              : 'linear-gradient(90deg, #9945FF 0%, #14F195 100%)',
            color: '#fff',
            fontSize: '16px',
            fontWeight: '600',
            cursor: uploading || !metadata.name || !metadata.description ? 'not-allowed' : 'pointer',
            opacity: uploading || !metadata.name || !metadata.description ? 0.5 : 1,
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {uploading ? (
            <>
              <FiLoader className="spinner" />
              Uploading... {uploadProgress}%
            </>
          ) : (
            <>
              <FiUpload />
              Upload to Arweave
            </>
          )}
        </button>
      )}

      {/* Progress Bar */}
      {uploading && (
        <div style={{
          height: '8px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '24px'
        }}>
          <div
            style={{
              height: '100%',
              width: `${uploadProgress}%`,
              background: 'linear-gradient(90deg, #9945FF 0%, #14F195 100%)',
              transition: 'width 0.3s'
            }}
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(255, 107, 107, 0.1)',
          border: '1px solid rgba(255, 107, 107, 0.3)',
          color: '#FF6B6B',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <FiAlertCircle />
          {error}
        </div>
      )}

      {/* Success Message */}
      {uploadResult && (
        <div style={{
          padding: '24px',
          borderRadius: '12px',
          background: 'rgba(20, 241, 149, 0.1)',
          border: '1px solid rgba(20, 241, 149, 0.3)',
          color: '#14F195'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <FiCheckCircle style={{ fontSize: '24px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Upload Successful!</h3>
          </div>

          <div style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong style={{ color: '#14F195' }}>Model TX:</strong>{' '}
              <a
                href={uploadResult.modelUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#9945FF', textDecoration: 'none' }}
              >
                {uploadResult.modelTxId}
              </a>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong style={{ color: '#14F195' }}>Metadata TX:</strong> {uploadResult.metadataTxId}
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong style={{ color: '#14F195' }}>Cost:</strong> {uploadResult.cost.toFixed(6)} AR
            </div>
          </div>

          <p style={{ fontSize: '12px', color: '#888' }}>
            Your model has been uploaded to Arweave. It will be permanently available once confirmed (2-5 minutes).
            Save your transaction ID to reference this model.
          </p>

          {!arweaveRegistered ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: '12px' }}
              disabled={arweaveRegistering}
              onClick={async () => {
                setArweaveRegistering(true);
                try {
                  const { apiPost } = await import('../utils/api');
                  await apiPost('/api/models/register', {
                    name: uploadResult.metadata?.name || 'Arweave model',
                    description: uploadResult.metadata?.description || 'Model uploaded to Arweave via TrainToEarn.',
                    artifactUri: `ar://${uploadResult.modelTxId}`,
                    modelType: uploadResult.metadata?.modelType || 'GENERAL',
                  });
                  setArweaveRegistered(true);
                } catch (err) {
                  setError(`Registry registration failed: ${err.message}`);
                } finally {
                  setArweaveRegistering(false);
                }
              }}
            >
              {arweaveRegistering ? 'Registering…' : 'Register in the TrainToEarn registry'}
            </button>
          ) : (
            <p style={{ fontSize: '13px', color: '#14F195', marginTop: '12px' }}>
              ✓ Registered — find it under the AI Models tab.
            </p>
          )}
        </div>
      )}

      {/* Info Footer */}
      <div style={{
        padding: '16px',
        background: 'rgba(153, 69, 255, 0.1)',
        borderRadius: '12px',
        border: '1px solid rgba(153, 69, 255, 0.2)',
        fontSize: '13px',
        color: '#888'
      }}>
        <strong style={{ color: '#14F195' }}>About Arweave:</strong> Arweave provides permanent, decentralized storage
        with a one-time payment. Your model will be stored forever and accessible via its transaction ID.
      </div>
    </div>
  );
}
