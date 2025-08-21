# 🚀 0G Pump - Memecoin Trading Platform

A modern, decentralized memecoin trading platform built on the 0G Chain with real-time blockchain data integration.

## ✨ **Features**

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

