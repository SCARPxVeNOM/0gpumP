## 0G Pump — A pump.fun‑style Trading Platform on 0G

Trade and create tokens instantly on the 0G Chain. This project uses 0G Blockchain for on‑chain actions, 0G Storage for all coin images and metadata, and is designed to adopt 0G Compute for analytics in the future.

### What you get
- Token creation with images and metadata persisted to 0G Storage (no fake UI data)
- Instant trading via Uniswap V2‑style pools on 0G Testnet (buy/sell as soon as liquidity exists)
- Live price/market snapshots from on‑chain reserves (resilient RPC reads)
- Local dev stack that runs everything with one command

## Quick start

1) Install dependencies
```bash
npm install --legacy-peer-deps
```

2) Configure environment
Create `.env.local` for the frontend and `.env` for the backend. Minimum useful vars:
```bash
# Backend
PORT=4000
OG_STORAGE_API=http://localhost:3000
OG_RPC=https://evmrpc-testnet.0g.ai
FACTORY_ADDRESS=0x10ad7199954FE3479B77c9b8aaAFa2EA44275fd6
ROUTER_ADDRESS=0x631b62C792121cE905e73195b6B3a09bd3557a19
DEPLOYER_PRIVATE_KEY=your_0g_testnet_private_key
SYNC_INTERVAL_MS=30000

# Frontend (.env.local)
NEXT_PUBLIC_EVM_RPC=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
NEXT_PUBLIC_BACKEND_URL=https://your-backend.example.com
```

3) Start everything (storage kit + backend + web)
```bash
npm run dev:all
```

Services:
- 0G Storage Kit proxy: http://localhost:3000
- Backend API (Express): http://localhost:4000
- Web app (Next.js): http://localhost:3001

## Architecture

- Frontend (Next.js 14 + wagmi + RainbowKit)
  - Connect wallet, create tokens, view live market data, swap via pools
  - Reads blockchain using a resilient FallbackProvider (0G RPC)

- Backend (Express + SQLite)
  - Image/metadata upload proxy to 0G Storage with retry/backoff
  - SQLite database `data/coins.db` to persist coins
  - Event indexer for `TokenCreated` (configurable block ranges)
  - Endpoint to seed liquidity for existing tokens (using router)

- 0G Storage Integration (starter kit)
  - Receives uploads and returns storage rootHash
  - Backend caches uploads for instant display and later settlement

- DEX / Liquidity
  - Uniswap V2‑style Factory, Router, Pair on 0G Testnet
  - Default addresses (already wired in the code):
    - Factory: `0x10ad7199954FE3479B77c9b8aaAFa2EA44275fd6`
    - Router: `0x631b62C792121cE905e73195b6B3a09bd3557a19`
    - WETH:   `0x2b4EcA0CD50864faBA28d21E4fEB9A73B0db9BDB`

## Core workflows

### Create a token
1) Open the app and connect a wallet
2) Create coin with name/symbol/supply and upload an image
3) Image + metadata are written to 0G Storage; coin row is saved in SQLite

### Enable trading for an existing token
Backend endpoint (wallet must hold the tokens and some 0G for gas):
```bash
curl -X POST http://localhost:4000/enableTrading \
  -H "Content-Type: application/json" \
  -d '{"tokenAddress":"0xYourToken","tokenAmount":"100000","ethAmount":"0.1"}'
```
This approves the router and calls `addLiquidityETH`, creating the TOKEN/WETH pool.

### Buy/Sell
The UI trades directly against the Pair:
- Wraps ETH → WETH for buys, transfers into Pair, calls `swap`
- For sells, transfers TOKEN to Pair, calls `swap`, unwraps WETH back to ETH
Reads use a fallback provider and derive token order lexicographically to avoid fragile `token0()` calls on unstable RPCs.

## Scripts

Useful commands in `package.json`:
- `npm run dev:all` — start storage kit, backend, and web together
- `npm run dev:backend` — backend only (http://localhost:4000)
- `npm run dev:web` — frontend only (http://localhost:3001)
- `npm run dev:kit` — 0G storage starter kit in `0g-storage-ts-starter-kit/`
- DEX deployment helpers (0G testnet):
  - `npm run deploy:dex:core`
  - `npm run enable:existing`
  - `npm run setup:automated`, `npm run setup:from-storage`

## Environment variables

Backend (`server.js`):
- `PORT` — server port (default 4000)
- `OG_STORAGE_API` — 0G storage kit base URL (default http://localhost:3000)
- `OG_RPC` — 0G EVM RPC URL (default https://evmrpc-testnet.0g.ai)
- `FACTORY_ADDRESS` — token factory for event indexing
- `ROUTER_ADDRESS` — Uniswap V2 router (used by /enableTrading)
- `DEPLOYER_PRIVATE_KEY` — backend signer (must hold tokens for liquidity)
- `SYNC_INTERVAL_MS` — indexer interval (ms)
- `ENABLE_0G_UPLOADS_ON_CREATE` — set `true` to attempt immediate uploads

Frontend:
- `NEXT_PUBLIC_EVM_RPC` — 0G EVM RPC URL for reads
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — WalletConnect v2 ID

Optional (if used in your setup):
- `NEXT_PUBLIC_BACKEND_URL` — when proxying backend differently in prod

## Troubleshooting

- Trading UI shows “No Liquidity Pool”
  - Seed liquidity via `/enableTrading` or scripts; ensure the backend signer holds the token and some 0G.

- CALL_EXCEPTION / missing trie node during reads
  - Already mitigated: reads use a FallbackProvider and avoid `token0()`; ensure `NEXT_PUBLIC_EVM_RPC` is set to `https://evmrpc-testnet.0g.ai`.

- Overflow errors in market data
  - Already mitigated with `formatUnits`; make sure the app is restarted after updates.

- Windows long file names / CRLF warnings
  - Safe to ignore; Git will normalize line endings.

## Roadmap
- 0G Compute‑powered analytics and price signals
- Deeper pool analytics and charts
- Auto‑liquidity for new tokens on creation

## License
MIT

---
Built with ❤️ for the 0G ecosystem. Images and metadata are stored on 0G Storage; no fake placeholder data is shown.


### 🪙 **Token Creation**
- **Create custom memecoins** on 0G Chain
- **Custom token names, symbols, and supply**
- **Image upload support** with 0G Storage integration
- **Real blockchain deployment** via smart contracts

### 🏠 **Homepage Dashboard**
- **Trending coins display** with real-time updates
- **Clickable coin cards** for detailed information
- **Auto-refresh every 30 seconds** for latest data
- **Global token sharing** across all users

### 🔍 **Detailed Coin Information**
- **Comprehensive coin details** with real user input data
- **Uploaded images** from 0G Storage (no placeholder avatars)
- **Token metadata** (Supply, Creator, Creation Date, Description)
- **Direct links to 0G Chain Explorer**

### 🌐 **Blockchain Integration**
- **0G Chain Testnet** support
- **Real transaction data** and contract addresses
- **Transaction verification** and contract inspection
- **WalletConnect v2** integration

### 💾 **Persistent Data Storage**
- **SQLite database** for reliable data persistence
- **Server restart survival** - your coins never disappear
- **Global data sharing** - see tokens from all users
- **Automatic backups** and data integrity

## 🛠 **Technology Stack**

### **Frontend**
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Modern, responsive design
- **Framer Motion** - Smooth animations and transitions
- **Shadcn/ui** - Beautiful, accessible components

### **Backend & Database**
- **SQLite** - Lightweight, persistent database
- **Next.js API Routes** - Serverless backend functions
- **0G Chain RPC** - Real blockchain data integration
- **File-based storage** - Reliable data persistence

### **Blockchain & Web3**
- **0G Chain Testnet** - High-performance blockchain
- **Wagmi** - React hooks for Ethereum
- **RainbowKit** - Beautiful wallet connection
- **WalletConnect v2** - Multi-wallet support

### **Storage & Data**
- **0G Storage SDK** - Decentralized storage integration
- **Persistent database** - SQLite with automatic backups
- **Global data sharing** - Cross-user token visibility
- **Real-time updates** - Live blockchain data

## 🚀 **Getting Started**

### **Prerequisites**
- Node.js 18+ 
- npm or yarn
- MetaMask or any Web3 wallet

### **Installation**

1. **Clone the repository**
```bash
   git clone <your-repo-url>
   cd 0gPump
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
   cp .env.example .env.local
   ```
   
   Add your configuration:
   ```env
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FACTORY_ADDRESS=your_factory_address
   ```

4. **Start the development server**
```bash
npm run dev
```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🔧 **Configuration**

### **Environment Variables**
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - Your WalletConnect Project ID
- `NEXT_PUBLIC_FACTORY_ADDRESS` - 0G Chain token factory contract address

### **Database Configuration**
- **SQLite database** automatically created in `data/coins.db`
- **Automatic table creation** and indexing
- **Data persistence** across server restarts

### **Blockchain Configuration**
- **0G Chain Testnet RPC**: `https://evmrpc-testnet.0g.ai`
- **Block Explorer**: `https://chainscan-galileo.0g.ai`
- **Chain ID**: 16601

## 📱 **Usage Guide**

### **Creating a Token**
1. **Connect your wallet** using the Connect button
2. **Click "Create coin"** in the sidebar
3. **Fill in token details**:
   - Token name (e.g., "DOGEWOW")
   - Token symbol (e.g., "WOW")
   - Total supply (e.g., "1_000_000_000")
   - Description (optional)
4. **Upload an image** (optional)
5. **Click "Create Token"** and confirm the transaction

### **Viewing Token Details**
1. **Click on any coin card** on the homepage
2. **View comprehensive information**:
   - Market metrics (Market Cap, Price, Volume)
   - Token details (Supply, Creator, Creation Date)
   - Blockchain links (Contract, Transaction)
3. **Click blockchain explorer links** for detailed on-chain data

### **Global Token Discovery**
- **All created tokens** are visible to everyone
- **Auto-refresh every 30 seconds** for new tokens
- **Manual refresh button** for immediate updates
- **Persistent storage** ensures tokens survive restarts

## 🔗 **API Endpoints**

### **Coins Management**
- `GET /api/coins` - Retrieve all coins
- `POST /api/coins` - Create new coin

### **Blockchain Data**
- `GET /api/blockchain?tokenAddress=<address>&txHash=<hash>` - Fetch blockchain data

## 🗄 **Database Schema**

### **Coins Table**
```sql
CREATE TABLE coins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  supply TEXT NOT NULL,
  imageHash TEXT,
  tokenAddress TEXT,
  txHash TEXT NOT NULL,
  creator TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  description TEXT,
  marketCap REAL,
  price REAL,
  volume24h REAL,
  holders INTEGER,
  totalTransactions INTEGER
);
```

## 🌟 **Key Features Explained**

### **Persistent Storage**
- **SQLite database** ensures your coins never disappear
- **Automatic backups** and data integrity checks
- **Server restart survival** - data persists indefinitely

### **Global Token Sharing**
- **Cross-user visibility** - see tokens from all users
- **Real-time updates** - new tokens appear instantly
- **Shared database** - global memecoin discovery

### **Blockchain Integration**
- **Real 0G Chain data** via RPC calls
- **Transaction verification** and contract inspection
- **Direct explorer links** for detailed blockchain analysis

### **User Experience**
- **Clickable coin cards** for detailed information
- **Smooth animations** and modern UI design
- **Responsive design** for all devices
- **Wallet integration** for seamless Web3 experience

## 🚧 **Development Roadmap**

### **Phase 1: Core Platform** ✅
- [x] Token creation and deployment
- [x] Persistent data storage
- [x] Global token sharing
- [x] Basic blockchain integration

### **Phase 2: Enhanced Features** 🚧
- [x] Detailed coin information modal
- [x] Real-time blockchain data
- [x] 0G Chain explorer integration
- [ ] Advanced trading features
- [ ] Price charts and analytics

### **Phase 3: Trading Platform** 📋
- [ ] DEX integration
- [ ] Liquidity pools
- [ ] Trading pairs
- [ ] Order book
- [ ] Portfolio management

## 🤝 **Contributing**

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **0G Labs** - For the amazing 0G Chain infrastructure
- **RainbowKit** - For beautiful wallet connection UI
- **Shadcn/ui** - For accessible, beautiful components
- **Next.js Team** - For the excellent React framework

## 📞 **Support**

- **GitHub Issues** - Report bugs and request features
- **Documentation** - Comprehensive guides and API docs
- **Community** - Join our Discord for help and discussion

---

**Built with ❤️ for the 0G Chain ecosystem**

