import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  FiCheckCircle,
  FiCpu,
  FiDatabase,
  FiExternalLink,
  FiLoader,
  FiMessageSquare,
  FiSearch,
  FiSend,
  FiShield,
  FiZap,
} from 'react-icons/fi';
import { apiGet, apiPost, API_BASE_URL } from '../utils/api';

const DEFAULT_IMAGE = '';
const MPL_CORE_PROGRAM_ID = new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');

function sdkErrorMessage(error) {
  return error?.message || 'Agent mint failed';
}

function apiErrorMessage(body, fallback) {
  if (body?.error && Array.isArray(body.details)) {
    return `${body.error}: ${body.details.join('; ')}`;
  }
  return body?.error || body?.message || body?.details || fallback;
}

function decodeBase64Transaction(value) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  try {
    return VersionedTransaction.deserialize(bytes);
  } catch (_versionedError) {
    return Transaction.from(bytes);
  }
}

function deriveAssetSigner(assetAddress) {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode('mpl-core-execute'),
      new PublicKey(assetAddress).toBuffer(),
    ],
    MPL_CORE_PROGRAM_ID,
  );

  return { address: pda.toString(), bump };
}

export default function AgentMint({ publicPreview = false }) {
  const wallet = useWallet();
  const { publicKey, connected, sendTransaction } = wallet;
  const { connection } = useConnection();
  const [config, setConfig] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [form, setForm] = useState({
    name: 'Clawd Solana Agent',
    description: 'A registered Solana agent with backend Solana access, local catalog discovery, and immediate chat access.',
    image: DEFAULT_IMAGE,
    category: 'infrastructure',
    tags: 'solana,clawd,agent,zk,x402',
  });
  const [prepared, setPrepared] = useState(null);
  const [mintResult, setMintResult] = useState(null);
  const [fundAmount, setFundAmount] = useState('0.01');
  const [lookupAsset, setLookupAsset] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const rpcUrl = connection.rpcEndpoint;
  const selectedAgent = useMemo(
    () => catalog.find((agent) => agent.id === selectedCatalogId) || null,
    [catalog, selectedCatalogId],
  );
  const canMintPrepared = prepared ? prepared.mintReady !== false : true;

  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return catalog.slice(0, 18);
    return catalog
      .filter((agent) => [
        agent.name,
        agent.description,
        agent.category,
        ...(agent.tags || []),
      ].join(' ').toLowerCase().includes(q))
      .slice(0, 18);
  }, [catalog, catalogQuery]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [configResult, catalogResult] = await Promise.allSettled([
          apiGet('/api/agents/config'),
          apiGet('/api/agents/catalog?limit=96'),
        ]);

        if (cancelled) return;
        if (configResult.status === 'fulfilled') setConfig(configResult.value);
        if (catalogResult.status === 'fulfilled') setCatalog(catalogResult.value.agents || []);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const useCatalogAgent = (agent) => {
    setSelectedCatalogId(agent.id);
    setPrepared(null);
    setMintResult(null);
    setForm({
      name: agent.name,
      description: agent.description || form.description,
      image: form.image || DEFAULT_IMAGE,
      category: agent.category || 'agent',
      tags: (agent.tags || ['solana', 'clawd', 'agent']).slice(0, 8).join(','),
    });
  };

  const updateForm = (patch) => {
    setPrepared(null);
    setMintResult(null);
    setForm((current) => ({ ...current, ...patch }));
  };

  const prepareMetadata = useCallback(async () => {
    setError('');
    setStatus('');
    setBusy('prepare');

    try {
      if (!publicKey) throw new Error('Connect a Solana wallet before preparing mint metadata.');

      const result = await apiPost('/api/agents/metadata', {
        ...form,
        owner: publicKey.toString(),
        webEndpoint: `${window.location.origin}/mint`,
      });

      setPrepared(result);
      setStatus(result.mintReady === false
        ? result.warnings?.[0] || 'Metadata prepared, but storage is not public enough for Metaplex minting.'
        : `Metadata ready via ${result.storage?.nft?.storage || 'backend storage'}.`);
      return result;
    } catch (prepareError) {
      setError(prepareError.message);
      return null;
    } finally {
      setBusy('');
    }
  }, [form, publicKey]);

  const mintAgent = useCallback(async () => {
    setError('');
    setStatus('');
    setBusy('mint');

    try {
      if (!connected || !publicKey) throw new Error('Connect a Solana wallet before minting.');
      const metadata = prepared || await prepareMetadata();
      if (!metadata) return;
      if (metadata.mintReady === false) {
        throw new Error(metadata.warnings?.[0] || 'Metadata storage is not public enough for Metaplex minting.');
      }

      if (!sendTransaction) throw new Error('Wallet does not support transaction sending.');

      const response = await fetch(`${API_BASE_URL}/api/agents/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...metadata.mintInput,
          wallet: publicKey.toString(),
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) {
        throw new Error(apiErrorMessage(body, `Metaplex mint API returned HTTP ${response.status}`));
      }

      const transaction = decodeBase64Transaction(body.tx);
      const rpcConnection = rpcUrl && rpcUrl !== connection.rpcEndpoint ? new Connection(rpcUrl, 'confirmed') : connection;
      const signature = await sendTransaction(transaction, rpcConnection, { skipPreflight: false });

      if (body.blockhash?.blockhash && body.blockhash?.lastValidBlockHeight) {
        await rpcConnection.confirmTransaction({
          signature,
          blockhash: body.blockhash.blockhash,
          lastValidBlockHeight: body.blockhash.lastValidBlockHeight,
        }, 'confirmed');
      } else {
        await rpcConnection.confirmTransaction(signature, 'confirmed');
      }

      const assetAddress = body.assetAddress?.toString();
      if (!assetAddress) throw new Error('Metaplex mint API did not return an asset address.');

      const derivedWallet = deriveAssetSigner(assetAddress);
      const readResult = await apiGet(`/api/agents/read/${assetAddress}`).catch(() => null);
      const finalResult = {
        assetAddress,
        signature,
        agentWallet: readResult?.agentWallet || derivedWallet.address,
        agentWalletBump: readResult?.agentWalletBump ?? derivedWallet.bump,
        metadataUri: metadata.uri,
        registrationUri: metadata.registrationUri,
        verified: readResult?.coreAsset || null,
        name: form.name,
        description: form.description,
      };

      setMintResult(finalResult);
      setLookupAsset(assetAddress);
      setStatus('Agent minted and ready to chat.');

      await apiPost('/api/agents/status', {
        ...finalResult,
        owner: publicKey.toString(),
      }).catch(() => null);
    } catch (mintError) {
      setError(sdkErrorMessage(mintError));
    } finally {
      setBusy('');
    }
  }, [connected, connection, form, prepareMetadata, prepared, publicKey, rpcUrl, sendTransaction]);

  const fundAgent = useCallback(async () => {
    setError('');
    setStatus('');
    setBusy('fund');

    try {
      if (!publicKey || !sendTransaction) throw new Error('Connect a wallet that can send transactions.');
      if (!mintResult?.agentWallet) throw new Error('Mint or load an agent first.');

      const lamports = Math.round(Number(fundAmount || 0) * LAMPORTS_PER_SOL);
      if (!Number.isFinite(lamports) || lamports <= 0) throw new Error('Enter a positive SOL amount.');

      const tx = new Transaction().add(SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(mintResult.agentWallet),
        lamports,
      }));
      const rpcConnection = rpcUrl && rpcUrl !== connection.rpcEndpoint ? new Connection(rpcUrl, 'confirmed') : connection;
      const signature = await sendTransaction(tx, rpcConnection);
      await rpcConnection.confirmTransaction(signature, 'confirmed');
      setStatus(`Funded agent wallet: ${signature}`);
    } catch (fundError) {
      setError(fundError.message);
    } finally {
      setBusy('');
    }
  }, [connection, fundAmount, mintResult, publicKey, rpcUrl, sendTransaction]);

  const readAgent = useCallback(async () => {
    setError('');
    setStatus('');
    setBusy('read');

    try {
      if (!lookupAsset.trim()) throw new Error('Enter an agent asset address.');
      const result = await apiGet(`/api/agents/read/${lookupAsset.trim()}`);
      setLookupResult(result);
      setMintResult({
        assetAddress: result.asset,
        agentWallet: result.agentWallet,
        agentWalletBump: result.agentWalletBump,
        registrationUri: result.registrationUri,
        name: result.coreAsset?.name || 'Loaded Clawd Agent',
        description: 'Loaded from the Metaplex Agent Registry.',
      });
      setStatus(result.registered ? 'Registered agent loaded.' : 'Asset loaded, but no agent identity was found.');
    } catch (readError) {
      setError(readError.message);
    } finally {
      setBusy('');
    }
  }, [lookupAsset]);

  const sendChat = useCallback(async () => {
    setError('');
    setBusy('chat');

    try {
      if (!chatInput.trim()) return;
      const userMessage = { role: 'user', content: chatInput.trim() };
      const nextMessages = [...chatMessages, userMessage];
      setChatMessages(nextMessages);
      setChatInput('');

      const response = await apiPost('/api/agents/chat', {
        agent: mintResult || {
          name: form.name,
          description: form.description,
        },
        message: userMessage.content,
        messages: chatMessages,
      });

      setChatMessages([...nextMessages, { role: 'assistant', content: response.reply }]);
    } catch (chatError) {
      setError(chatError.message);
    } finally {
      setBusy('');
    }
  }, [chatInput, chatMessages, form, mintResult]);

  return (
    <div className="agent-mint-shell">
      <section className="agent-mint-hero">
        <div>
          <span className="eyebrow">Metaplex Agent Registry</span>
          <h2>Mint, fund, view, and chat with Solana agents.</h2>
          <p>
            Create an MPL Core agent identity with Metaplex, attach backend Solana access,
            derive the agent wallet PDA, and use the local Clawd catalog as the launch surface.
          </p>
          <div className="agent-access-row">
            <span><FiZap /> {config?.access?.network || 'mainnet'}</span>
            <span><FiShield /> Backend access</span>
            <span><FiMessageSquare /> Clawd chat</span>
          </div>
        </div>
        <div className="agent-access-panel">
          <strong>Agent Access</strong>
          <a href={config?.access?.chatUrl || 'https://zk.x402.wtf/free'} target="_blank" rel="noreferrer">
            Open Clawd Chat <FiExternalLink />
          </a>
        </div>
      </section>

      {!connected && (
        <section className="agent-connect-strip">
          <div>
            <strong>Connect a wallet to mint on Solana.</strong>
            <span>The connected wallet pays rent and becomes the agent owner.</span>
          </div>
          <WalletMultiButton />
        </section>
      )}

      <section className="agent-mint-grid">
        <div className="agent-panel">
          <div className="agent-panel-heading">
            <FiDatabase />
            <div>
              <h3>Local Clawd Agents</h3>
              <p>{catalog.length} read-only definitions available from the configured catalog.</p>
            </div>
          </div>
          <label className="agent-search">
            <FiSearch />
            <input
              value={catalogQuery}
              onChange={(event) => setCatalogQuery(event.target.value)}
              placeholder="Search trading, x402, router, security..."
            />
          </label>
          <div className="agent-catalog-list">
            {filteredCatalog.map((agent) => (
              <button
                type="button"
                key={agent.id}
                className={`agent-catalog-row ${selectedCatalogId === agent.id ? 'is-selected' : ''}`}
                onClick={() => useCatalogAgent(agent)}
              >
                <span>{agent.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{agent.name}</strong>
                  <small>{agent.description}</small>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="agent-panel">
          <div className="agent-panel-heading">
            <FiCpu />
            <div>
              <h3>Mint Agent</h3>
              <p>Prepare metadata, sign the Metaplex mint, and register identity in one transaction.</p>
            </div>
          </div>

          <div className="agent-form-grid">
            <label>
              Name
              <input value={form.name} onChange={(event) => updateForm({ name: event.target.value })} />
            </label>
            <label>
              Category
              <input value={form.category} onChange={(event) => updateForm({ category: event.target.value })} />
            </label>
            <label className="span-2">
              Description
              <textarea value={form.description} onChange={(event) => updateForm({ description: event.target.value })} rows={4} />
            </label>
            <label>
              Image URI
              <input value={form.image} onChange={(event) => updateForm({ image: event.target.value })} placeholder="Leave blank to use the Train2Earn app icon" />
            </label>
            <label>
              Tags
              <input value={form.tags} onChange={(event) => updateForm({ tags: event.target.value })} />
            </label>
          </div>

          <div className="agent-action-row">
            <button type="button" className="btn btn-secondary" onClick={prepareMetadata} disabled={!connected || busy}>
              {busy === 'prepare' ? <FiLoader className="spin-icon" /> : <FiDatabase />} Prepare
            </button>
            <button type="button" className="btn btn-primary" onClick={mintAgent} disabled={!connected || busy || !canMintPrepared}>
              {busy === 'mint' ? <FiLoader className="spin-icon" /> : <FiZap />} Mint Agent
            </button>
          </div>

          {prepared && (
            <div className="agent-result-box">
              <FiCheckCircle />
              <div>
                <strong>{prepared.mintReady === false ? 'Metadata preview ready' : 'Metadata ready'}</strong>
                <a href={prepared.uri} target="_blank" rel="noreferrer">{prepared.uri}</a>
                {prepared.mintReady === false && <span>{prepared.warnings?.[0]}</span>}
              </div>
            </div>
          )}

          {mintResult && (
            <div className="agent-result-box is-strong">
              <FiCheckCircle />
              <div>
                <strong>{mintResult.assetAddress}</strong>
                <span>Agent wallet: {mintResult.agentWallet}</span>
                {mintResult.signature && <a href={`https://solscan.io/tx/${mintResult.signature}`} target="_blank" rel="noreferrer">View transaction</a>}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="agent-ops-grid">
        <div className="agent-panel">
          <div className="agent-panel-heading">
            <FiZap />
            <div>
              <h3>Fund Agent Wallet</h3>
              <p>The MPL Core asset signer PDA can receive SOL immediately after mint.</p>
            </div>
          </div>
          <div className="agent-inline-form">
            <input value={fundAmount} onChange={(event) => setFundAmount(event.target.value)} />
            <button type="button" className="btn btn-primary" onClick={fundAgent} disabled={!mintResult?.agentWallet || busy}>
              {busy === 'fund' ? <FiLoader className="spin-icon" /> : <FiSend />} Send SOL
            </button>
          </div>
          <small>{mintResult?.agentWallet || 'Mint or load an agent to derive its wallet PDA.'}</small>
        </div>

        <div className="agent-panel">
          <div className="agent-panel-heading">
            <FiSearch />
            <div>
              <h3>View Agent</h3>
              <p>Read a registered asset, identity URI, and asset signer PDA through the backend.</p>
            </div>
          </div>
          <div className="agent-inline-form">
            <input value={lookupAsset} onChange={(event) => setLookupAsset(event.target.value)} placeholder="Agent asset address" />
            <button type="button" className="btn btn-secondary" onClick={readAgent} disabled={busy === 'read'}>
              {busy === 'read' ? <FiLoader className="spin-icon" /> : <FiSearch />} Read
            </button>
          </div>
          {lookupResult && (
            <div className="agent-readout">
              <span>Registered: {lookupResult.registered ? 'yes' : 'not found'}</span>
              <span>Wallet: {lookupResult.agentWallet}</span>
              {lookupResult.registrationUri && <a href={lookupResult.registrationUri} target="_blank" rel="noreferrer">Registration JSON</a>}
            </div>
          )}
        </div>
      </section>

      <section className="agent-panel agent-chat-panel">
        <div className="agent-panel-heading">
            <FiMessageSquare />
            <div>
              <h3>Chat</h3>
              <p>Use the Clawd free chat route with the minted agent context and backend Solana access.</p>
            </div>
          </div>
        <div className="agent-chat-log">
          {chatMessages.length === 0 && <span>Ask the agent about its wallet, registry identity, or Solana task surface.</span>}
          {chatMessages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`agent-chat-message ${message.role}`}>
              {message.content}
            </div>
          ))}
        </div>
        <div className="agent-chat-input">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') sendChat();
            }}
            placeholder="Ask your Clawd agent..."
          />
          <button type="button" className="btn btn-primary" onClick={sendChat} disabled={busy === 'chat'}>
            {busy === 'chat' ? <FiLoader className="spin-icon" /> : <FiSend />}
          </button>
        </div>
      </section>

      {(status || error) && (
        <div className={`agent-toast ${error ? 'is-error' : ''}`}>
          {error || status}
        </div>
      )}
    </div>
  );
}
