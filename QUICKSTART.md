# Quick Start Guide

## Step 1: Install Dependencies (Already Done!)
```bash
npm install
```

## Step 2: Start the Application

### Option A: Run Both Frontend and Backend (Recommended)
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5001`
- Frontend on `http://localhost:3000`

### Option B: Run Separately

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run client
```

## Step 3: Connect Your Wallet

1. Open `http://localhost:3000` in your browser
2. Click "Select Wallet" button in the top right
3. Choose your Solana wallet (Phantom, Solflare, or Backpack)
4. Approve the connection

## Step 4: Explore Your Assets

Once connected, the platform will automatically:
- Load all your Solana assets (NFTs, tokens, compressed NFTs)
- Display your SOL balance
- Calculate your training rewards based on portfolio activity

## Step 5: Get AI Insights

Click the "Generate Insights" button to receive:
- Portfolio analysis
- Collection insights
- Personalized recommendations
- Training suggestions

## Features Overview

### 1. Asset Discovery
- View all NFTs, tokens, and compressed assets
- Filter by asset type
- See detailed metadata and images

### 2. Reward System
Earn TRAIN tokens based on:
- **Base Reward**: 10 TRAIN
- **Asset Bonus**: Up to 50 TRAIN (0.5 per asset)
- **Token Bonus**: Up to 30 TRAIN (0.3 per token)
- **Activity Multiplier**: 1.5x for 10+ assets

### 3. Tier System
- 🔹 Diamond: 100+ TRAIN
- ⭐ Platinum: 75-99 TRAIN
- 🏆 Gold: 50-74 TRAIN
- ⚪ Silver: 25-49 TRAIN
- 🔥 Bronze: 0-24 TRAIN

### 4. AI Analysis
Powered by NVIDIA Llama 3.3 Nemotron via OpenRouter:
- Portfolio overview
- Notable collections
- Engagement level assessment
- Actionable recommendations

## API Endpoints

The backend exposes these endpoints:

- `POST /api/assets/search` - Search wallet assets (Helius searchAssets)
- `POST /api/tokens/accounts` - Get token accounts (Helius getTokenAccounts)
- `POST /api/nft/editions` - Get NFT editions (Helius getNftEditions)
- `POST /api/ai/analyze` - Generate AI portfolio analysis
- `POST /api/rewards/calculate` - Calculate training rewards

## Troubleshooting

### Wallet Not Connecting
- Make sure you have a Solana wallet extension installed
- Try refreshing the page
- Check if wallet is unlocked

### No Assets Showing
- Verify your wallet has assets on Solana mainnet
- Check browser console for errors
- Ensure Helius API key is valid in [.env](./.env)

### AI Analysis Not Working
- Verify OpenRouter API key in [.env](./.env)
- Check if you have sufficient credits
- Look for errors in backend console

### Backend Not Starting
- Make sure port 5001 is available
- Check `.env` file exists with all required keys
- Run `npm install` again if needed

### RPC Smoke Test
```bash
npm run smoke:rpc              # checks the running backend proxy
npm run smoke:rpc -- --direct  # checks the configured upstream RPC
```

## Environment Variables

Your [.env](./.env) should have:
```env
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
HELIUS_API_KEY=your_helius_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=nvidia/llama-3.3-nemotron-super-49b-v1.5
JUPITER_API_KEY=your_jupiter_api_key
```

## Next Steps

1. **Explore the codebase** - Check out the components in `src/components/`
2. **Customize rewards** - Edit the reward calculation in [server/index.js](./server/index.js:123)
3. **Add more features** - Integrate Jupiter for trading, add more AI models
4. **Deploy** - Build and deploy to production

## Need Help?

- Check [README.md](./README.md) for detailed documentation
- Review Helius docs: https://docs.helius.dev/
- OpenRouter docs: https://openrouter.ai/docs
- Solana docs: https://docs.solana.com/

Enjoy your Train2Earn platform! 🚀
