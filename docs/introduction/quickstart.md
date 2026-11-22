# Quick Start Guide

Get up and running with Train2Earn in under 5 minutes!

## Prerequisites

Before you begin, make sure you have:

- ✅ **Node.js 18+** installed ([Download](https://nodejs.org/))
- ✅ **npm** or **yarn** package manager
- ✅ **Solana wallet** (Phantom or Solflare)
- ✅ **Modern browser** (Chrome, Firefox, or Brave)

## Step 1: Clone the Repository

```bash
git clone https://github.com/Solizardking/traintoearn.git
cd traintoearn
```

## Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- React, Vite, Express
- Solana Web3.js
- Arweave SDK
- IPFS HTTP Client
- And more...

⏱️ **Takes about 2-3 minutes**

## Step 3: Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```bash
# Required: Helius RPC for Solana
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
HELIUS_API_KEY=your_helius_api_key_here

# Optional: AI Analysis
OPENROUTER_API_KEY=your_openrouter_key_here

# Optional: Arweave (for permanent storage)
VITE_ARWEAVE_GATEWAY=https://arweave.net

# Treasury for payments
VITE_TREASURY_ADDRESS=GvMXMKhw3VHrHwc2Sw8fS2rqUJZ5Ej8jRXTzG9Y3pump
```

### Get API Keys:

1. **Helius** (Required for Solana data)
   - Visit [https://www.helius.dev/](https://www.helius.dev/)
   - Sign up for free tier (100K credits/month)
   - Copy your API key

2. **OpenRouter** (Optional for AI features)
   - Visit [https://openrouter.ai/](https://openrouter.ai/)
   - Create account
   - Add payment method
   - Generate API key

## Step 4: Start Development Server

```bash
npm run dev
```

This starts both:
- **Frontend**: http://localhost:3000 (Vite dev server)
- **Backend**: http://localhost:5001 (Express API)

✅ **Server should start in 5-10 seconds**

## Step 5: Open in Browser

Navigate to: **http://localhost:3000**

You should see the Train2Earn dashboard.

## Step 6: Connect Your Wallet

1. Click **"Connect Wallet"** button in the top right
2. Select your wallet:
   - **Phantom** (Recommended)
   - **Solflare**
3. Approve the connection
4. Your wallet address will appear in the header

## Step 7: Explore Features

### View Your Assets
- Navigate to the **Wallet Assets** section
- See your NFTs, tokens, and compressed assets
- Filter by type (All/NFTs/Tokens/Compressed)

### Try AI Analysis
- Click **"Analyze with AI"** button
- Wait for AI-powered portfolio insights
- See recommendations and engagement level

### Browse AI Models
- Go to **"AI Models"** section
- Search and filter models
- Click **"Load from IPFS"** to test loading

### Participate in DAO
- Visit **"DAO Voting"** section
- See active proposals
- Cast your vote (FOR/AGAINST)

## Troubleshooting

### Blank White Page

If you see a blank page, check the browser console (F12) for errors.

**Common Issue**: Wallet adapter import error

**Solution**: We've removed Backpack wallet adapter due to compatibility issues. The app now uses only Phantom and Solflare.

If issues persist:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Port Already in Use

If port 3000 or 5001 is already in use:

```bash
# Option 1: Kill the process using the port
# macOS/Linux
lsof -ti:3000 | xargs kill
lsof -ti:5001 | xargs kill

# Option 2: Use different ports
# Edit vite.config.js to change frontend port
# Edit server/index.js to change backend port
```

### API Errors

If you see "Failed to fetch" errors:

1. **Check .env file exists** with correct API keys
2. **Restart the server**: `Ctrl+C` then `npm run dev`
3. **Verify Helius API key** is valid
4. **Check network connection**

### Wallet Won't Connect

1. **Install wallet extension** (Phantom or Solflare)
2. **Refresh the page**
3. **Check wallet is unlocked**
4. **Clear browser cache** and try again

### Module Not Found Errors

```bash
# Reinstall dependencies
npm install

# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

## Next Steps

### For Users
- ✅ [Platform Overview](overview.md)
- ✅ [Payment System](../payment/overview.md)
- ✅ [DAO Economics](../dao/token.md)
- ✅ [Model Registry](../model-registry/overview.md)

### For Developers
- 🔧 [Architecture Overview](../architecture/overview.md)
- 🔧 [API Reference](../api/rest-api.md)
- 🔧 [Smart Contracts](../smart-contracts/overview.md)

### For AI Researchers
- 🤖 [Model Registry Overview](../model-registry/overview.md)
- 🤖 [Model Registry Program](../smart-contracts/model-registry.md)
- 🤖 [Technical Specification](../technical-specification.md)

## Development Commands

```bash
# Start both frontend and backend
npm run dev

# Start only frontend (port 3000)
npm run client

# Start only backend (port 5001)
npm run server

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests (if available)
npm test

# Check documentation links and fences
npm run check:docs

# Run the full local verification suite
npm run verify
```

## Project Structure

```
traintoearn/
├── src/
│   ├── components/       # React components
│   │   ├── Dashboard.jsx
│   │   ├── WalletAssets.jsx
│   │   ├── AIAnalysis.jsx
│   │   ├── RewardsPanel.jsx
│   │   ├── DAOVoting.jsx
│   │   ├── AIModels.jsx
│   │   └── ArweaveUpload.jsx
│   ├── utils/           # Utility functions
│   │   ├── modelLoader.js
│   │   ├── arweaveStorage.js
│   │   ├── payment.js
│   │   └── computeMarketplace.js
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── server/
│   └── index.js         # Express backend
├── docs/                # Documentation
├── .env                 # Environment variables
├── package.json         # Dependencies
├── vite.config.js       # Vite configuration
└── README.md            # Project overview
```

## Configuration

### Vite Config (`vite.config.js`)

```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});
```

### Backend Config (`server/index.js`)

```javascript
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `HELIUS_RPC_URL` | ✅ Yes | Solana RPC endpoint | - |
| `HELIUS_API_KEY` | ✅ Yes | Helius API key | - |
| `OPENROUTER_API_KEY` | ⚠️ Optional | AI inference key | - |
| `VITE_TREASURY_ADDRESS` | ⚠️ Optional | Payment receiver | Default address |
| `VITE_ARWEAVE_GATEWAY` | ❌ No | Arweave gateway | https://arweave.net |
| `PORT` | ❌ No | Backend port | 5001 |

## FAQs

### Q: Do I need SOL to use the platform?
**A:** No, browsing and connecting your wallet is free. You only need SOL for:
- AI inference requests (0.001-0.01 SOL per request)
- Uploading models to Arweave (~$0.01/MB one-time)
- Voting on DAO proposals (gas fees ~0.00001 SOL)

### Q: What networks are supported?
**A:** Currently Solana Mainnet-Beta. Devnet support coming soon.

### Q: Can I use this on mobile?
**A:** The web app works on mobile browsers with Phantom mobile wallet. Native mobile apps coming Q2 2025.

### Q: Is my data private?
**A:** Yes, all wallet operations happen client-side. We don't store private keys or seed phrases.

### Q: How do I report bugs?
**A:** Open an issue on [GitHub](https://github.com/train2earn/issues) or contact support@train2earn.io

## Getting Help

### Community Support
- 💬 [Discord](https://discord.gg/train2earn) - Live chat support
- 🐦 [Twitter](https://twitter.com/train2earn) - Updates and announcements
- 📱 [Telegram](https://t.me/train2earn) - Community discussions

### Documentation
- 📚 [Full Documentation](../README.md)
- 🎥 [Video Tutorials](https://youtube.com/train2earn)
- 📝 [Blog](https://blog.train2earn.io)

### Direct Support
- 📧 Email: support@train2earn.io
- 🐛 GitHub Issues: [Report Bug](https://github.com/train2earn/issues/new)

---

**Congratulations! You're now ready to use Train2Earn!** 🎉

Next: [Architecture Overview](../architecture/overview.md) →
