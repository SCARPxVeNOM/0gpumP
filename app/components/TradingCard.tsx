'use client'

import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TrendingUp, TrendingDown, BarChart3, AlertCircle, CheckCircle } from 'lucide-react'
import { CoinData } from '../../lib/0gStorage'
import { blockchainTradingService, MarketData } from '../../lib/blockchainTradingService'
import CoinImage from './CoinImage'
import { useAccount } from 'wagmi'

interface TradingCardProps {
  coin: CoinData & {
    tokenAddress?: string
    telegramUrl?: string
    xUrl?: string
    discordUrl?: string
    websiteUrl?: string
  }
  onTrade?: (coin: CoinData, action: 'buy' | 'sell', amount: string) => void
  onClick?: () => void
}

export default function TradingCard({ coin, onTrade, onClick }: TradingCardProps) {
  const { address, isConnected } = useAccount()
  const [tradeAmount, setTradeAmount] = useState('')
  const [isTrading, setIsTrading] = useState(false)
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell' | null>(null)
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [hasLiquidity, setHasLiquidity] = useState(false)
  const [userBalance, setUserBalance] = useState('0')
  const [ethBalance, setEthBalance] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAddLiquidity, setShowAddLiquidity] = useState(false)
  const [liqTokenAmount, setLiqTokenAmount] = useState('')
  const [liqEthAmount, setLiqEthAmount] = useState('')
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false)

  // Load market data and check liquidity
  useEffect(() => {
    // Initialize blockchain service with user's wallet
    if (typeof window !== 'undefined' && (window as any).ethereum && isConnected) {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum)
      blockchainTradingService.initialize(provider)
    }

    if (coin.tokenAddress && isConnected) {
      loadMarketData()
      checkLiquidity()
      loadUserBalances()
    }
  }, [coin.tokenAddress, isConnected, address])

  const loadMarketData = async () => {
    try {
      if (coin.tokenAddress) {
        const data = await blockchainTradingService.getMarketData(coin.tokenAddress)
        setMarketData(data)
      }
    } catch (error) {
      console.error('Failed to load market data:', error)
    }
  }

  const handleAddLiquidity = async () => {
    if (!coin.tokenAddress) {
      setError('Token address not available')
      return
    }
    if (!liqTokenAmount || !liqEthAmount) {
      setError('Enter token and ETH amounts')
      return
    }

    setIsAddingLiquidity(true)
    setError(null)
    setSuccess(null)
    try {
      const txHash = await blockchainTradingService.addLiquidity(
        coin.tokenAddress,
        liqEthAmount,
        liqTokenAmount
      )
      setSuccess(`Liquidity added! TX: ${txHash.slice(0, 10)}...`)
      setShowAddLiquidity(false)
      setLiqTokenAmount('')
      setLiqEthAmount('')
      await checkLiquidity()
      await loadMarketData()
    } catch (e: any) {
      console.error('Add liquidity failed:', e)
      setError(e?.message || 'Failed to add liquidity')
    } finally {
      setIsAddingLiquidity(false)
    }
  }

  const checkLiquidity = async () => {
    try {
      if (coin.tokenAddress) {
        const hasPool = await blockchainTradingService.hasLiquidityPool(coin.tokenAddress)
        setHasLiquidity(hasPool)
      }
    } catch (error) {
      console.error('Failed to check liquidity:', error)
    }
  }

  const loadUserBalances = async () => {
    try {
      if (coin.tokenAddress && address) {
        const tokenBalance = await blockchainTradingService.getTokenBalance(coin.tokenAddress, address)
        const ethBalance = await blockchainTradingService.getETHBalance(address)
        setUserBalance(tokenBalance)
        setEthBalance(ethBalance)
      }
    } catch (error) {
      console.error('Failed to load balances:', error)
    }
  }

  const handleTrade = async (action: 'buy' | 'sell') => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) return
    if (!coin.tokenAddress) {
      setError('Token address not available')
      return
    }
    if (!hasLiquidity) {
      setError('No liquidity pool available for this token')
      return
    }
    
    setIsTrading(true)
    setTradeAction(action)
    setError(null)
    setSuccess(null)
    
    try {
      // Execute real blockchain trade
      const trade = await blockchainTradingService.executeTrade(
        coin.tokenAddress,
        action,
        tradeAmount
      )
      
      setSuccess(`Trade executed successfully! TX: ${trade.txHash?.slice(0, 10)}...`)
      
      if (onTrade) {
        onTrade(coin, action, tradeAmount)
      }
      
      // Refresh balances and market data
      await loadUserBalances()
      await loadMarketData()
      
      // Reset form
      setTradeAmount('')
      setTradeAction(null)
    } catch (error: any) {
      console.error('Trade failed:', error)
      setError(error.message || 'Trade execution failed')
    } finally {
      setIsTrading(false)
    }
  }

  const formatPrice = (price: number) => {
    if (price === 0) return 'No Price'
    if (price < 0.0001) return `$${price.toFixed(8)}`
    if (price < 0.01) return `$${price.toFixed(6)}`
    if (price < 1) return `$${price.toFixed(4)}`
    return `$${price.toFixed(2)}`
  }

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance)
    if (num === 0) return '0'
    if (num < 0.0001) return num.toFixed(8)
    if (num < 0.01) return num.toFixed(6)
    if (num < 1) return num.toFixed(4)
    return num.toFixed(2)
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50 cursor-pointer shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300"
    >
      {/* Header with Image and Basic Info */}
      <div className="flex items-start gap-4 mb-4">
        <CoinImage coin={coin} size="md" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-lg">{coin.name}</h3>
            <span className="text-sm text-slate-400">({coin.symbol})</span>
          </div>
          <p className="text-sm text-slate-300 mb-3 leading-relaxed">{coin.description}</p>
          
          {/* Real Market Data */}
          {marketData && (
            <div className="grid grid-cols-2 gap-4 text-xs text-slate-400 mb-3">
              <div className="flex items-center justify-between">
                <span>Price:</span>
                <span className="text-slate-300">{formatPrice(marketData.currentPrice)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Market Cap:</span>
                <span className="text-slate-300">${marketData.marketCap.toLocaleString()}</span>
              </div>
            </div>
          )}
          
          {/* Liquidity Status */}
          <div className="flex items-center gap-2 mb-3">
            {hasLiquidity ? (
              <div className="flex items-center gap-1 text-green-400 text-xs">
                <CheckCircle className="w-3 h-3" />
                <span>Trading Enabled</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-yellow-400 text-xs">
                <AlertCircle className="w-3 h-3" />
                <span>No Liquidity Pool</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Balances */}
      {isConnected && (
        <div className="grid grid-cols-2 gap-4 text-xs text-slate-400 mb-4 p-3 bg-slate-700/30 rounded-lg">
          <div className="flex items-center justify-between">
            <span>Your {coin.symbol}:</span>
            <span className="text-slate-300">{formatBalance(userBalance)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Your ETH:</span>
            <span className="text-slate-300">{formatBalance(ethBalance)}</span>
          </div>
        </div>
      )}

      {/* Trading Interface */}
      {hasLiquidity ? (
        <div className="space-y-3">
          {/* Trade Amount Input */}
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Amount to trade"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              className="flex-1 bg-slate-700/60 border-slate-600/50 focus:border-purple-500/50 text-white"
              min="0"
              step="0.000001"
            />
            <Button
              variant="secondary"
              className="px-3 bg-slate-700/60 hover:bg-slate-600/60 border-slate-600/50"
              onClick={() => setTradeAmount(tradeAction === 'buy' ? ethBalance : userBalance)}
            >
              Max
            </Button>
          </div>

          {/* Buy/Sell Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={(e) => {
                e.stopPropagation()
                handleTrade('buy')
              }}
              disabled={isTrading || !tradeAmount || parseFloat(tradeAmount) <= 0 || !isConnected}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold disabled:opacity-50"
            >
              {isTrading && tradeAction === 'buy' ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              ) : (
                <TrendingUp className="w-4 h-4 mr-2" />
              )}
              {isTrading && tradeAction === 'buy' ? 'Buying...' : 'Buy'}
            </Button>
            
            <Button
              onClick={(e) => {
                e.stopPropagation()
                handleTrade('sell')
              }}
              disabled={isTrading || !tradeAmount || parseFloat(tradeAmount) <= 0 || !isConnected}
              className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold disabled:opacity-50"
            >
              {isTrading && tradeAction === 'sell' ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-2" />
              )}
              {isTrading && tradeAction === 'sell' ? 'Selling...' : 'Sell'}
            </Button>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-xs">
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-300 text-xs">
              {success}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-slate-400 text-sm mb-3">
            This token needs a liquidity pool to enable trading
          </p>
          {!showAddLiquidity ? (
            <Button
              variant="secondary"
              className="bg-slate-700/60 hover:bg-slate-600/60 border-slate-600/50"
              onClick={(e) => {
                e.stopPropagation()
                setShowAddLiquidity(true)
              }}
            >
              Add Liquidity
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Token amount"
                  value={liqTokenAmount}
                  onChange={(e) => setLiqTokenAmount(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="ETH amount"
                  value={liqEthAmount}
                  onChange={(e) => setLiqEthAmount(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="secondary"
                  className="bg-slate-700/60 hover:bg-slate-600/60 border-slate-600/50"
                  disabled={isAddingLiquidity}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAddLiquidity()
                  }}
                >
                  {isAddingLiquidity ? 'Adding...' : 'Confirm'}
                </Button>
                <Button
                  variant="secondary"
                  className="bg-slate-700/60 hover:bg-slate-600/60 border-slate-600/50"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowAddLiquidity(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4">
        <Button
          variant="secondary"
          className="flex-1 bg-slate-700/60 hover:bg-slate-600/60 border-slate-600/50 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            // TODO: Open chart view
          }}
        >
          <BarChart3 className="w-3 h-3 mr-1" />
          Chart
        </Button>
        
        <Button
          variant="secondary"
          className="flex-1 bg-slate-700/60 hover:bg-slate-600/60 border-slate-600/50 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            // TODO: Add to watchlist
          }}
        >
          ⭐ Watch
        </Button>
      </div>

      {/* Token Details (Real Data Only) */}
      <div className="mt-4 pt-4 border-t border-slate-700/30 text-xs text-slate-400">
        <div className="grid grid-cols-2 gap-2">
          <div>Contract: {coin.tokenAddress ? `${coin.tokenAddress.slice(0, 8)}...${coin.tokenAddress.slice(-6)}` : 'N/A'}</div>
          <div>Creator: {coin.creator.slice(0, 6)}...{coin.creator.slice(-4)}</div>
        </div>
        
        {/* Social Media Links (Real URLs) */}
        {(coin.telegramUrl || coin.xUrl || coin.discordUrl || coin.websiteUrl) && (
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <span>Social:</span>
            {coin.telegramUrl && (
              <a 
                href={coin.telegramUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                📱 Telegram
              </a>
            )}
            {coin.xUrl && (
              <a 
                href={coin.xUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-slate-200 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                🐦 X/Twitter
              </a>
            )}
            {coin.discordUrl && (
              <a 
                href={coin.discordUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                🎮 Discord
              </a>
            )}
            {coin.websiteUrl && (
              <a 
                href={coin.websiteUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                🌐 Website
              </a>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
