'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { bondingCurveTradingService, CurveStats, BondingCurveQuote } from '../../lib/bondingCurveTradingService'
import { MarketData } from '../../lib/blockchainTradingService'
import { AlertCircle, CheckCircle, TrendingUp, TrendingDown, Zap } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'

// Import ethers directly to ensure it's available
import { ethers } from 'ethers'

interface EnhancedTradingCardProps {
  tokenAddress: string
  curveAddress?: string
  tokenName: string
  tokenSymbol: string
  tokenImage?: string
  description?: string
}

export default function EnhancedTradingCard({
  tokenAddress,
  curveAddress,
  tokenName,
  tokenSymbol,
  tokenImage,
  description
}: EnhancedTradingCardProps) {
  const { address } = useAccount()
  const [isClient, setIsClient] = useState(false)
  
  // State for trading
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell' | null>(null)
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  
  // State for data
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [curveStats, setCurveStats] = useState<CurveStats | null>(null)
  const [tradingMode, setTradingMode] = useState<'curve' | 'dex'>('curve')
  const [buyQuote, setBuyQuote] = useState<BondingCurveQuote | null>(null)
  const [sellQuote, setSellQuote] = useState<number | null>(null)
  
  // State for user balances
  const [userBalance, setUserBalance] = useState<number>(0)
  const [ethBalance, setEthBalance] = useState<number>(0)
  
  // State for UI
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Load data on mount
  useEffect(() => {
    if (isClient && address) {
      loadData()
    }
  }, [isClient, address, tokenAddress, curveAddress])

  // Handle amount change and get quotes
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      getQuotes()
    } else {
      setBuyQuote(null)
      setSellQuote(null)
    }
  }, [amount, tradingMode, tradeAction, curveAddress])

  // All hooks must be called before any conditional returns
  if (!isClient) {
    return null
  }

  // Define functions before conditional returns
  const loadData = async () => {
    try {
      setLoading(true)
      
      // Check if service is initialized
      if (!bondingCurveTradingService) {
        throw new Error('Trading service not initialized')
      }
      
      // Get trading mode
      const mode = await bondingCurveTradingService.getTradingMode(tokenAddress, curveAddress)
      setTradingMode(mode.mode)
      
      if (mode.mode === 'curve' && curveAddress) {
        // Load curve stats
        const stats = await bondingCurveTradingService.getCurveStats(curveAddress)
        setCurveStats(stats)
        
        // Set market data from curve
        setMarketData({
          currentPrice: stats.currentPrice,
          marketCap: 0, // Would need total supply
          volume24h: 0,
          change24h: 0,
          holders: 0
        })
      } else {
        // Load DEX market data
        const data = await bondingCurveTradingService.getEnhancedMarketData(tokenAddress)
        setMarketData(data)
      }
      
      // Load user balances
      if (address) {
        const tokenBalance = await bondingCurveTradingService.getTokenBalance(tokenAddress, address)
        const ethBal = await bondingCurveTradingService.getETHBalance(address)
        setUserBalance(tokenBalance)
        setEthBalance(ethBal)
      }
      
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load market data')
    } finally {
      setLoading(false)
    }
  }

  const getQuotes = async () => {
    try {
      // Check if service is initialized
      if (!bondingCurveTradingService) {
        return
      }
      
      if (tradingMode === 'curve' && curveAddress) {
        if (tradeAction === 'buy') {
          const quote = await bondingCurveTradingService.quoteCurveBuy(curveAddress, amount)
          setBuyQuote(quote)
        } else if (tradeAction === 'sell') {
          const quote = await bondingCurveTradingService.quoteCurveSell(curveAddress, amount)
          setSellQuote(quote)
        }
      }
    } catch (err) {
      console.error('Error getting quotes:', err)
    }
  }

  const handleTrade = async () => {
    if (!address || !amount || !tradeAction) return
    
    // Check if service is initialized
    if (!bondingCurveTradingService) {
      setError('Trading service not initialized')
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)
      
      const trade = await bondingCurveTradingService.executeTrade(
        tokenAddress,
        tradeAction,
        amount,
        curveAddress,
        slippage
      )
      
      setSuccess(`${tradeAction === 'buy' ? 'Bought' : 'Sold'} ${amount} ${tokenSymbol} successfully!`)
      setAmount('')
      setTradeAction(null)
      
      // Reload data
      await loadData()
      
    } catch (err) {
      console.error('Trade failed:', err)
      setError(`Failed to ${tradeAction} ${tokenSymbol}`)
    } finally {
      setLoading(false)
    }
  }

  const handleMax = () => {
    if (tradeAction === 'buy') {
      setAmount(ethBalance.toString())
    } else {
      setAmount(userBalance.toString())
    }
  }

  // Show loading state if service is not initialized
  if (!bondingCurveTradingService) {
    return (
      <Card className="w-full max-w-md bg-white/5 border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Loading...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
            <p className="text-sm text-muted-foreground">Initializing trading service...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md bg-white/5 border border-white/10">
      <CardHeader>
        <div className="flex items-center space-x-3">
          {tokenImage && (
            <img 
              src={tokenImage} 
              alt={tokenName}
              className="w-10 h-10 rounded-full"
            />
          )}
          <div>
            <CardTitle className="text-lg font-semibold">{tokenName}</CardTitle>
            <p className="text-sm text-muted-foreground">{tokenSymbol}</p>
          </div>
        </div>
        
        {/* Trading Mode Badge */}
        <div className="flex items-center space-x-2">
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            tradingMode === 'curve' 
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            {tradingMode === 'curve' ? (
              <>
                <Zap className="w-3 h-3 inline mr-1" />
                Bonding Curve
              </>
            ) : (
              <>
                <TrendingUp className="w-3 h-3 inline mr-1" />
                DEX Trading
              </>
            )}
          </div>
          
          {curveStats && tradingMode === 'curve' && (
            <div className="text-xs text-muted-foreground">
              Step {curveStats.currentStep} • {curveStats.remainingTokens.toFixed(0)} tokens left
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Market Data */}
        {marketData && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Price</p>
              <p className="font-semibold">
                {marketData.currentPrice ? `$${marketData.currentPrice.toFixed(6)}` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Market Cap</p>
              <p className="font-semibold">
                {marketData.marketCap ? `$${marketData.marketCap.toLocaleString()}` : 'N/A'}
              </p>
            </div>
            {tradingMode === 'curve' && curveStats && (
              <>
                <div>
                  <p className="text-muted-foreground">ETH Reserve</p>
                  <p className="font-semibold">{curveStats.ethReserve.toFixed(4)} ETH</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tokens Sold</p>
                  <p className="font-semibold">{curveStats.tokensSold.toFixed(0)}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* User Balances */}
        {address && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Your {tokenSymbol}</p>
              <p className="font-semibold">{userBalance.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Your 0G</p>
              <p className="font-semibold">{ethBalance.toFixed(4)}</p>
            </div>
          </div>
        )}

        {/* Trading Interface */}
        <div className="space-y-3">
          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Button
              variant={tradeAction === 'buy' ? 'default' : 'secondary'}
              onClick={() => setTradeAction('buy')}
              className="flex-1"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Buy
            </Button>
            <Button
              variant={tradeAction === 'sell' ? 'default' : 'secondary'}
              onClick={() => setTradeAction('sell')}
              className="flex-1"
            >
              <TrendingDown className="w-4 h-4 mr-2" />
              Sell
            </Button>
          </div>

          {/* Amount Input */}
          {tradeAction && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Amount to ${tradeAction}`}
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleMax}
                  className="text-xs"
                >
                  Max
                </Button>
              </div>

              {/* Quote Display */}
              {amount && parseFloat(amount) > 0 && (
                <div className="text-sm text-muted-foreground">
                  {tradeAction === 'buy' && buyQuote && (
                    <p>You'll receive ~{buyQuote.tokenAmount.toFixed(2)} {tokenSymbol}</p>
                  )}
                  {tradeAction === 'sell' && sellQuote && (
                    <p>You'll receive ~{sellQuote.toFixed(6)} 0G</p>
                  )}
                </div>
              )}

              {/* Trade Button */}
              <Button
                onClick={handleTrade}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className="w-full"
              >
                {loading ? 'Processing...' : `${tradeAction === 'buy' ? 'Buy' : 'Sell'} ${tokenSymbol}`}
              </Button>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {error && (
          <div className="flex items-center space-x-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="flex items-center space-x-2 text-green-400 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>{success}</span>
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
