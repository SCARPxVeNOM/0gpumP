'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TrendingUp, TrendingDown, BarChart3, AlertCircle, CheckCircle, Zap, RefreshCw } from 'lucide-react'
import { CoinData } from '../../lib/0gStorage'
import { blockchainTradingService, MarketData } from '../../lib/blockchainTradingService'
import { autoTradingService, TradingStatus } from '../../lib/autoTradingService'
import { automatedTokenCreator, TokenCreationParams } from '../../lib/automatedTokenCreator'
import CoinImage from './CoinImage'
import { useAccount } from 'wagmi'
import { ethers } from 'ethers'

interface AutoTradingCardProps {
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

export default function AutoTradingCard({ coin, onTrade, onClick }: AutoTradingCardProps) {
  const { address, isConnected } = useAccount()
  const [tradeAmount, setTradeAmount] = useState('')
  const [isTrading, setIsTrading] = useState(false)
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell' | null>(null)
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [tradingStatus, setTradingStatus] = useState<TradingStatus | null>(null)
  const [userBalance, setUserBalance] = useState('0')
  const [ethBalance, setEthBalance] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isEnablingTrading, setIsEnablingTrading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Initialize services
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum && isConnected) {
      const initializeServices = async () => {
        try {
          const provider = new ethers.providers.Web3Provider((window as any).ethereum)
          
          // Initialize blockchain trading service
          await blockchainTradingService.initialize(provider)
          
          // Initialize auto trading service (you'll need to import the config)
          // await autoTradingService.initialize(provider, AUTO_TRADING_CONFIG)
          
          // Initialize automated token creator
          // await automatedTokenCreator.initialize(provider, AUTO_TRADING_CONFIG)
          
        } catch (error) {
          console.error('Failed to initialize services:', error)
        }
      }
      
      initializeServices()
    }
  }, [isConnected])

  // Load data
  useEffect(() => {
    if (coin.tokenAddress && isConnected) {
      loadData()
    }
  }, [coin.tokenAddress, isConnected, address])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Load market data
      if (coin.tokenAddress) {
        const data = await blockchainTradingService.getMarketData(coin.tokenAddress)
        setMarketData(data)
      }

      // Check trading status
      if (coin.tokenAddress) {
        const status = await autoTradingService.checkTradingStatus(coin.tokenAddress)
        setTradingStatus(status)
      }

      // Load user balances
      if (coin.tokenAddress && address) {
        const tokenBalance = await blockchainTradingService.getTokenBalance(coin.tokenAddress, address)
        const ethBalance = await blockchainTradingService.getETHBalance(address)
        setUserBalance(tokenBalance)
        setEthBalance(ethBalance)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEnableTrading = async () => {
    if (!coin.tokenAddress) {
      setError('Token address not available')
      return
    }

    setIsEnablingTrading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await autoTradingService.enableTradingForToken(coin.tokenAddress)
      
      if (result.success) {
        setSuccess('Trading enabled successfully!')
        await loadData() // Refresh data
      } else {
        setError(result.error || 'Failed to enable trading')
      }
    } catch (error: any) {
      console.error('Enable trading failed:', error)
      setError(error.message || 'Failed to enable trading')
    } finally {
      setIsEnablingTrading(false)
    }
  }

  const handleTrade = async (action: 'buy' | 'sell') => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) return
    if (!coin.tokenAddress) {
      setError('Token address not available')
      return
    }
    if (!tradingStatus?.isEnabled) {
      setError('Trading not enabled for this token')
      return
    }
    
    setIsTrading(true)
    setTradeAction(action)
    setError(null)
    setSuccess(null)
    
    try {
      const trade = await blockchainTradingService.executeTrade(
        coin.tokenAddress,
        action,
        tradeAmount
      )
      
      setSuccess(`Trade executed successfully! TX: ${trade.txHash?.slice(0, 10)}...`)
      
      if (onTrade) {
        onTrade(coin, action, tradeAmount)
      }
      
      await loadData() // Refresh data
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

  const getTradingStatusColor = () => {
    if (!tradingStatus) return 'text-slate-400'
    return tradingStatus.isEnabled ? 'text-green-400' : 'text-yellow-400'
  }

  const getTradingStatusText = () => {
    if (!tradingStatus) return 'Checking...'
    return tradingStatus.isEnabled ? 'Trading Enabled' : 'No Liquidity Pool'
  }

  return (
    <motion.div
      className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 cursor-pointer hover:bg-slate-700/50 transition-all duration-200 nb-press"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Header */}
      <div className="flex items-center space-x-3 mb-4">
        <CoinImage coin={coin} size="md" />
        <div className="flex-1">
          <h3 className="text-lg text-white" style={{ fontFamily: 'fantasy' }}>{coin.name}</h3>
          <p className="text-slate-400 text-sm">{coin.symbol}</p>
        </div>
        <div className="text-right">
          <p className="text-white font-medium">{formatPrice(marketData?.currentPrice || 0)}</p>
          <p className="text-slate-400 text-xs">
            MC: ${marketData?.marketCap ? (marketData.marketCap / 1000000).toFixed(2) + 'M' : '0'}
          </p>
        </div>
      </div>

      {/* Trading Status */}
      <div className="mb-4">
        <div className={`flex items-center space-x-2 ${getTradingStatusColor()}`}>
          {tradingStatus?.isEnabled ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">{getTradingStatusText()}</span>
          {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
        </div>
      </div>

      {/* Trading Interface */}
      {tradingStatus?.isEnabled ? (
        <div className="space-y-3">
          {/* User Balances */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div>Your {coin.symbol}: {formatBalance(userBalance)}</div>
            <div>Your ETH: {formatBalance(ethBalance)}</div>
          </div>

          {/* Trade Input */}
          <div className="flex space-x-2">
            <Input
              type="number"
              placeholder="Amount"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              className="flex-1 bg-slate-700/50 border-slate-600/50 text-white"
            />
          </div>

          {/* Trade Buttons */}
          <div className="flex space-x-2">
            <Button
              onClick={(e) => {
                e.stopPropagation()
                handleTrade('buy')
              }}
              disabled={isTrading || !tradeAmount}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {isTrading && tradeAction === 'buy' ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <TrendingUp className="w-4 h-4 mr-2" />
              )}
              Buy
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation()
                handleTrade('sell')
              }}
              disabled={isTrading || !tradeAmount}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {isTrading && tradeAction === 'sell' ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-2" />
              )}
              Sell
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-slate-400 text-sm mb-3">
            This token needs a liquidity pool to enable trading
          </p>
          <Button
            variant="neutral"
            onClick={(e) => {
              e.stopPropagation()
              handleEnableTrading()
            }}
            disabled={isEnablingTrading}
          >
            {isEnablingTrading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Enabling...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Enable Trading
              </>
            )}
          </Button>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-xs mt-3">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-300 text-xs mt-3">
          {success}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 text-xs"
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
          size="sm"
          className="flex-1 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            // TODO: Add to watchlist
          }}
        >
          ⭐ Watch
        </Button>
      </div>

      {/* Token Details */}
      <div className="mt-4 pt-4 border-t border-slate-700/30 text-xs text-slate-400">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-500">Contract:</span>
            <div className="font-mono text-xs truncate">
              {coin.tokenAddress ? `${coin.tokenAddress.slice(0, 6)}...${coin.tokenAddress.slice(-4)}` : 'N/A'}
            </div>
          </div>
          <div>
            <span className="text-slate-500">Creator:</span>
            <div className="font-mono text-xs truncate">
              {coin.creator ? `${coin.creator.slice(0, 6)}...${coin.creator.slice(-4)}` : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
