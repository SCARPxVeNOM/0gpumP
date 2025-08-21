'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { ethers } from 'ethers';

// Contract addresses (from your deployment)
const CURVE_ADDRESS = '0x5C9bAaA886BE305581d2BD08e132Ede10Cc323C4';
const TOKEN_ADDRESS = '0xA370B0935Bad957CA5Cbb724730C1df67A4D1482';

// Contract ABIs
const CURVE_ABI = [
  'function quoteBuy(uint256 qty) view returns (uint256 totalCost)',
  'function quoteSell(uint256 qty) view returns (uint256 ogReceived)',
  'function buy(uint256 qty, uint256 maxCost) payable',
  'function sell(uint256 qty, uint256 minReturn)',
  'function getCurveStats() view returns (uint256 currentStep, uint256 currentPrice, uint256 nativeReserveAmount, uint256 tokensSoldOnCurve, bool graduated)',
  'function getCurrentStep() view returns (uint256)',
  'function getCurrentPrice() view returns (uint256)',
  'event Trade(address indexed trader, bool isBuy, uint256 qty, uint256 costOrProceeds, uint256 stepIndex)',
  'event Graduated(uint256 tokensSoldOnCurve, uint256 nativeReserve, uint256 timestamp)'
];

const TOKEN_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)'
];

interface CurveStats {
  currentStep: number;
  currentPrice: number;
  nativeReserveAmount: number;
  tokensSoldOnCurve: number;
  graduated: boolean;
}

interface TrendingData {
  timestamp: number;
  curveStats: any;
  graduation: any;
  metrics: {
    tradesLastHour: number;
    buyCount: number;
    sellCount: number;
    totalVolume: string;
    velocity5Min: string;
    velocity15Min: string;
    priceChange: string;
  };
  trending: {
    isTrending: boolean;
    momentum: string;
    volume: string;
  };
}

export default function BondingCurvePage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect({
    connector: new InjectedConnector(),
  });
  const { disconnect } = useDisconnect();

  // State
  const [provider, setProvider] = useState<any>(null);
  const [signer, setSigner] = useState<any>(null);
  const [curveStats, setCurveStats] = useState<CurveStats | null>(null);
  const [trendingData, setTrendingData] = useState<TrendingData | null>(null);
  const [userBalance, setUserBalance] = useState<{ native: string; tokens: string }>({ native: '0', tokens: '0' });
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [buyQuote, setBuyQuote] = useState('');
  const [sellQuote, setSellQuote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txStatus, setTxStatus] = useState('');

  // Initialize provider and signer
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const initProvider = async () => {
        try {
          const provider = new ethers.providers.Web3Provider((window as any).ethereum);
          setProvider(provider);
          
          if (isConnected && address) {
            const signer = provider.getSigner();
            setSigner(signer);
          }
        } catch (error) {
          console.error('Error initializing provider:', error);
        }
      };
      
      initProvider();
    }
  }, [isConnected, address]);

  // Load curve stats
  const loadCurveStats = async () => {
    if (!provider) return;
    
    try {
      const contract = new ethers.Contract(CURVE_ADDRESS, CURVE_ABI, provider);
      const stats = await contract.getCurveStats();
      
      setCurveStats({
        currentStep: Number(stats[0]),
        currentPrice: parseFloat(ethers.utils.formatEther(stats[1])),
        nativeReserveAmount: parseFloat(ethers.utils.formatEther(stats[2])),
        tokensSoldOnCurve: Number(stats[3]),
        graduated: stats[4]
      });
    } catch (error) {
      console.error('Error loading curve stats:', error);
    }
  };

  // Load user balances
  const loadUserBalances = async () => {
    if (!provider || !address) return;
    
    try {
      // Native balance
      const nativeBalance = await provider.getBalance(address);
      
      // Token balance
      const tokenContract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);
      const tokenBalance = await tokenContract.balanceOf(address);
      
      setUserBalance({
        native: ethers.utils.formatEther(nativeBalance),
        tokens: ethers.utils.formatEther(tokenBalance)
      });
    } catch (error) {
      console.error('Error loading user balances:', error);
    }
  };

  // Load trending data
  const loadTrendingData = async () => {
    try {
      const response = await fetch('http://localhost:3001/trending');
      const data = await response.json();
      setTrendingData(data);
    } catch (error) {
      console.error('Error loading trending data:', error);
    }
  };

  // Quote buy
  const quoteBuy = async (amount: string) => {
    if (!provider || !amount) return;
    
    try {
      const contract = new ethers.Contract(CURVE_ADDRESS, CURVE_ABI, provider);
      const qty = ethers.utils.parseEther(amount);
      const totalCost = await contract.quoteBuy(qty);
      setBuyQuote(ethers.utils.formatEther(totalCost));
    } catch (error) {
      console.error('Error quoting buy:', error);
      setBuyQuote('Error');
    }
  };

  // Quote sell
  const quoteSell = async (amount: string) => {
    if (!provider || !amount) return;
    
    try {
      const contract = new ethers.Contract(CURVE_ADDRESS, CURVE_ABI, provider);
      const qty = ethers.utils.parseEther(amount);
      const ogReceived = await contract.quoteSell(qty);
      setSellQuote(ethers.utils.formatEther(ogReceived));
    } catch (error) {
      console.error('Error quoting sell:', error);
      setSellQuote('Error');
    }
  };

  // Execute buy
  const executeBuy = async () => {
    if (!signer || !buyAmount || !buyQuote) return;
    
    setIsLoading(true);
    setTxStatus('Buying tokens...');
    
    try {
      const contract = new ethers.Contract(CURVE_ADDRESS, CURVE_ABI, signer);
      const qty = ethers.utils.parseEther(buyAmount);
      const maxCost = ethers.utils.parseEther(buyQuote);
      
      const tx = await contract.buy(qty, maxCost, { value: maxCost });
      setTxStatus('Transaction submitted! Waiting for confirmation...');
      
      await tx.wait();
      setTxStatus('Buy successful! 🎉');
      
      // Refresh data
      await Promise.all([loadCurveStats(), loadUserBalances(), loadTrendingData()]);
      setBuyAmount('');
      setBuyQuote('');
      
    } catch (error) {
      console.error('Error executing buy:', error);
      setTxStatus('Transaction failed! ❌');
    } finally {
      setIsLoading(false);
    }
  };

  // Execute sell
  const executeSell = async () => {
    if (!signer || !sellAmount || !sellQuote) return;
    
    setIsLoading(true);
    setTxStatus('Selling tokens...');
    
    try {
      const contract = new ethers.Contract(CURVE_ADDRESS, CURVE_ABI, signer);
      const qty = ethers.utils.parseEther(sellAmount);
      const minReturn = ethers.utils.parseEther(sellQuote);
      
      const tx = await contract.sell(qty, minReturn);
      setTxStatus('Transaction submitted! Waiting for confirmation...');
      
      await tx.wait();
      setTxStatus('Sell successful! 🎉');
      
      // Refresh data
      await Promise.all([loadCurveStats(), loadUserBalances(), loadTrendingData()]);
      setSellAmount('');
      setSellQuote('');
      
    } catch (error) {
      console.error('Error executing sell:', error);
      setTxStatus('Transaction failed! ❌');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-quote on input change
  useEffect(() => {
    if (buyAmount) {
      quoteBuy(buyAmount);
    } else {
      setBuyQuote('');
    }
  }, [buyAmount, provider]);

  useEffect(() => {
    if (sellAmount) {
      quoteSell(sellAmount);
    } else {
      setSellQuote('');
    }
  }, [sellAmount, provider]);

  // Load data on mount and refresh
  useEffect(() => {
    if (provider) {
      loadCurveStats();
      loadTrendingData();
    }
  }, [provider]);

  useEffect(() => {
    if (provider && address) {
      loadUserBalances();
    }
  }, [provider, address]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (provider) {
        loadCurveStats();
        loadTrendingData();
        if (address) {
          loadUserBalances();
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [provider, address]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">🚀 0G Bonding Curve</h1>
          <p className="text-xl text-gray-300">Trade tokens on the bonding curve</p>
        </div>

        {/* Wallet Connection */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Wallet</h2>
              {isConnected ? (
                <p className="text-green-400">Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
              ) : (
                <p className="text-red-400">Not connected</p>
              )}
            </div>
            <button
              onClick={isConnected ? () => disconnect() : () => connect()}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold transition-colors"
            >
              {isConnected ? 'Disconnect' : 'Connect Wallet'}
            </button>
          </div>
        </div>

        {/* Curve Stats */}
        {curveStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Current Price</h3>
              <p className="text-3xl font-bold text-green-400">{curveStats.currentPrice.toFixed(6)} 0G</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Current Step</h3>
              <p className="text-3xl font-bold text-blue-400">{curveStats.currentStep}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Reserve</h3>
              <p className="text-3xl font-bold text-purple-400">{curveStats.nativeReserveAmount.toFixed(4)} 0G</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Tokens Sold</h3>
              <p className="text-3xl font-bold text-yellow-400">{curveStats.tokensSoldOnCurve.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* User Balances */}
        {isConnected && (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Your Balances</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Native 0G</h3>
                <p className="text-2xl font-bold text-green-400">{parseFloat(userBalance.native).toFixed(4)}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">0GPUMP Tokens</h3>
                <p className="text-2xl font-bold text-blue-400">{parseFloat(userBalance.tokens).toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Trading Interface */}
        {isConnected && !curveStats?.graduated && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Buy Section */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-green-400">Buy Tokens</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Amount to Buy (0GPUMP)</label>
                  <input
                    type="number"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
                {buyQuote && (
                  <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                    <p className="text-sm text-green-300">Cost: {buyQuote} 0G</p>
                  </div>
                )}
                <button
                  onClick={executeBuy}
                  disabled={isLoading || !buyAmount || !buyQuote || buyQuote === 'Error'}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  {isLoading ? 'Processing...' : 'Buy Tokens'}
                </button>
              </div>
            </div>

            {/* Sell Section */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-red-400">Sell Tokens</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Amount to Sell (0GPUMP)</label>
                  <input
                    type="number"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                {sellQuote && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                    <p className="text-sm text-red-300">You'll receive: {sellQuote} 0G</p>
                  </div>
                )}
                <button
                  onClick={executeSell}
                  disabled={isLoading || !sellAmount || !sellQuote || sellQuote === 'Error'}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  {isLoading ? 'Processing...' : 'Sell Tokens'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Graduation Notice */}
        {curveStats?.graduated && (
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-2 text-yellow-400">🎓 Curve Graduated!</h2>
            <p className="text-yellow-300">The bonding curve has graduated to DEX. Trading is now available on UniswapV2.</p>
          </div>
        )}

        {/* Transaction Status */}
        {txStatus && (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-8">
            <p className="text-center font-semibold">{txStatus}</p>
          </div>
        )}

        {/* Trending Data */}
        {trendingData && (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Market Activity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Trades (1h)</h3>
                <p className="text-2xl font-bold">{trendingData.metrics.tradesLastHour}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Volume (1h)</h3>
                <p className="text-2xl font-bold">{trendingData.metrics.totalVolume} 0G</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Velocity (5min)</h3>
                <p className="text-2xl font-bold">{trendingData.metrics.velocity5Min}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Trending</h3>
                <p className={`text-2xl font-bold ${trendingData.trending.isTrending ? 'text-green-400' : 'text-gray-400'}`}>
                  {trendingData.trending.isTrending ? '🔥' : '📉'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Contract Info */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mt-8">
          <h2 className="text-2xl font-semibold mb-4">Contract Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <p><strong>Bonding Curve:</strong> {CURVE_ADDRESS}</p>
              <p><strong>Token:</strong> {TOKEN_ADDRESS}</p>
            </div>
            <div>
              <p><strong>Network:</strong> 0G Testnet</p>
              <p><strong>Chain ID:</strong> 16601</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
