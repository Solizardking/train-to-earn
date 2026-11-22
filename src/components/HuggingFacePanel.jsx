import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { FiCheckCircle, FiExternalLink, FiUploadCloud } from 'react-icons/fi';
import { apiPost } from '../utils/api';

// Hugging Face connect + dataset submission.
//
// The user's HF write token lives ONLY in this browser (localStorage) and
// is only ever sent to huggingface.co — TrainToEarn's servers never see it.
// Flow: connect (whoami) -> create a dataset repo under the user's own HF
// account -> commit the file into it -> optionally Jev-rate the file and/or
// register the dataset in the TrainToEarn registry.

const TOKEN_KEY = 'traintoearn_hf_token';
const MAX_FILE_BYTES = 5 * 1024 * 1024; // inline base64 commit limit we support

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function hfFetch(path, token, options = {}) {
  const resp = await fetch(`https://huggingface.co/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  return resp;
}

export default function HuggingFacePanel() {
  const { publicKey } = useWallet();
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [hfUser, setHfUser] = useState(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [datasetName, setDatasetName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [jevResult, setJevResult] = useState(null);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const connect = async (tok) => {
    const useToken = (tok ?? token).trim();
    if (!useToken) return;
    setConnectBusy(true);
    setError(null);
    try {
      const resp = await hfFetch('/whoami-v2', useToken);
      if (!resp.ok) throw new Error(`Hugging Face rejected the token (HTTP ${resp.status}). Use a token with write access.`);
      const data = await resp.json();
      setHfUser(data.name);
      localStorage.setItem(TOKEN_KEY, useToken);
      setToken(useToken);
    } catch (err) {
      setHfUser(null);
      setError(err.message);
    } finally {
      setConnectBusy(false);
    }
  };

  useEffect(() => {
    if (token) connect(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setHfUser(null);
    setResult(null);
  };

  const submit = async () => {
    setError(null);
    setResult(null);
    setJevResult(null);
    setRegistered(false);
    if (!hfUser) return setError('Connect your Hugging Face account first.');
    if (!datasetName.trim()) return setError('Give the dataset a name.');
    if (!file) return setError('Choose a file to publish.');
    if (file.size > MAX_FILE_BYTES) return setError('This uploader supports files up to 5 MB. For larger datasets, use the Hugging Face CLI and register the repo here afterwards.');

    setBusy(true);
    try {
      const repoName = datasetName.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
      const repoId = `${hfUser}/${repoName}`;

      // 1) Create the dataset repo (409 = already exists, keep going).
      const createResp = await hfFetch('/repos/create', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: repoName, type: 'dataset', private: false }),
      });
      if (!createResp.ok && createResp.status !== 409) {
        const body = await createResp.text();
        throw new Error(`Could not create the dataset repo (HTTP ${createResp.status}). ${body.slice(0, 160)}`);
      }

      // 2) Commit the data file + a dataset card README in one commit.
      const buffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const readme = [
        '---',
        'license: mit',
        '---',
        '',
        `# ${repoName}`,
        '',
        description || 'Dataset submitted via TrainToEarn.',
        '',
        `Submitted via [TrainToEarn](https://earn.onchainai.fund) — Solana training data, rated by the Jev decision engine.`,
        '',
      ].join('\n');
      const readmeB64 = btoa(unescape(encodeURIComponent(readme)));
      const ndjson = [
        JSON.stringify({ key: 'header', value: { summary: `Add ${file.name} via TrainToEarn`, description: '' } }),
        JSON.stringify({ key: 'file', value: { path: file.name, algo: 'base64', content: base64 } }),
        JSON.stringify({ key: 'file', value: { path: 'README.md', algo: 'base64', content: readmeB64 } }),
      ].join('\n');

      const commitResp = await hfFetch(`/datasets/${repoId}/commit/main`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-ndjson' },
        body: ndjson,
      });
      if (!commitResp.ok) {
        const body = await commitResp.text();
        throw new Error(`Upload failed (HTTP ${commitResp.status}). ${body.slice(0, 200)}`);
      }
      const commitData = await commitResp.json().catch(() => ({}));
      setResult({ repoId, commitUrl: commitData.commitUrl || `https://huggingface.co/datasets/${repoId}` });

      // Keep the text around for the optional Jev rating step.
      if (/\.(txt|md|json|jsonl|csv)$/i.test(file.name) || file.type.startsWith('text/')) {
        const text = new TextDecoder().decode(buffer);
        setResult((r) => ({ ...r, textSample: text.slice(0, 200000), filename: file.name }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const rateWithJev = async () => {
    if (!publicKey) return setError('Connect your Solana wallet to Jev-rate the file.');
    if (!result?.textSample) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiPost('/api/jev/rate', {
        walletAddress: publicKey.toString(),
        content: result.textSample,
        filename: result.filename || file?.name || 'hf-dataset.txt',
      });
      setJevResult(data.rating);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const registerInRegistry = async () => {
    if (!result?.repoId) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost('/api/models/register', {
        name: datasetName.trim(),
        description: description || 'Dataset submitted via TrainToEarn.',
        huggingFaceRepo: result.repoId,
        artifactUri: `https://huggingface.co/datasets/${result.repoId}`,
        modelType: 'GENERAL',
      });
      setRegistered(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={styles.panel}>
      <span className="eyebrow">Hugging Face</span>
      <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '6px 0 8px' }}>
        Publish a dataset to your Hugging Face account
      </h2>
      <p className="text-secondary" style={{ fontSize: '14px', lineHeight: 1.65, marginTop: 0 }}>
        Connect with a Hugging Face <strong>write</strong> token (create one at{' '}
        <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer">
          huggingface.co/settings/tokens
        </a>
        ). Your token stays in this browser and is only ever sent to Hugging Face —
        TrainToEarn's servers never see it. The dataset is created under{' '}
        <strong>your</strong> account, in public, with your file and a dataset card.
      </p>

      {!hfUser ? (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="hf_… write token"
            style={{ ...styles.input, flex: '1 1 260px' }}
            autoComplete="off"
          />
          <button type="button" className="btn btn-primary" onClick={() => connect()} disabled={connectBusy || !token.trim()}>
            {connectBusy ? 'Connecting…' : 'Connect Hugging Face'}
          </button>
        </div>
      ) : (
        <>
          <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', margin: '4px 0 14px' }}>
            <FiCheckCircle color="#14F195" /> Connected as <strong>{hfUser}</strong>
            <button type="button" className="btn btn-secondary" onClick={disconnect} style={{ marginLeft: '8px' }}>
              Disconnect
            </button>
          </p>

          <div style={{ display: 'grid', gap: '10px' }}>
            <input
              type="text"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder="Dataset name (e.g. solana-pda-examples)"
              style={styles.input}
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One-line description (goes on the dataset card)"
              style={styles.input}
            />
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.json,.jsonl,.csv,.parquet,.zip"
                style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
                <FiUploadCloud /> {file ? file.name : 'Choose dataset file (≤ 5 MB)'}
              </button>
              {file && <span className="text-secondary" style={{ fontSize: '13px' }}>{(file.size / 1024).toFixed(1)} KB</span>}
            </div>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Publishing…' : 'Publish dataset to Hugging Face'}
            </button>
          </div>
        </>
      )}

      {error && <p style={{ color: '#FF6B6B', fontSize: '14px', marginTop: '12px' }}>Error: {error}</p>}

      {result && (
        <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(20,241,149,0.06)', border: '1px solid rgba(20,241,149,0.25)', borderRadius: '12px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '14px' }}>
            Published:{' '}
            <a href={`https://huggingface.co/datasets/${result.repoId}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              huggingface.co/datasets/{result.repoId} <FiExternalLink size={12} />
            </a>
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {result.textSample && !jevResult && (
              <button type="button" className="btn btn-primary" onClick={rateWithJev} disabled={busy}>
                Rate this file with Jev & earn CLAWD
              </button>
            )}
            {!registered ? (
              <button type="button" className="btn btn-secondary" onClick={registerInRegistry} disabled={busy}>
                Register in the TrainToEarn registry
              </button>
            ) : (
              <span style={{ fontSize: '13px', color: '#14F195', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <FiCheckCircle /> Registered — find it under the AI Models tab
              </span>
            )}
          </div>
          {jevResult && (
            <p style={{ fontSize: '14px', marginTop: '10px' }}>
              Jev rated it <strong>{jevResult.score}/100 ({jevResult.tier})</strong> —{' '}
              <strong>+{jevResult.clawdReward} CLAWD</strong> credited to your rewards ledger
              and tracked in the live feed on the home page.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  panel: {
    background: 'linear-gradient(135deg, rgba(255, 210, 63, 0.06) 0%, rgba(153, 69, 255, 0.08) 100%)',
    border: '1px solid rgba(255, 210, 63, 0.25)',
    marginBottom: '24px',
  },
  input: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(0,0,0,0.3)',
    color: '#fff',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
  },
};
