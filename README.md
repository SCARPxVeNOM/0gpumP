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
Create `.env` in the project root. Minimum useful vars:
```bash
# Backend
PORT=4000
OG_STORAGE_API=http://localhost:3000
OG_RPC=https://evmrpc-testnet.0g.ai
FACTORY_ADDRESS=0x10ad7199954FE3479B77c9b8aaAFa2EA44275fd6
ROUTER_ADDRESS=0x631b62C792121cE905e73195b6B3a09bd3557a19
DEPLOYER_PRIVATE_KEY=your_0g_testnet_private_key
SYNC_INTERVAL_MS=30000

# Frontend
NEXT_PUBLIC_EVM_RPC=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
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

