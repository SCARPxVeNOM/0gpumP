require('dotenv').config();
const { ethers } = require('ethers');
const express = require('express');
const cors = require('cors');

// Configuration
const PORT = process.env.PORT || 3001;
const OG_RPC = process.env.OG_RPC || 'https://evmrpc-testnet.0g.ai';
const CURVE_ADDRESS = process.env.CURVE_ADDRESS;

// Initialize provider
const provider = new ethers.providers.JsonRpcProvider(OG_RPC);

// Bonding Curve ABI (events only)
const CURVE_ABI = [
  'event Trade(address indexed trader, bool isBuy, uint256 qty, uint256 costOrProceeds, uint256 stepIndex)',
  'event Graduated(uint256 tokensSoldOnCurve, uint256 nativeReserve, uint256 timestamp)',
  'event StepAdvanced(uint256 newStep, uint256 newPrice)'
];

// In-memory storage (in production, use a database)
let trades = [];
let graduation = null;
let curveStats = null;

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Load curve stats
async function loadCurveStats() {
  if (!CURVE_ADDRESS) return;
  
  try {
    const contract = new ethers.Contract(CURVE_ADDRESS, CURVE_ABI, provider);
    
    // Get basic stats (you might need to add these functions to your contract)
    const currentStep = await contract.getCurrentStep();
    const currentPrice = await contract.getCurrentPrice();
    
    curveStats = {
      currentStep: currentStep.toNumber(),
      currentPrice: parseFloat(ethers.utils.formatEther(currentPrice)),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error loading curve stats:', error);
  }
}

// Listen for curve events
async function listenForEvents() {
  if (!CURVE_ADDRESS) {
    console.log('⚠️  CURVE_ADDRESS not set, skipping event listening');
    return;
  }
  
  try {
    const contract = new ethers.Contract(CURVE_ADDRESS, CURVE_ABI, provider);
    
    // Listen for Trade events
    contract.on('Trade', (trader, isBuy, qty, costOrProceeds, stepIndex, event) => {
      const trade = {
        txHash: event.transactionHash,
        trader: trader.toLowerCase(),
        isBuy,
        qty: qty.toString(),
        costOrProceeds: costOrProceeds.toString(),
        stepIndex: stepIndex.toNumber(),
        timestamp: Date.now(),
        blockNumber: event.blockNumber
      };
      
      trades.unshift(trade);
      
      // Keep only last 1000 trades
      if (trades.length > 1000) {
        trades = trades.slice(0, 1000);
      }
      
      console.log(`Trade: ${isBuy ? 'BUY' : 'SELL'} ${ethers.utils.formatEther(qty)} tokens for ${ethers.utils.formatEther(costOrProceeds)} 0G`);
    });
    
    // Listen for Graduation events
    contract.on('Graduated', (tokensSoldOnCurve, nativeReserve, timestamp, event) => {
      graduation = {
        tokensSoldOnCurve: tokensSoldOnCurve.toString(),
        nativeReserve: nativeReserve.toString(),
        timestamp: timestamp.toNumber(),
        txHash: event.transactionHash,
        blockNumber: event.blockNumber
      };
      
      console.log(`🎓 Curve graduated! Tokens sold: ${ethers.utils.formatEther(tokensSoldOnCurve)}, Reserve: ${ethers.utils.formatEther(nativeReserve)} 0G`);
    });
    
    // Listen for Step Advancement events
    contract.on('StepAdvanced', (newStep, newPrice, event) => {
      const stepAdvance = {
        newStep: newStep.toNumber(),
        newPrice: parseFloat(ethers.utils.formatEther(newPrice)),
        timestamp: Date.now(),
        txHash: event.transactionHash,
        blockNumber: event.blockNumber
      };
      
      console.log(`📈 Step advanced to ${newStep}, new price: ${ethers.utils.formatEther(newPrice)} 0G`);
      
      // Update curve stats
      if (curveStats) {
        curveStats.currentStep = newStep.toNumber();
        curveStats.currentPrice = parseFloat(ethers.utils.formatEther(newPrice));
        curveStats.timestamp = Date.now();
      }
    });
    
    console.log(`✅ Listening for events on curve: ${CURVE_ADDRESS}`);
    
  } catch (error) {
    console.error('Error setting up event listeners:', error);
  }
}

// API Endpoints

// Get trending data
app.get('/trending', (req, res) => {
  try {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const fifteenMinutesAgo = now - (15 * 60 * 1000);
    
    // Filter trades by time
    const tradesLastHour = trades.filter(t => t.timestamp >= oneHourAgo);
    const tradesLast5Min = trades.filter(t => t.timestamp >= fiveMinutesAgo);
    const tradesLast15Min = trades.filter(t => t.timestamp >= fifteenMinutesAgo);
    
    // Calculate metrics
    const buyCount = tradesLastHour.filter(t => t.isBuy).length;
    const sellCount = tradesLastHour.filter(t => !t.isBuy).length;
    const totalVolume = tradesLastHour.reduce((sum, t) => sum + parseFloat(ethers.utils.formatEther(t.costOrProceeds)), 0);
    
    // Calculate velocity (trades per minute)
    const velocity5Min = tradesLast5Min.length / 5;
    const velocity15Min = tradesLast15Min.length / 15;
    
    // Calculate price change (if we have enough data)
    let priceChange = 0;
    if (tradesLastHour.length >= 2) {
      const firstTrade = tradesLastHour[tradesLastHour.length - 1];
      const lastTrade = tradesLastHour[0];
      if (firstTrade.stepIndex !== lastTrade.stepIndex) {
        priceChange = ((lastTrade.stepIndex - firstTrade.stepIndex) / firstTrade.stepIndex) * 100;
      }
    }
    
    const response = {
      timestamp: now,
      curveStats,
      graduation,
      metrics: {
        tradesLastHour: tradesLastHour.length,
        buyCount,
        sellCount,
        totalVolume: totalVolume.toFixed(6),
        velocity5Min: velocity5Min.toFixed(2),
        velocity15Min: velocity15Min.toFixed(2),
        priceChange: priceChange.toFixed(2)
      },
      recentTrades: trades.slice(0, 50), // Last 50 trades
      trending: {
        isTrending: velocity5Min > 2, // Trending if > 2 trades per minute
        momentum: velocity5Min > velocity15Min ? 'increasing' : 'decreasing',
        volume: totalVolume > 1 ? 'high' : 'low' // High volume if > 1 0G
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error in /trending endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get curve stats
app.get('/curve-stats', (req, res) => {
  res.json({
    curveStats,
    graduation,
    timestamp: Date.now()
  });
});

// Get recent trades
app.get('/trades', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const tradesResponse = trades.slice(0, limit);
  
  res.json({
    trades: tradesResponse,
    count: tradesResponse.length,
    total: trades.length,
    timestamp: Date.now()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    curveAddress: CURVE_ADDRESS,
    rpc: OG_RPC,
    tradesCount: trades.length,
    hasGraduated: !!graduation
  });
});

// Start server
async function startServer() {
  try {
    // Load initial curve stats
    await loadCurveStats();
    
    // Start listening for events
    await listenForEvents();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Indexer server running on port ${PORT}`);
      console.log(`📊 Trending endpoint: http://localhost:${PORT}/trending`);
      console.log(`📈 Curve stats: http://localhost:${PORT}/curve-stats`);
      console.log(`🔍 Recent trades: http://localhost:${PORT}/trades`);
      console.log(`❤️  Health check: http://localhost:${PORT}/health`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down indexer...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down indexer...');
  process.exit(0);
});

// Start the server
startServer();
