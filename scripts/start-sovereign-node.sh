#!/bin/bash
# =============================================================================
# Clawd Sovereign Compute Node Setup & Launch Script
# =============================================================================
# This script installs dependencies and launches a sovereign compute node
# Usage: bash scripts/start-sovereign-node.sh [options]
#
# Options:
#   --type <type>        Node type: compute, validator, router, hybrid (default: compute)
#   --region <region>    Geographic region (default: us-east)
#   --wallet <address>   Solana wallet address (default: from .env or auto-detect)
#   --sessions <num>     Max concurrent sessions (default: 50)
#   --commission <rate>  Router commission rate 1-50 (default: 10)
#   --daemon             Run as background daemon
#   --help               Show this help message
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Default config
NODE_TYPE="compute"
REGION="us-east"
WALLET=""
MAX_SESSIONS=50
COMMISSION_RATE=10
RUN_AS_DAEMON=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --type) NODE_TYPE="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --wallet) WALLET="$2"; shift 2 ;;
    --sessions) MAX_SESSIONS="$2"; shift 2 ;;
    --commission) COMMISSION_RATE="$2"; shift 2 ;;
    --daemon) RUN_AS_DAEMON=true; shift ;;
    --help)
      echo -e "${CYAN}Clawd Sovereign Compute Node${NC}"
      echo "Launch a decentralized compute/validator/router node"
      echo ""
      echo "Usage: bash $0 [options]"
      echo ""
      echo "Options:"
      echo "  --type <type>        Node type: compute, validator, router, hybrid"
      echo "  --region <region>    Geographic region"
      echo "  --wallet <address>   Solana wallet address"
      echo "  --sessions <num>     Max concurrent sessions"
      echo "  --commission <rate>  Router commission rate 1-50"
      echo "  --daemon             Run as background daemon"
      echo "  --help               Show this help"
      exit 0
      ;;
    *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
  esac
done

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        Clawd Sovereign Compute Node Launcher            ║"
echo "║  ${CYAN}Decentralized AI & Compute on Solana SVM${PURPLE}            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js is not installed. Install it first:${NC}"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
  echo -e "${RED}✗ npm is not installed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ npm $(npm --version)${NC}"

# Detect platform
PLATFORM="linux"
case "$(uname -s)" in
  Darwin*) PLATFORM="mac" ;;
  Linux*)  PLATFORM="linux" ;;
  MINGW*|MSYS*) PLATFORM="windows" ;;
esac
echo -e "${GREEN}✓ Platform: ${PLATFORM}${NC}"

# Platform uptime boost
declare -A BOOSTS
BOOSTS[linux]=2
BOOSTS[mac]=2
BOOSTS[windows]=2
BOOSTS[android]=3
BOOST=${BOOSTS[$PLATFORM]:-1}
echo -e "${GREEN}✓ Uptime boost: ${BOOST}x${NC}"

# Install dependencies
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$PROJECT_DIR"

if [ ! -d "node_modules" ]; then
  npm install --production 2>&1 | tail -1
  echo -e "${GREEN}✓ Dependencies installed${NC}"
else
  echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Load wallet from .env if not provided
if [ -z "$WALLET" ] && [ -f ".env" ]; then
  WALLET=$(grep -E "^VITE_TREASURY_ADDRESS=" .env | cut -d= -f2)
  echo -e "${GREEN}✓ Wallet loaded from .env${NC}"
fi

if [ -z "$WALLET" ]; then
  echo ""
  echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║  No wallet address provided            ║${NC}"
  echo -e "${YELLOW}║  Set VITE_TREASURY_ADDRESS in .env     ║${NC}"
  echo -e "${YELLOW}║  or pass --wallet <address>             ║${NC}"
  echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
  echo ""
  read -rp "Enter your Solana wallet address (or leave empty for headless): " WALLET
fi

# Summary
echo ""
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Node Configuration                    ║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════╣${NC}"
printf "${CYAN}║  %-20s %-20s ║${NC}\n" "Type:" "$NODE_TYPE"
printf "${CYAN}║  %-20s %-20s ║${NC}\n" "Region:" "$REGION"
printf "${CYAN}║  %-20s %-20s ║${NC}\n" "Platform:" "$PLATFORM"
printf "${CYAN}║  %-20s %-20s ║${NC}\n" "Uptime Boost:" "${BOOST}x"
printf "${CYAN}║  %-20s %-20s ║${NC}\n" "Max Sessions:" "$MAX_SESSIONS"
printf "${CYAN}║  %-20s %-20s ║${NC}\n" "Commission:" "${COMMISSION_RATE}%"
if [ -n "$WALLET" ]; then
  WALLET_SHORT="${WALLET:0:6}...${WALLET: -4}"
  printf "${CYAN}║  %-20s %-20s ║${NC}\n" "Wallet:" "$WALLET_SHORT"
fi
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# Launch node
echo -e "${GREEN}Starting ${NODE_TYPE} node in ${REGION}...${NC}"
echo ""

if [ "$RUN_AS_DAEMON" = true ]; then
  # Run as daemon
  LOG_FILE="$PROJECT_DIR/node-${NODE_TYPE}-${REGION}.log"
  echo -e "${YELLOW}Running as daemon (PID: $$)${NC}"
  echo -e "${YELLOW}Log file: ${LOG_FILE}${NC}"

  nohup node -e "
    const { ClawdSovereignNode, NODE_TYPE, createSovereignNode, createValidatorNode, createRouterNode, createHybridNode } = require('./src/utils/sovereignNode.js');
    const config = {
      wallet: '${WALLET:-unknown}',
      region: '${REGION}',
      maxConcurrentSessions: ${MAX_SESSIONS},
      commissionRate: ${COMMISSION_RATE}/100,
      platform: '${PLATFORM}',
    };
    let node;
    switch('${NODE_TYPE}') {
      case 'validator': node = createValidatorNode(config); break;
      case 'router': node = createRouterNode(config); break;
      case 'hybrid': node = createHybridNode(config); break;
      default: node = createSovereignNode(config);
    }
    node.register({ ownerWallet: '${WALLET:-unknown}' }).then(() => node.start()).then(status => {
      console.log('Node started:', JSON.stringify(status, null, 2));
      setInterval(() => {
        const report = node._getStatusReport();
        console.log('Heartbeat:', report.metrics.reputationScore, 'sessions:', report.metrics.sessionsProcessed, 'uptime:', report.metrics.uptimeHours.toFixed(2) + 'h');
      }, 60000);
    }).catch(err => { console.error('Node error:', err); process.exit(1); });
  " > "$LOG_FILE" 2>&1 &

  echo -e "${GREEN}✓ Node launched in background${NC}"
  echo -e "${GREEN}✓ To stop: kill $!${NC}"
  echo ""
  echo -e "${BLUE}Run the frontend:${NC}"
  echo "  npm run dev"
  echo ""
  echo -e "${BLUE}Check node status API:${NC}"
  echo "  curl http://localhost:5001/api/sovereign-node/network-stats"
else
  # Run in foreground
  echo -e "${GREEN}Starting node in foreground. Press Ctrl+C to stop.${NC}"
  echo ""
  node -e "
    const { ClawdSovereignNode, NODE_TYPE, createSovereignNode, createValidatorNode, createRouterNode, createHybridNode } = require('./src/utils/sovereignNode.js');
    const config = {
      wallet: '${WALLET:-unknown}',
      region: '${REGION}',
      maxConcurrentSessions: ${MAX_SESSIONS},
      commissionRate: ${COMMISSION_RATE}/100,
      platform: '${PLATFORM}',
    };
    let node;
    switch('${NODE_TYPE}') {
      case 'validator': node = createValidatorNode(config); break;
      case 'router': node = createRouterNode(config); break;
      case 'hybrid': node = createHybridNode(config); break;
      default: node = createSovereignNode(config);
    }
    node.register({ ownerWallet: '${WALLET:-unknown}' }).then(() => node.start()).then(status => {
      console.log(JSON.stringify(status, null, 2));
      // Simulate some traffic
      let packetCount = 0;
      const sim = setInterval(() => {
        if (packetCount >= 20) { clearInterval(sim); return; }
        const payload = JSON.stringify({ type: 'web_request', ts: Date.now(), data: { seq: packetCount } });
        node.processTransaction({
          payload, trafficType: Math.random() > 0.3 ? 'PET' : 'FET',
          destinationUrl: 'https://api.mainnet-beta.solana.com',
          metadata: { expectedFields: ['type', 'ts', 'data'] }
        }).then(r => {
          if (r.success) {
            packetCount++;
            const rep = r.reputation.currentScore;
            const fee = r.gasFee.gasFee;
            process.stdout.write('\r' + ' '.repeat(60) + '\r');
            process.stdout.write('Sessions: ' + packetCount + ' | Rep: ' + rep.toFixed(4) + ' | Fee: ' + fee.toFixed(4) + ' | Rewards: ' + (node.metrics.totalRewards / 1e9).toFixed(6) + ' SOL');
          }
        }).catch(() => {});
      }, 2000);
    });
  "
fi