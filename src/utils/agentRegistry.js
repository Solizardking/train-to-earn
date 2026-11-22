import { PublicKey } from '@solana/web3.js';

export const AGENT_REGISTRATION_SCHEMA = 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';
export const METAPLEX_AGENT_REGISTRY_ID = 'solana:101:metaplex';

export const DEFAULT_CLAWD_ZK_RPC_URL = '/api/solana/rpc';
export const DEFAULT_CLAWD_ZK_PHOTON_URL = '/api/solana/rpc';
export const DEFAULT_CLAWD_ZK_NETWORK = 'mainnet';
export const DEFAULT_CLAWD_FREE_CHAT_WEB_URL = 'https://zk.x402.wtf/free';
export const DEFAULT_CLAWD_FREE_CHAT_API_URL = 'https://zk.x402.wtf/api/free/chat';
export const DEFAULT_CLAWD_CHAT_URL = DEFAULT_CLAWD_FREE_CHAT_WEB_URL;
export const DEFAULT_CLAWD_CHAT_API_URL = DEFAULT_CLAWD_FREE_CHAT_API_URL;

export const AGENT_TRUST_MODELS = [
  'reputation',
  'crypto-economic',
  'zk-attestation',
  'agent-registry',
];

export const FALLBACK_CLAWD_AGENTS = [
  {
    id: 'clawd-router-runtime',
    name: 'Clawd Router Runtime',
    description: 'OpenAI-compatible LLM router for Solana Clawd agents with x402 payment checks, holder tiers, and provider scoring.',
    category: 'infrastructure',
    tags: ['solana', 'clawd', 'router', 'llm', 'x402'],
    capabilities: ['llm-routing', 'model-scoring', 'x402-payment-verification', 'read-only'],
    metaplexSkills: ['agent-registry'],
  },
  {
    id: 'clawd-gateway-runtime',
    name: 'Clawd Gateway Runtime',
    description: 'Gateway runtime for payment-enabled Solana agents, API access, and merchant routing.',
    category: 'payments',
    tags: ['solana', 'clawd', 'gateway', 'payments', 'x402'],
    capabilities: ['payment-gateway', 'api-routing', 'read-only'],
    metaplexSkills: ['agent-registry'],
  },
  {
    id: 'clawd-operator-runtime',
    name: 'Clawd Operator Runtime',
    description: 'Autonomous operator-loop runtime for coordinating multi-adapter agent execution with checkpoints and metrics.',
    category: 'infrastructure',
    tags: ['clawd', 'operator', 'orchestration', 'a2a'],
    capabilities: ['agent-orchestration', 'checkpoints', 'a2a-message'],
    metaplexSkills: ['agent-registry'],
  },
  {
    id: 'solana-pumpfun-bot',
    name: 'Solana PumpFun/PumpSwap Copy Trading Bot',
    description: 'High-performance copy trading agent for PumpFun bonding curves, PumpSwap AMM pools, and Raydium routes.',
    category: 'trading',
    tags: ['solana', 'pumpfun', 'pumpswap', 'copy-trading', 'defi'],
    capabilities: ['swap-execution', 'read-only', 'a2a-message'],
    metaplexSkills: ['agent-registry'],
  },
  {
    id: 'solana-clawd-wallet-guardian',
    name: 'Solana Clawd Wallet Guardian',
    description: 'Wallet safety, approval policy, and prompt-injection defense for paid Solana agents.',
    category: 'security',
    tags: ['solana', 'wallet', 'security', 'payments', 'policy'],
    capabilities: ['wallet-inspection', 'approval-policy', 'read-only'],
    metaplexSkills: ['agent-registry'],
  },
  {
    id: 'solana-x402-provider-catalog',
    name: 'Solana x402 Provider Catalog',
    description: 'Provider discovery, cost-aware routing, and catalog selection for paid x402 workflows.',
    category: 'payments',
    tags: ['x402', 'providers', 'catalog', 'routing'],
    capabilities: ['provider-discovery', 'cost-scoring', 'read-only'],
    metaplexSkills: ['agent-registry'],
  },
  {
    id: 'solana-helius-specialist',
    name: 'Solana Helius Specialist',
    description: 'Helius DAS, webhook, and enhanced transaction analysis specialist.',
    category: 'infrastructure',
    tags: ['solana', 'helius', 'das', 'webhooks'],
    capabilities: ['das-queries', 'read-only'],
    metaplexSkills: ['agent-registry'],
  },
  {
    id: 'solana-protocol-auditor',
    name: 'Solana Protocol Auditor',
    description: 'Protocol review agent for Solana program architecture, risk surfaces, and implementation checks.',
    category: 'security',
    tags: ['solana', 'audit', 'programs', 'security'],
    capabilities: ['protocol-review', 'risk-analysis', 'read-only'],
    metaplexSkills: ['agent-registry'],
  },
  {
    id: 'solana-market-maker',
    name: 'Solana Market Maker',
    description: 'Market-making strategy agent for spreads, inventory, and venue-aware execution planning.',
    category: 'trading',
    tags: ['solana', 'market-making', 'defi', 'risk'],
    capabilities: ['strategy-planning', 'inventory-risk', 'read-only'],
    metaplexSkills: ['agent-registry'],
  },
  {
    id: 'solana-token-launcher',
    name: 'Solana Token Launcher',
    description: 'Token launch planning agent for mint configuration, metadata, liquidity, and launch safety.',
    category: 'dev-tools',
    tags: ['solana', 'token', 'launch', 'metaplex'],
    capabilities: ['token-planning', 'metadata', 'read-only'],
    metaplexSkills: ['agent-registry', 'token-metadata'],
  },
  {
    id: 'solana-risk-sentinel',
    name: 'Solana Risk Sentinel',
    description: 'Portfolio, protocol, and execution risk monitoring for Solana agents.',
    category: 'analytics',
    tags: ['solana', 'risk', 'portfolio', 'monitoring'],
    capabilities: ['risk-monitoring', 'alerts', 'read-only'],
    metaplexSkills: ['agent-registry'],
  },
  {
    id: 'solana-openclawd-orchestrator',
    name: 'Solana OpenClawd Orchestrator',
    description: 'Multi-agent orchestration profile for routing Solana tasks across OpenClawd agents and skills.',
    category: 'infrastructure',
    tags: ['solana', 'openclawd', 'orchestration', 'skills'],
    capabilities: ['agent-routing', 'skill-routing', 'a2a-message'],
    metaplexSkills: ['agent-registry'],
  },
];

export function isValidAgentPublicKey(value) {
  try {
    if (!value) return false;
    new PublicKey(value);
    return true;
  } catch (_error) {
    return false;
  }
}

export function slugifyAgentName(value) {
  return String(value || 'clawd-agent')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64) || 'clawd-agent';
}

export function normalizeAgentServices(input = {}, config = {}) {
  const services = [];
  const chatEndpoint = input.chatEndpoint || config.chatEndpoint || DEFAULT_CLAWD_FREE_CHAT_API_URL;
  const webEndpoint = input.webEndpoint || config.chatWebUrl || DEFAULT_CLAWD_FREE_CHAT_WEB_URL;
  const rpcEndpoint = input.rpcEndpoint || config.rpcUrl || DEFAULT_CLAWD_ZK_RPC_URL;
  const photonEndpoint = input.photonEndpoint || config.photonUrl || DEFAULT_CLAWD_ZK_PHOTON_URL;

  services.push({ name: 'chat', endpoint: chatEndpoint });
  services.push({ name: 'web', endpoint: webEndpoint });
  services.push({ name: 'solana-rpc', endpoint: rpcEndpoint });
  services.push({ name: 'photon-rpc', endpoint: photonEndpoint });

  for (const service of input.services || []) {
    if (!service?.name || !service?.endpoint) continue;
    const duplicate = services.some((existing) => (
      existing.name === service.name && existing.endpoint === service.endpoint
    ));
    if (!duplicate) services.push({ name: service.name, endpoint: service.endpoint });
  }

  return services;
}

export function createAgentMetadata(input = {}, config = {}) {
  const name = String(input.name || 'Clawd Solana Agent').trim();
  const description = String(input.description || 'A Solana agent registered through Train2Earn.').trim();

  return {
    type: 'agent',
    name,
    description,
    services: normalizeAgentServices(input, config).map(({ name: serviceName, endpoint }) => ({
      name: serviceName,
      endpoint,
    })),
    registrations: input.registrations || [],
    supportedTrust: input.supportedTrust?.length ? input.supportedTrust : AGENT_TRUST_MODELS,
  };
}

export const createAgentMintMetadata = createAgentMetadata;

export function createAgentNftMetadata(input = {}, config = {}) {
  const name = String(input.name || 'Clawd Solana Agent').trim();
  const description = String(input.description || 'A Solana agent registered through Train2Earn.').trim();
  const image = input.image || config.defaultImage || 'https://arweave.net/agent-avatar-tx-hash';
  const category = input.category || 'agent';
  const tags = Array.isArray(input.tags)
    ? input.tags
    : String(input.tags || 'solana,clawd,agent')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

  return {
    name,
    symbol: input.symbol || 'CLAWD',
    description,
    image,
    external_url: input.externalUrl || config.chatWebUrl || DEFAULT_CLAWD_FREE_CHAT_WEB_URL,
    attributes: [
      { trait_type: 'Category', value: category },
      { trait_type: 'Network', value: config.network || DEFAULT_CLAWD_ZK_NETWORK },
      { trait_type: 'Runtime', value: 'Clawd ZK Agent' },
      { trait_type: 'Registry', value: METAPLEX_AGENT_REGISTRY_ID },
    ],
    properties: {
      category,
      files: [{ uri: image, type: 'image/png' }],
      creators: input.creator ? [{ address: input.creator, share: 100 }] : [],
      tags,
      clawd: {
        rpcUrl: config.rpcUrl || DEFAULT_CLAWD_ZK_RPC_URL,
        photonUrl: config.photonUrl || DEFAULT_CLAWD_ZK_PHOTON_URL,
        network: config.network || DEFAULT_CLAWD_ZK_NETWORK,
        chatEndpoint: config.chatEndpoint || DEFAULT_CLAWD_FREE_CHAT_API_URL,
      },
    },
  };
}

export function createAgentRegistrationDocument(input = {}, config = {}) {
  const metadata = createAgentMetadata(input, config);
  const image = input.image || config.defaultImage || 'https://arweave.net/agent-avatar-tx-hash';

  return {
    type: AGENT_REGISTRATION_SCHEMA,
    name: metadata.name,
    description: metadata.description,
    image,
    services: normalizeAgentServices(input, config).map((service) => ({
      ...service,
      version: service.version || (service.name === 'chat' ? '2026-07-03' : undefined),
    })),
    active: input.active ?? true,
    registrations: input.asset ? [
      { agentId: input.asset, agentRegistry: METAPLEX_AGENT_REGISTRY_ID },
    ] : [],
    supportedTrust: metadata.supportedTrust,
    clawd: {
      rpcUrl: config.rpcUrl || DEFAULT_CLAWD_ZK_RPC_URL,
      photonUrl: config.photonUrl || DEFAULT_CLAWD_ZK_PHOTON_URL,
      network: config.network || DEFAULT_CLAWD_ZK_NETWORK,
      catalogPaths: config.catalogPaths || [],
    },
  };
}

export function createAgentMintPayload(input = {}, config = {}) {
  const agentMetadata = createAgentMetadata(input, config);
  return {
    wallet: input.wallet,
    network: input.network || 'solana-mainnet',
    name: agentMetadata.name,
    uri: input.uri,
    agentMetadata,
  };
}

export function validateAgentMintInput(input = {}) {
  const errors = [];
  const wallet = input.wallet || input.owner;

  if (!wallet || !isValidAgentPublicKey(wallet)) {
    errors.push('wallet/owner must be a valid Solana public key');
  }
  if (!String(input.name || '').trim()) errors.push('name is required');
  if (!String(input.description || '').trim()) errors.push('description is required');
  if (input.uri && !/^https?:\/\//i.test(input.uri)) {
    errors.push('uri must be a publicly accessible http(s) URL');
  }

  return errors;
}

export const validateAgentInput = validateAgentMintInput;

export function networkToMetaplexNetwork(network = DEFAULT_CLAWD_ZK_NETWORK) {
  if (network === 'devnet' || network === 'solana-devnet') return 'solana-devnet';
  if (network === 'localnet') return 'localnet';
  if (network === 'sonic-mainnet' || network === 'sonic-devnet') return network;
  if (network === 'eclipse-mainnet') return network;
  if (network === 'fogo-mainnet' || network === 'fogo-testnet') return network;
  return 'solana-mainnet';
}

export function createClawdAccess(input = {}) {
  return {
    network: input.network || DEFAULT_CLAWD_ZK_NETWORK,
    rpcUrl: input.rpcUrl || DEFAULT_CLAWD_ZK_RPC_URL,
    photonUrl: input.photonUrl || input.rpcUrl || DEFAULT_CLAWD_ZK_PHOTON_URL,
    chatUrl: input.chatUrl || DEFAULT_CLAWD_FREE_CHAT_WEB_URL,
    chatApiUrl: input.chatApiUrl || DEFAULT_CLAWD_FREE_CHAT_API_URL,
    catalogs: input.catalogs || {},
    catalogPaths: input.catalogPaths || [],
  };
}

export function normalizeCatalogAgent(raw = {}, sourcePath = '') {
  const meta = raw.meta || {};
  const config = raw.config || {};
  const id = raw.identifier || raw.id || sourcePath.split('/').pop()?.replace(/\.json$/, '') || 'agent';

  return {
    id,
    name: meta.title || raw.name || id,
    description: meta.description || raw.description || config.openingMessage || '',
    category: meta.category || raw.category || 'agent',
    tags: meta.tags || raw.tags || [],
    author: raw.author || null,
    homepage: raw.homepage || null,
    capabilities: raw.capabilities || raw.solana?.capabilities || [],
    metaplexSkills: raw.metaplexSkills || raw.solana?.metaplexSkills || [],
    payment: raw.payment || null,
    openingMessage: config.openingMessage || '',
    openingQuestions: config.openingQuestions || [],
    sourcePath,
  };
}
