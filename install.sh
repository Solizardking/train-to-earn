#!/usr/bin/env bash
# Train2Earn — one-shot install
# Usage: curl -fsSL https://raw.githubusercontent.com/Solizardking/traintoearn/main/install.sh | bash

set -e

REPO="https://github.com/Solizardking/traintoearn.git"
DIR="traintoearn"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ████████╗██████╗  █████╗ ██╗███╗   ██╗██████╗ ███████╗ █████╗ ██████╗ ███╗   ██╗"
echo "     ██╔══╝██╔══██╗██╔══██╗██║████╗  ██║╚════██╗██╔════╝██╔══██╗██╔══██╗████╗  ██║"
echo "     ██║   ██████╔╝███████║██║██╔██╗ ██║ █████╔╝█████╗  ███████║██████╔╝██╔██╗ ██║"
echo "     ██║   ██╔══██╗██╔══██║██║██║╚██╗██║██╔═══╝ ██╔══╝  ██╔══██║██╔══██╗██║╚██╗██║"
echo "     ██║   ██║  ██║██║  ██║██║██║ ╚████║███████╗███████╗██║  ██║██║  ██║██║ ╚████║"
echo "     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝"
echo -e "${NC}"
echo -e "${GREEN}On-Chain AI Protocol for Solana — powered by CLAWD${NC}"
echo ""

# ── Check requirements ─────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || { echo "Node.js 18+ is required. Install from https://nodejs.org"; exit 1; }
command -v git  >/dev/null 2>&1 || { echo "git is required."; exit 1; }

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js 18+ required (you have $(node -v)). Upgrade at https://nodejs.org"
  exit 1
fi

# ── Clone ──────────────────────────────────────────────────────────────────
if [ -d "$DIR" ]; then
  echo -e "${YELLOW}Directory '$DIR' already exists — pulling latest instead${NC}"
  git -C "$DIR" pull origin main
else
  git clone "$REPO" "$DIR"
fi

cd "$DIR"

# ── Install dependencies ───────────────────────────────────────────────────
echo ""
echo -e "${CYAN}Installing dependencies...${NC}"
npm install --silent

# ── Environment setup ──────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ""
  echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║  IMPORTANT: Fill in your API keys in .env before starting   ║${NC}"
  echo -e "${YELLOW}║                                                              ║${NC}"
  echo -e "${YELLOW}║  Required:                                                   ║${NC}"
  echo -e "${YELLOW}║    HELIUS_API_KEY   → https://helius.dev  (free tier)        ║${NC}"
  echo -e "${YELLOW}║    OPENROUTER_API_KEY → https://openrouter.ai (free tier)    ║${NC}"
  echo -e "${YELLOW}║                                                              ║${NC}"
  echo -e "${YELLOW}║  Optional (more features):                                   ║${NC}"
  echo -e "${YELLOW}║    XAI_API_KEY      → https://x.ai  (CLAWD file agent)      ║${NC}"
  echo -e "${YELLOW}║    PINATA_JWT       → https://pinata.cloud  (IPFS pinning)   ║${NC}"
  echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
else
  echo -e "${GREEN}.env already exists — skipping${NC}"
fi

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "  Next steps:"
echo "  1. Edit ${CYAN}.env${NC} with your API keys"
echo "  2. Run ${CYAN}npm run dev${NC} to start (frontend on :3000, backend on :5001)"
echo "  3. Open ${CYAN}http://localhost:3000${NC} and connect your Solana wallet"
echo ""
echo -e "  Docs: ${CYAN}https://github.com/Solizardking/traintoearn/tree/main/docs${NC}"
echo -e "  Live: ${CYAN}https://earn.x402.wtf${NC}"
echo ""
