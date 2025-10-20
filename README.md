# 🚀 0G Pump - Next-Gen Decentralized Memecoin Platform

<div align="center">

![0G Pump](public/og-logo.jpg)

**The Ultimate Pump.fun Experience on 0G Chain**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![0G Chain](https://img.shields.io/badge/0G-Chain-purple.svg)](https://0g.ai)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC.svg)](https://tailwindcss.com)

[Live Demo](https://0gpump.vercel.app) · [Documentation](#-features) · [Report Bug](../../issues) · [Request Feature](../../issues)

</div>

---

## 🌟 **What is 0G Pump?**

0G Pump is a **revolutionary decentralized trading platform** that combines instant token creation, AI-powered analytics, and provably fair gaming—all powered by the **0G Network ecosystem**. Create memecoins in seconds, trade with bonding curves, play games with real stakes, and enjoy 90% lower costs compared to traditional centralized platforms.

### **Why 0G Pump?**

- 🎯 **Instant Token Creation** - Deploy ERC-20 tokens in one click
- 📈 **Bonding Curve Trading** - Algorithmic pricing with guaranteed liquidity
- 🤖 **AI-Powered Analytics** - 0G Compute for token suggestions & trending topics
- 🎮 **Provably Fair Gaming** - 4 games with real token stakes + 0G DA verification
- 🔐 **Immutable Records** - Game results stored on 0G Storage forever
- 💰 **Real-Time Wallet Tracker** - Live OG balance + portfolio monitoring
- 🎨 **Neon Gaming UI** - Cyberpunk aesthetic with animated effects
- 💸 **90% Cost Reduction** - $1.65/day vs $15-20/day on AWS/OpenAI

---

## 🏗️ **Architecture**

<div align="center">

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 14)                     │
│  Wagmi + RainbowKit | Tailwind CSS | Framer Motion | ethers.js │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    Backend API (Express.js)                      │
│     SQLite + Redis | Multer | 0G SDK | 0G Compute Broker       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│  0G Storage    │  │  0G Compute │  │   0G Chain      │
│  (Images/Data) │  │  (AI Models)│  │  (Smart Contracts)│
└────────────────┘  └─────────────┘  └─────────────────┘
```

</div>

### **Tech Stack**

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS, Wagmi, RainbowKit |
| **Backend** | Node.js, Express.js, SQLite, Redis |
| **Blockchain** | ethers.js v6, Hardhat, Solidity 0.8.20 |
| **0G Network** | 0G Storage SDK 0.3.1, 0G Compute SDK 0.4.3 |
| **Smart Contracts** | Factory.sol, BondingCurve.sol, MemeToken.sol, Uniswap V2 |

---

## ✨ **Features**

### **🎯 Token Creation**
- **One-Click Deployment**: Create ERC-20 tokens with name, symbol, image, and description
- **0G Storage Integration**: Images/metadata stored permanently on decentralized storage
- **Instant Availability**: Tokens appear globally with real-time updates
- **Bonding Curve Launch**: Automatic liquidity bootstrapping via algorithmic pricing

### **📈 Trading**
- **Bonding Curve Mechanics**: Buy/sell tokens with guaranteed liquidity
- **Real-Time Prices**: Live price feeds from blockchain
- **Slippage Protection**: Configurable slippage tolerance
- **Trading Analytics**: Volume, market cap, holder count, transaction history

### **🤖 AI-Powered Features (0G Compute)**
- **Token Suggestions**: AI analyzes coins for investment recommendations
- **Trending Topics**: AI predicts viral internet trends for coin ideas
- **Meme Royale Judge**: AI rates coins on virality, creativity, and trend-fit
- **PumpPlay Auto-Resolve**: AI predicts which coin will pump next
- **Ask PumpAI Chat**: Real-time AI assistant for platform questions

### **🎮 Gaming Arena (Provably Fair)**

#### **💎 Coinflip**
- Provably fair using OG blockhash entropy
- 2x payout on wins
- Real token stakes + instant payouts
- Leaderboard with win/loss tracking

#### **⚔️ Meme Royale**
- AI judges coin battles (0G Compute)
- 1.8x payout for winners
- Real-time battle results
- Immutable records on 0G DA

#### **🎯 PumpPlay**
- Predict which coin will pump next
- Pool-based betting system
- Proportional payouts to winners
- AI auto-resolve option

#### **💣 Mines**
- Progressive multiplier game (1.1x → 25x)
- Adjustable difficulty (1-24 mines)
- Instant cashout anytime
- Real token stakes + payouts

### **🔐 Game Provenance (0G DA)**
- **Immutable Records**: Every game result stored on 0G Storage
- **Verification API**: `/gaming/verify/:gameId` for public audit
- **Tamper-Proof**: Records written before payouts execute
- **Leaderboard Backups**: Timestamped snapshots prevent cheating

### **💼 Wallet Integration**
- **RainbowKit Connect**: MetaMask, WalletConnect, Coinbase Wallet
- **Real-Time OG Balance**: Auto-refresh every 10 seconds
- **Tokens Held Counter**: Portfolio tracking
- **Transaction History**: All trades + game results

### **🎨 Neon Gaming UI**
- **Cyberpunk Theme**: Dark gradients with neon glows
- **Animated Blobs**: Floating orb effects
- **Glass-Morphism**: Backdrop blur containers
- **Smooth Transitions**: 300ms hover/scale effects
- **Game-Specific Colors**: Blue (PumpPlay), Pink (Meme Royale), Orange (Mines), Cyan (Coinflip)

---

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+
- MetaMask or Web3 wallet
- 0G Testnet tokens ([Faucet](https://faucet.0g.ai))

### **Installation**

```bash
# Clone repository
git clone https://github.com/SCARPxVeNOM/0gpump-production.git
cd 0gpump-production

# Install dependencies
npm install --legacy-peer-deps

# Start all services
npm run dev:all
```

### **Environment Setup**

#### Frontend (`.env.local`)
```env
NEXT_PUBLIC_EVM_RPC=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_FACTORY_ADDRESS=0x560C7439E28359E2E8C0D72A52e8b5d6645766e7
NEXT_PUBLIC_OG_RPC=https://evmrpc-testnet.0g.ai
```

#### Backend (`.env`)
```env
PORT=4000
OG_RPC=https://evmrpc-testnet.0g.ai
PRIVATE_KEY=your_private_key
FACTORY_ADDRESS=0x560C7439E28359E2E8C0D72A52e8b5d6645766e7
ROUTER_ADDRESS=0x631b62C792121cE905e73195b6B3a09bd3557a19
WETH_ADDRESS=0xB01825d6EbAB7E2c032797222A14B5c375069420
```

### **Available Scripts**

```bash
# Development
npm run dev              # Frontend only (localhost:3001)
npm run dev:backend      # Backend only (localhost:4000)
npm run dev:kit          # 0G Storage Kit (localhost:3000)
npm run dev:all          # All services

# Building
npm run build            # Build frontend
npm run build:all        # Build all services

# Smart Contracts
npm run deploy:dex:core  # Deploy DEX contracts
npm run deploy:curve     # Deploy bonding curve
npm run enable:trading   # Enable token trading
```

---

## 🎮 **How to Use**

### **Creating Tokens**

1. **Connect Wallet** → Click "Connect Wallet" (top right)
2. **Create Token** → Click "Create Token" button
3. **Fill Details**:
   - Token Name (e.g., "Doge Coin")
   - Symbol (e.g., "DOGE")
   - Description
   - Upload Image (stored on 0G Storage)
4. **Deploy** → Approve MetaMask transaction
5. **Trade** → Token appears instantly with bonding curve

### **Trading Tokens**

1. **Browse Tokens** → Scroll homepage or search by name/symbol
2. **Select Token** → Click on any token card
3. **Buy/Sell**:
   - Choose action (Buy/Sell)
   - Enter amount
   - Set slippage (0.5% - 5%)
   - Approve transaction
4. **Track Portfolio** → View holdings in wallet tracker

### **Playing Games**

1. **Gaming Arena** → Navigate to `/gaming`
2. **Connect Wallet** → See OG balance + tokens held
3. **Select Game** → Choose Coinflip, Meme Royale, PumpPlay, or Mines
4. **Stake Tokens** → Pick token + enter bet amount
5. **Play** → Approve stake transaction
6. **Win** → Payout sent automatically (2s delay)
7. **Verify** → Click verification badge to audit game on 0G DA

### **Using AI Features**

1. **AI Suggestions** → Click "Advanced" in sidebar → `/ai-suggestions`
2. **Token Recommendations** → View AI analysis of top coins
3. **Trending Topics** → Get viral meme ideas from AI
4. **Ask PumpAI** → Navigate to "Ask PumpAI" → Chat with AI
5. **Meme Royale** → Let AI judge coin battles automatically

---

## 📊 **Cost Efficiency**

### **0G Network vs Traditional Stack**

| Feature | 0G Network | AWS + OpenAI | Savings |
|---------|------------|--------------|---------|
| Game Storage | $0.001/game | $0.01/game | **90%** |
| AI Inference | $0.003/request | $0.03/request | **90%** |
| Image Storage | $0.001/256KB | $0.005/256KB | **80%** |
| Chat AI | $0.002/message | $0.02/message | **90%** |
| **Total (100 users/day)** | **$1.65** | **$15-20** | **~92%** |

### **Why 0G is Cheaper**

- **Decentralized Infrastructure**: No single point of failure, lower overhead
- **Pay-per-use**: Only pay for actual compute/storage consumed
- **No Vendor Lock-in**: Open network, competitive pricing
- **GPU Marketplace**: Decentralized compute nodes compete on price

---

## 🔗 **API Endpoints**

### **Core APIs**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/coins` | GET | List all tokens |
| `/createCoin` | POST | Create new token |
| `/upload` | POST | Upload image to 0G Storage |
| `/download/:rootHash` | GET | Download from 0G Storage |

### **AI APIs (0G Compute)**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ai-suggestions` | GET | AI token recommendations |
| `/trending-topics` | GET | AI viral trend predictions |
| `/ai-chat` | POST | Chat with PumpAI assistant |
| `/ai-setup` | POST | Initialize 0G Compute account |

### **Gaming APIs**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/gaming/coinflip` | POST | Play coinflip |
| `/gaming/meme-royale` | POST | Start Meme Royale battle |
| `/gaming/pumpplay/bet` | POST | Bet on PumpPlay |
| `/gaming/mines/start` | POST | Start Mines game |
| `/gaming/verify/:gameId` | GET | Verify game on 0G DA |
| `/gaming/coins/:address` | GET | Get user's gaming tokens |

---

## 🔐 **Security & Trust**

### **Provably Fair Gaming**
- **Coinflip**: Uses OG blockhash + cryptographic randomness
- **Meme Royale**: AI judgment stored immutably (can't be altered)
- **Mines**: Grid generation uses secure random
- **All Games**: Results written to 0G DA before payouts

### **Decentralized Verification**
- Every game has permanent `provenanceHash`
- Anyone can audit via `/gaming/verify/:gameId`
- No central authority controls results
- Tamper-proof records on 0G Storage

### **Smart Contract Security**
- Audited bonding curve mechanics
- Reentrancy protection
- Safe math operations
- Pausable in emergencies

---

## 📈 **Roadmap**

### **Phase 1: Core Platform** ✅
- [x] Token creation + deployment
- [x] Bonding curve trading
- [x] 0G Storage integration
- [x] Basic UI/UX

### **Phase 2: AI & Gaming** ✅
- [x] 0G Compute integration
- [x] 4 provably fair games
- [x] AI token suggestions
- [x] Game provenance (0G DA)
- [x] Real-time wallet tracker
- [x] Neon gaming UI

### **Phase 3: Advanced Features** 🚧
- [ ] Token launchpad with vesting
- [ ] DAO governance for platform
- [ ] Cross-chain bridge integration
- [ ] Mobile app (iOS/Android)
- [ ] Advanced charting + TA tools
- [ ] Social features (comments, likes)

### **Phase 4: Ecosystem Expansion** 📋
- [ ] NFT integration for top coins
- [ ] Liquidity mining rewards
- [ ] Staking mechanisms
- [ ] Institutional partnerships
- [ ] Multi-chain deployment

---

## 🤝 **Contributing**

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** changes (`git commit -m 'Add amazing feature'`)
4. **Push** to branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### **Development Guidelines**
- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Maintain code consistency

---

## 📄 **License**

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **[0G Labs](https://0g.ai)** - For the revolutionary 0G Chain infrastructure
- **[RainbowKit](https://rainbowkit.com)** - Beautiful wallet connection UI
- **[Shadcn/ui](https://ui.shadcn.com)** - Accessible component library
- **[Next.js](https://nextjs.org)** - Powerful React framework
- **[Ethers.js](https://ethers.org)** - Ethereum interaction library

---

## 🔗 **Links**

<div align="center">

[![Website](https://img.shields.io/badge/Website-0gpump.vercel.app-blue?style=for-the-badge)](https://0gpump.vercel.app)
[![0G Explorer](https://img.shields.io/badge/Explorer-0G%20Chain-purple?style=for-the-badge)](https://chainscan-galileo.0g.ai)
[![0G Docs](https://img.shields.io/badge/Docs-0G%20Network-green?style=for-the-badge)](https://docs.0g.ai)

**[Live Demo](https://0gpump.vercel.app)** • **[GitHub Repo](https://github.com/SCARPxVeNOM/0gpump-production)** • **[0G Testnet](https://chainscan-galileo.0g.ai)** • **[Get Testnet Tokens](https://faucet.0g.ai)**

</div>

---

## 📞 **Support**

- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)
- **Email**: pratikkumar56778@gmail.com
- **0G Community**: [Join Discord](https://discord.gg/0glabs)

---

<div align="center">

**Built with ❤️ for the 0G Ecosystem**

*Decentralized • Verifiable • Affordable*

[![GitHub stars](https://img.shields.io/github/stars/SCARPxVeNOM/0gpump-production?style=social)](../../stargazers)
[![GitHub forks](https://img.shields.io/github/forks/SCARPxVeNOM/0gpump-production?style=social)](../../network/members)

</div>
