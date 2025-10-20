# 🔗 0G Integration API Endpoints

## 🎮 **Game Provenance Endpoints**

### 1. Verify Game Result (0G DA)
```http
GET /gaming/verify/:gameId
```

**Example:**
```bash
curl http://localhost:4000/gaming/verify/coinflip-123
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "gameData": {
    "gameId": "coinflip-123",
    "gameType": "coinflip",
    "userAddress": "0x2dC274ABC0df37647CEd9212e751524708a68996",
    "wager": 0.1,
    "guess": "heads",
    "result": "heads",
    "outcome": "win",
    "seedHash": "abc123...",
    "seedReveal": "secret...",
    "blockNumber": 12345,
    "blockHash": "0xabc...",
    "tokenAddress": "0x...",
    "stakeTxHash": "0x...",
    "payoutTx": "0x...",
    "timestamp": 1734567890000
  },
  "rootHash": "0x1234abcd...",
  "message": "✅ Game result verified from 0G DA - Tamper-proof and permanent"
}
```

**Supported Game Types:**
- `coinflip-{id}`
- `meme-royale-{id}`
- `mines-{id}`
- `pumpplay-{id}` (coming soon)

---

### 2. Coinflip with Provenance
```http
POST /gaming/coinflip
```

**Request:**
```json
{
  "userAddress": "0x...",
  "wager": 0.1,
  "guess": "heads",
  "tokenAddress": "0x...",
  "txHash": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "result": "heads",
  "outcome": "win",
  "seedHash": "...",
  "seedReveal": "...",
  "blockNumber": 12345,
  "blockHash": "0x...",
  "payoutTx": "0x...",
  "provenanceHash": "0x1234..."
}
```

---

### 3. Meme Royale with AI + Provenance
```http
POST /gaming/meme-royale
```

**Request:**
```json
{
  "leftCoin": { "id": 1, "symbol": "DOGE", "name": "Dogecoin" },
  "rightCoin": { "id": 2, "symbol": "PEPE", "name": "Pepe" },
  "userAddress": "0x...",
  "stakeAmount": 1.0,
  "stakeSide": "left",
  "tokenAddress": "0x...",
  "txHash": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "judged": {
    "left": { "virality": 8, "trend": 7, "creativity": 9, "total": 24 },
    "right": { "virality": 6, "trend": 5, "creativity": 7, "total": 18 },
    "winner": "left"
  },
  "payoutTx": "0x...",
  "winner": "left",
  "provenanceHash": "0xabcd..."
}
```

---

### 4. Mines Cashout with Provenance
```http
POST /gaming/mines/cashout
```

**Request:**
```json
{
  "gameId": 42
}
```

**Response:**
```json
{
  "success": true,
  "gameId": 42,
  "status": "cashed_out",
  "cashoutAmount": 2.5,
  "multiplier": 2.5,
  "payoutTx": "0x...",
  "provenanceHash": "0xdef..."
}
```

---

## 🤖 **AI-Powered Endpoints (0G Compute)**

### 1. AI Token Suggestions
```http
GET /ai-suggestions
```

**Response:**
```json
{
  "success": true,
  "suggestions": [
    {
      "name": "ARDUINO",
      "symbol": "ARD",
      "reason": "Strong tech branding, trending Arduino community, 220 holders",
      "score": 85,
      "risk_level": "medium"
    }
  ],
  "cached": false,
  "lastUpdated": 1734567890
}
```

---

### 2. Trending Topics (AI-Generated)
```http
GET /trending-topics
```

**Response:**
```json
{
  "success": true,
  "topics": [
    {
      "title": "AI Revolution 2025",
      "description": "Artificial intelligence is reshaping...",
      "category": "Technology",
      "viralScore": 92
    }
  ],
  "cached": false,
  "lastUpdated": 1734567890
}
```

---

### 3. Ask PumpAI Chat
```http
POST /ai-chat
```

**Request:**
```json
{
  "message": "What makes a good memecoin?",
  "conversation": [
    { "role": "user", "content": "Previous question..." },
    { "role": "assistant", "content": "Previous answer..." }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "response": "A good memecoin typically has...",
  "timestamp": 1734567890
}
```

---

### 4. PumpPlay AI Auto-Resolve
```http
POST /gaming/pumpplay/resolve
```

**Request (AI Mode):**
```json
{
  "roundId": 1,
  "useAI": true
}
```

**Response:**
```json
{
  "success": true,
  "winnerCoinId": 42,
  "winnersCount": 3,
  "aiResolved": true
}
```

**Request (Manual Mode):**
```json
{
  "roundId": 1,
  "winnerCoinId": 42,
  "useAI": false
}
```

---

### 5. Setup 0G Compute Account
```http
POST /ai-chat/setup
```

**Response:**
```json
{
  "success": true,
  "account": {
    "address": "0x2dC274ABC0df37647CEd9212e751524708a68996",
    "totalBalance": "50000000000000000",
    "balanceFormatted": "0.05 OG"
  },
  "providerAcknowledged": true
}
```

---

## 🏆 **Leaderboard Endpoints (0G DA Backed)**

### 1. Coinflip Leaderboard
```http
GET /gaming/coinflip/leaderboard
```

**Response:**
```json
{
  "success": true,
  "leaderboard": [
    {
      "userAddress": "0x...",
      "wins": 15,
      "losses": 8,
      "plays": 23
    }
  ],
  "immutableBackup": true
}
```

**Note:** Every fetch auto-backs up leaderboard to 0G DA with timestamp.

---

### 2. Recent Coinflip Games
```http
GET /gaming/coinflip/recent
```

**Response:**
```json
{
  "success": true,
  "recent": [
    {
      "userAddress": "0x...",
      "wager": 0.5,
      "outcome": "win",
      "blockNumber": 12345,
      "createdAt": 1734567890
    }
  ]
}
```

---

## 💰 **Gaming Coins Endpoint**

### Get All Platform Coins + User Balances
```http
GET /gaming/coins/:userAddress
```

**Example:**
```bash
curl http://localhost:4000/gaming/coins/0x2dC274ABC0df37647CEd9212e751524708a68996
```

**Response:**
```json
{
  "success": true,
  "coins": [
    {
      "id": 1,
      "name": "Arduino Coin",
      "symbol": "ARD",
      "tokenAddress": "0x...",
      "curveAddress": "0x...",
      "balance": "100.0",
      "hasBalance": true,
      "imageHash": "0x...",
      "imageUrl": "https://...",
      "description": "Tech coin for Arduino community"
    }
  ],
  "userHoldings": [
    {
      "id": 1,
      "symbol": "ARD",
      "balance": "100.0"
    }
  ],
  "totalCoins": 7,
  "coinsWithBalance": 3
}
```

---

## 🔐 **Security Notes**

### Rate Limiting:
- **AI Endpoints**: 10 requests/minute per IP
- **Game Endpoints**: 30 requests/minute per wallet
- **Verification**: Unlimited (public read-only)

### Authentication:
- **No API keys required** for public endpoints
- **Wallet signature** required for gaming transactions
- **Private key** used server-side for 0G Compute & payouts

### Data Privacy:
- **0G DA**: Game results are public (blockchain transparency)
- **Wallet addresses**: Pseudonymous (not linked to identity)
- **AI queries**: Cached for 5 minutes, not logged permanently

---

## 📊 **Response Times**

| Endpoint | Avg Response | Max Response |
|----------|--------------|--------------|
| `/gaming/verify/:gameId` | 500ms | 2s |
| `/gaming/coinflip` | 3s | 8s |
| `/gaming/meme-royale` | 5s | 12s |
| `/gaming/mines/cashout` | 2s | 6s |
| `/ai-suggestions` | 1s (cached) | 8s (fresh) |
| `/ai-chat` | 3s | 10s |
| `/gaming/coins/:addr` | 2s | 5s |

**Note:** Slow responses are due to:
- Blockchain confirmation (2-5s)
- 0G Storage upload (1-3s)
- 0G Compute inference (2-8s)

---

## 🛠️ **Error Handling**

### Common Error Codes:

**400 Bad Request:**
```json
{ "error": "Invalid address" }
```

**404 Not Found:**
```json
{ 
  "error": "Game provenance not found",
  "message": "This game was not stored to 0G DA or the gameId is invalid"
}
```

**500 Internal Server Error:**
```json
{ "error": "Failed to download game data from 0G Storage" }
```

### Retry Strategy:
- **Game endpoints**: Retry after 5 seconds (blockchain confirmation)
- **AI endpoints**: Retry after 10 seconds (compute provider might be busy)
- **Verification**: Retry after 2 seconds (0G Storage network latency)

---

## 🚀 **Quick Start Examples**

### JavaScript (Frontend):
```javascript
// Verify a game
const verifyGame = async (gameId) => {
  const res = await fetch(`http://localhost:4000/gaming/verify/${gameId}`)
  const data = await res.json()
  console.log('Game verified:', data.verified)
  console.log('Root hash:', data.rootHash)
}

// Play coinflip with verification
const playCoinflip = async () => {
  // 1. Transfer tokens to platform
  const tx = await tokenContract.transfer(PLATFORM_ADDRESS, wager)
  
  // 2. Call backend
  const res = await fetch('http://localhost:4000/gaming/coinflip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: address,
      wager: 0.1,
      guess: 'heads',
      tokenAddress: TOKEN_ADDRESS,
      txHash: tx.hash
    })
  })
  
  const data = await res.json()
  console.log('Outcome:', data.outcome)
  console.log('Provenance hash:', data.provenanceHash)
  
  // 3. Verify game
  await verifyGame(data.provenanceHash)
}
```

### cURL (Testing):
```bash
# Verify a game
curl http://localhost:4000/gaming/verify/coinflip-123

# Get leaderboard
curl http://localhost:4000/gaming/coinflip/leaderboard

# Get AI suggestions
curl http://localhost:4000/ai-suggestions

# Ask PumpAI
curl -X POST http://localhost:4000/ai-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is 0G Network?"}'
```

---

## 📚 **Related Documentation**

- [0G Integration Summary](./0G_INTEGRATION_SUMMARY.md)
- [README.md](./README.md)
- [0G Storage SDK Docs](https://github.com/0glabs/0g-storage-client)
- [0G Compute SDK Docs](https://github.com/0glabs/0g-serving-broker)

---

**Built with ❤️ using 0G Network**

