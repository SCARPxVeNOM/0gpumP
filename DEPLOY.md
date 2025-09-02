# Production Deployment Guide

This project has three services:
- Next.js frontend (Vercel)
- Express backend API (`server.js`) – host on a Node host (Render/Fly/EC2/Heroku)
- 0G Storage kit (in `0g-storage-ts-starter-kit/`) – host as a Node service

## 1) Prepare environment variables

Frontend (set in Vercel → Project → Settings → Environment Variables):
- NEXT_PUBLIC_EVM_RPC=https://evmrpc-testnet.0g.ai
- NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
- NEXT_PUBLIC_BACKEND_URL=https://your-backend.example.com

Backend (set in your Node host):
- PORT=4000
- OG_STORAGE_API=https://your-storage-kit.example.com
- OG_RPC=https://evmrpc-testnet.0g.ai
- FACTORY_ADDRESS=0x...
- ROUTER_ADDRESS=0x...
- DEPLOYER_PRIVATE_KEY=...
- SYNC_INTERVAL_MS=30000

## 2) Deploy the 0G Storage kit
- `cd 0g-storage-ts-starter-kit && npm i && npm run build && node dist/index.js`
- Expose port (default 3000) via your host
- Note the public URL and set it as OG_STORAGE_API for the backend

## 3) Deploy the backend (server.js)
- `npm i --legacy-peer-deps`
- `node server.js`
- Expose port 4000 and set the public URL as NEXT_PUBLIC_BACKEND_URL in Vercel

## 4) Deploy the frontend (Vercel)
- Connect your GitHub repo to Vercel
- Framework preset: Next.js
- Build command: `npm run build` (or `vercel-build`)
- Output directory: `.vercel/output` (automatically handled by @vercel/next)
- Ensure environment variables are set in Vercel

## 5) Post-deploy checks
- Visit the app URL; ensure coin images load (via `/api/image/[hash]` proxy)
- Create a token – confirm image upload (storage) and coin persists (backend)
- Verify trading quotes and price display using on-chain data

## 6) Notes
- All `http://localhost:4000` URLs have been replaced to use `NEXT_PUBLIC_BACKEND_URL` fallbacks
- If you later migrate backend endpoints into Next API routes, you can switch to full Vercel serverless
