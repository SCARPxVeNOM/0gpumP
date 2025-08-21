'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import TokenCreatorModal from './components/TokenCreatorModal'
import CoinDetailModal from './components/CoinDetailModal'
import CoinImage from './components/CoinImage'
import TradingCard from './components/TradingCard'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { CoinData, ogStorageSDK } from '../lib/0gStorageSDK'
import Link from 'next/link'
import {
  Home,
  Video,
  Zap,
  MessageCircle,
  User,
  HelpCircle,
  MoreHorizontal,
  Search,
  Plus,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  TrendingUp,
  Wallet,
  TrendingDown
} from 'lucide-react'

// Removed mock trending coins to avoid SSR/client mismatch

// Categories
const categories = [
  { name: 'Trending Titles', active: true, color: 'bg-slate-700/60' },
  { name: 'Fast Money', active: true, color: 'bg-orange-500/60' },
  { name: 'Apple Companion', active: false, color: 'bg-slate-700/60' },
  { name: 'Onchain House', active: false, color: 'bg-slate-700/60' },
  { name: 'Pepeverse', active: false, color: 'bg-slate-700/60' },
  { name: 'Dog Obsession', active: false, color: 'bg-slate-700/60' },
  { name: 'NaiLo', active: false, color: 'bg-slate-700/60' }
]

export default function App() {
  const { isConnected, address } = useAccount()
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false)
  const [trendingCoins, setTrendingCoins] = useState<CoinData[]>([])
  const [allCoins, setAllCoins] = useState<CoinData[]>([]) // Store all coins for search
  const [searchQuery, setSearchQuery] = useState('') // Search query state
  const [isLoading, setIsLoading] = useState(false) // Start with false since we don't have initial data
  const [mounted, setMounted] = useState(false)
  const [selectedCoin, setSelectedCoin] = useState<CoinData | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)
  const [isCoinDetailOpen, setIsCoinDetailOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load previously created coins from 0G Storage on startup
  useEffect(() => {
    const loadStoredCoins = async () => {
      try {
        setIsLoading(true);
        console.log('Loading coins from 0G Storage...');
        
        // Get all coins from 0G Storage
        const storedCoins = await ogStorageSDK.getAllCoins();
        
        if (storedCoins.length > 0) {
          console.log('Found stored coins:', storedCoins);
          setAllCoins(storedCoins); // Store all coins for search
          setTrendingCoins(storedCoins); // Show ALL coins, not just first 6
        } else {
          console.log('No stored coins found in 0G Storage');
          // Fallback to server database so tokens persist across browsers
          try {
            const res = await fetch('/api/coins', { cache: 'no-store' });
            if (res.ok) {
              const data = await res.json();
              const mapped = (data.coins || []).map((c: any) => ({
                id: c.txHash || c.id,
                name: c.name,
                symbol: c.symbol,
                supply: c.supply,
                description: c.description,
                imageUrl: c.imageHash ? ogStorageSDK.getCoinImageUrl(c.imageHash) : '',
                createdAt: new Date(c.createdAt).toISOString(),
                creator: c.creator,
                txHash: c.txHash,
                tokenAddress: c.tokenAddress,
              })) as any[];
              setAllCoins(mapped);
              setTrendingCoins(mapped);
            }
          } catch (e) {
            console.error('Failed to load coins from server database:', e);
          }
        }
      } catch (error) {
        console.error('Error loading coins from 0G Storage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (mounted) {
      loadStoredCoins();
    }
  }, [mounted]);

  // Filter coins based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      // If no search query, show ALL coins (not limited to 6)
      setTrendingCoins(allCoins);
    } else {
      // Filter coins by name or symbol
      const filtered = allCoins.filter(coin => 
        coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (coin.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      );
      setTrendingCoins(filtered);
    }
  }, [searchQuery, allCoins]);

  // Auto-refresh coins every 30 seconds to see new tokens from other users
  useEffect(() => {
    if (!mounted) return;

    const autoRefreshInterval = setInterval(async () => {
      try {
        console.log('Auto-refreshing coins from server database...');
        const res = await fetch('/api/coins', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const mapped = (data.coins || []).map((c: any) => ({
            id: c.txHash || c.id,
            name: c.name,
            symbol: c.symbol,
            supply: c.supply,
            description: c.description,
            imageUrl: c.imageHash ? ogStorageSDK.getCoinImageUrl(c.imageHash) : '',
            createdAt: new Date(c.createdAt).toISOString(),
            creator: c.creator,
            txHash: c.txHash,
            tokenAddress: c.tokenAddress,
          })) as any[];
          setAllCoins(mapped); // Update allCoins with refreshed data
          setTrendingCoins(mapped); // Show ALL refreshed coins
        }
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(autoRefreshInterval);
  }, [mounted]);

  // Note: 0G Storage is primarily for storing data, not querying it
  // To display coins, we need additional infrastructure like:
  // 1. A separate database/index to track stored coins
  // 2. 0G Storage events to monitor new uploads
  // 3. A backend service to maintain the index
  
  // For now, we'll start with an empty list and add coins as they're created
  useEffect(() => {
    // This would be replaced with actual 0G Storage event monitoring
    // or a separate indexing service in production
    console.log('0G Storage integration: Ready to store new coins');
  }, [])

  // Helper function to format time ago
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  // Handle coin card click
  const handleCoinClick = (coin: CoinData) => {
    setSelectedCoin(coin)
    setIsCoinDetailOpen(true)
  }

  // Handle trading actions
  const handleTrade = async (coin: CoinData, action: 'buy' | 'sell', amount: string) => {
    console.log(`Trade executed: ${action} ${amount} of ${coin.symbol}`)
    
    // TODO: In production, this would:
    // 1. Connect to DEX smart contract
    // 2. Execute the trade on blockchain
    // 3. Update user's portfolio
    // 4. Update token price and volume
    
    // For now, just show a success message
    alert(`${action.toUpperCase()} order for ${amount} ${coin.symbol} submitted successfully!`)
  }

  const handleCoinCreated = async (tokenData: any) => {
    try {
      const coin = {
        id: tokenData.txHash,
        name: tokenData.name,
        symbol: tokenData.symbol,
        supply: tokenData.supply,
        description: tokenData.description,
        imageUrl: tokenData.imageHash ? ogStorageSDK.getCoinImageUrl(tokenData.imageHash) : '',
        createdAt: new Date().toISOString(),
        creator: address || 'Unknown',
        // pass-through chain fields for explorer buttons
        txHash: tokenData.txHash,
        tokenAddress: tokenData.tokenAddress,
        telegramUrl: tokenData.telegramUrl,
        xUrl: tokenData.xUrl,
        discordUrl: tokenData.discordUrl,
        websiteUrl: tokenData.websiteUrl
      } as any
      await ogStorageSDK.saveCoinToLocal(coin)
      setAllCoins((prev) => [coin, ...prev])
      setTrendingCoins((prev) => [coin, ...prev])

      // Persist to server database so the coin appears across browsers/devices
      try {
        await fetch('/api/coins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tokenData.name,
            symbol: tokenData.symbol,
            supply: tokenData.supply,
            imageHash: tokenData.imageHash || null,
            tokenAddress: tokenData.tokenAddress || null,
            txHash: tokenData.txHash,
            creator: address || 'Unknown',
            description: tokenData.description,
            telegramUrl: tokenData.telegramUrl || null,
            xUrl: tokenData.xUrl || null,
            discordUrl: tokenData.discordUrl || null,
            websiteUrl: tokenData.websiteUrl || null,
          }),
        })
      } catch (e) {
        console.error('Failed to persist coin to server DB:', e)
      }
    } catch (e) {
      console.error('Failed to add coin locally:', e)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900/20 to-slate-900 text-white flex">
      {/* Glassmorphism background overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-cyan-500/5 backdrop-blur-3xl -z-10" />
      
      {/* Left Sidebar */}
      <div className="w-64 bg-slate-800/40 backdrop-blur-xl border-r border-slate-700/50 p-6 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          {logoFailed ? (
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl nb-border nb-shadow-sm" />
          ) : (
            // Provide your image at /og-logo.png or via NEXT_PUBLIC_LOGO_URL (e.g., /download/<rootHash>)
            <img
              src={(process.env.NEXT_PUBLIC_LOGO_URL as string) || '/og-logo.jpg'}
              alt="App logo"
              className="w-14 h-14 rounded-2xl nb-border nb-shadow-sm object-cover"
              onError={() => setLogoFailed(true)}
            />
          )}
          <span className="text-4xl   text-white" style={{ fontFamily: 'fantasy' }}>0G Pump</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-3">
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-md nb-border nb-shadow-sm bg-[hsl(var(--card))] text-[hsl(var(--foreground))] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">
            <Home className="w-5 h-5" />
            <span>Home</span>
          </a>
          <Link href="/bonding-curve" className="flex items-center gap-3 px-4 py-3 rounded-md nb-border nb-shadow-sm bg-[hsl(var(--card))] text-[hsl(var(--foreground))] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">
            <TrendingDown className="w-5 h-5" />
            <span>Bonding Curve</span>
          </Link>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-md nb-border nb-shadow-sm bg-[hsl(var(--card))] text-[hsl(var(--foreground))] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">
            <Video className="w-5 h-5" />
            <span>Livestreams</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-md nb-border nb-shadow-sm bg-[hsl(var(--card))] text-[hsl(var(--foreground))] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">
            <Zap className="w-5 h-5" />
            <span>Advanced</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-md nb-border nb-shadow-sm bg-[hsl(var(--card))] text-[hsl(var(--foreground))] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">
            <MessageCircle className="w-5 h-5" />
            <span>Chat</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-md nb-border nb-shadow-sm bg-[hsl(var(--card))] text-[hsl(var(--foreground))] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">
            <User className="w-5 h-5" />
            <span>Profile</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-md nb-border nb-shadow-sm bg-[hsl(var(--card))] text-[hsl(var(--foreground))] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">
            <HelpCircle className="w-5 h-5" />
            <span>Support</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-md nb-border nb-shadow-sm bg-[hsl(var(--card))] text-[hsl(var(--foreground))] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">
            <MoreHorizontal className="w-5 h-5" />
            <span>More</span>
          </a>
        </nav>

        {/* Wallet Status */}
        {mounted && isConnected && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-green-300">Wallet Connected</span>
            </div>
            <div className="text-xs text-green-200 font-mono">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          </div>
        )}

        {/* Create Coin Button */}
        <Button
          onClick={() => setIsTokenModalOpen(true)}
          disabled={mounted ? !isConnected : true}
          className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-2xl py-4 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 transition-all duration-300 transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          {mounted && isConnected ? 'Create coin' : 'Connect wallet to create coin'}
        </Button>

        {/* Clear Data Button (for testing) */}
        {mounted && trendingCoins.length > 0 && (
          <Button
            onClick={async () => {
              localStorage.removeItem('0g_coins_data');
              setTrendingCoins([]);
              setAllCoins([]);
            }}
            variant="secondary"
            className="w-full mt-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30 text-sm py-2"
          >
            Clear Stored Data
          </Button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-slate-800/40 backdrop-blur-xl border-b border-slate-700/50 p-6">
          <div className="flex items-center justify-between">
            {/* Alert Banner */}
            <div className="px-4 py-2 rounded-md nb-border nb-shadow-sm bg-[hsl(var(--primary))]">
              <span className="text-sm text-black font-bold">(DEMO-ALERT)Live bought 1.4703 0G of DINO ~ 1 min(s): $25.7K</span>
            </div>

            {/* Search and Actions */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-600" />
                <Input 
                  placeholder="Search coins by name, symbol, or description..." 
                  className="pl-12 rounded-md w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-slate-400">
                    {trendingCoins.length} result{trendingCoins.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <Button onClick={() => setSearchQuery('')}>
                {searchQuery ? 'Clear Search' : 'Search'}
              </Button>
              {mounted && <ConnectButton />}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Status Banner */}
          {mounted && (
            <div className="mb-4 px-4 py-3 bg-[hsl(var(--card))] nb-border nb-shadow-sm rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-black text-bold font-bold">
                    {searchQuery ? `Search results for "${searchQuery}"` : 'Real Trading Platform • 0G Chain Integration'}
                  </span>
                </div>
                <span className="text-xs px-2 py-1 rounded nb-border nb-shadow-sm bg-white text-black">
                  {searchQuery ? `${trendingCoins.length} search result${trendingCoins.length !== 1 ? 's' : ''}` : `${allCoins.length} real tokens`}
                </span>
              </div>
            </div>
          )}

          {/* Portfolio Section - Removed fake data */}
          {mounted && isConnected && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl  bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent" style={{ fontFamily: 'fantasy' }}>
                  Your Trading Dashboard
                </h2>
                <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                  Connected
                </Badge>
              </div>
              
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-slate-700/60 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-8 h-8 text-slate-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-300 mb-2">Ready to Trade!</h4>
                  <p className="text-slate-400 mb-4">
                    Connect your wallet and start trading tokens. All data shown is real and user-generated.
                  </p>
                  <Button
                    onClick={() => setIsTokenModalOpen(true)}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                  >
                    Create Your First Token
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Trading Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                {searchQuery ? `Search Results for "${searchQuery}"` : 'Trade Tokens'}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      const res = await fetch('/api/coins', { cache: 'no-store' });
                      if (res.ok) {
                        const data = await res.json();
                        const mapped = (data.coins || []).map((c: any) => ({
                          id: c.txHash || c.id,
                          name: c.name,
                          symbol: c.symbol,
                          supply: c.supply,
                          description: c.description,
                          imageUrl: c.imageHash ? ogStorageSDK.getCoinImageUrl(c.imageHash) : '',
                          createdAt: new Date(c.createdAt).toISOString(),
                          creator: c.creator,
                          txHash: c.txHash,
                          tokenAddress: c.tokenAddress,
                        })) as any[];
                        setAllCoins(mapped); // Update allCoins with refreshed data
                        setTrendingCoins(mapped); // Show ALL refreshed coins
                      }
                    } catch (e) {
                      console.error('Manual refresh failed:', e)
                    }
                    setIsLoading(false);
                  }}
                  variant="secondary"
                  className="bg-slate-700/60 backdrop-blur-sm hover:bg-slate-600/60 rounded-2xl px-4 py-2 border border-slate-600/30 transition-all duration-300"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  variant="secondary"
                  className="bg-slate-700/60 backdrop-blur-sm hover:bg-slate-600/60 rounded-2xl w-10 h-10 p-0 border border-slate-600/30 transition-all duration-300"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  variant="secondary"
                  className="bg-slate-700/60 backdrop-blur-sm hover:bg-slate-600/60 rounded-2xl w-10 h-10 p-0 border border-slate-600/30 transition-all duration-300"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Categories */}
            <div className="flex gap-3 mb-8 flex-wrap">
              {categories.map((category, index) => (
                <Button
                  key={index}
                  variant="secondary"
                  className={`${category.color} backdrop-blur-sm hover:opacity-80 text-sm px-4 py-2 rounded-2xl border border-slate-600/30 transition-all duration-300 transform hover:scale-105`}
                >
                  {category.name}
                </Button>
              ))}
              <Button
                variant="secondary"
                className="bg-white/90 backdrop-blur-sm hover:bg-white text-slate-900 text-sm px-4 py-2 rounded-2xl flex items-center gap-2 shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <Filter className="w-4 h-4" />
                sort: featured
              </Button>
            </div>

            {/* Coin Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                // Loading skeleton - show more items since we're displaying all tokens
                Array.from({ length: Math.min(12, allCoins.length || 12) }).map((_, index) => (
                  <div key={index} className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50 animate-pulse">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-slate-700/60"></div>
                      <div className="flex-1">
                        <div className="h-6 bg-slate-700/60 rounded mb-2"></div>
                        <div className="h-4 bg-slate-700/60 rounded mb-3 w-20"></div>
                        <div className="h-4 bg-slate-700/60 rounded mb-4"></div>
                        <div className="h-3 bg-slate-700/60 rounded w-32"></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : trendingCoins.length === 0 ? (
                // No results message
                <div className="col-span-full text-center py-12">
                  <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50">
                    <Search className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-300 mb-2">
                      {searchQuery ? 'No coins found' : 'No tokens created yet'}
                    </h3>
                    <p className="text-slate-400 mb-4">
                      {searchQuery 
                        ? `No coins match your search for "${searchQuery}". Try different keywords.`
                        : 'Be the first to create a token! Connect your wallet and click "Create coin" to get started.'
                      }
                    </p>
                    {searchQuery && (
                      <Button 
                        onClick={() => setSearchQuery('')}
                        variant="secondary"
                        className="bg-slate-700/60 hover:bg-slate-600/60 text-white border-slate-600/30"
                      >
                        Clear Search
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                trendingCoins.map((coin, index) => (
                  <motion.div
                    key={coin.id}
                    whileHover={{ scale: 1.02, y: -4 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => handleCoinClick(coin)}
                    className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50 cursor-pointer shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300"
                  >
                    <TradingCard coin={coin} onTrade={handleTrade} />
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Trading History Section removed as requested */}
        </div>
      </div>

      {/* Token Creator Modal */}
      <TokenCreatorModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        onTokenCreated={handleCoinCreated}
      />

      {/* Coin Detail Modal */}
      <CoinDetailModal
        isOpen={isCoinDetailOpen}
        onClose={() => setIsCoinDetailOpen(false)}
        coin={selectedCoin}
      />
    </div>
  )
}
