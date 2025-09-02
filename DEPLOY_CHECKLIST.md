## Deploy Checklist (Vercel + Railway/Render)

### Frontend (Vercel)
1) Import GitHub repo  Framework: Next.js
2) Env Vars:
   - NEXT_PUBLIC_EVM_RPC=https://evmrpc-testnet.0g.ai
   - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
   - NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
   - NEXT_PUBLIC_LOGO_URL=/og-logo.jpg (optional)
3) Build: npm install --legacy-peer-deps && npm run build
4) Set domain (e.g., app.yourdomain.com)

### Backend (Railway/Render)
1) Service path: repo root
2) Start: node server.js (Health: /health)
3) Mount persistent volume to data/ and cache/
4) Env Vars:
   - PORT=4000
   - OG_STORAGE_API=https://storage.yourdomain.com
   - OG_RPC=https://evmrpc-testnet.0g.ai
   - FACTORY_ADDRESS=0x10ad7199954FE3479B77c9b8aaAFa2EA44275fd6
   - ROUTER_ADDRESS=0x631b62C792121cE905e73195b6B3a09bd3557a19
   - DEPLOYER_PRIVATE_KEY=... (testnet)
   - SYNC_INTERVAL_MS=30000
   - ENABLE_0G_UPLOADS_ON_CREATE=true

### 0G Storage Kit (Railway/Render)
1) Service path: 0g-storage-ts-starter-kit/
2) Build: npm ci && npm run build
3) Start: npm start
4) Env Vars:
   - PORT=3000
   - RPC_URL=https://evmrpc-testnet.0g.ai/
   - INDEXER_RPC=https://indexer-storage-testnet-standard.0g.ai

### Domains
- app.yourdomain.com  Vercel
- api.yourdomain.com  Backend URL
- storage.yourdomain.com  Storage kit URL

### Post-Deploy Tests
- Backend: GET https://api.yourdomain.com/health
- Storage: POST https://storage.yourdomain.com/upload
- Frontend: loads /og-logo.jpg and hits NEXT_PUBLIC_BACKEND_URL
