import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { bondingCurveTradingService, CurveInfo, TradingQuote, TradingResult } from './bondingCurveTradingService'

export interface UseBondingCurveReturn {
  // State
  curveInfo: CurveInfo | null
  isLoading: boolean
  error: string | null
  
  // Trading state
  buyQuote: TradingQuote | null
  sellQuote: TradingQuote | null
  isTrading: boolean
  lastTrade: TradingResult | null
  
  // Actions
  refreshCurveInfo: () => Promise<void>
  getBuyQuote: (tokenAmount: string) => Promise<void>
  getSellQuote: (tokenAmount: string) => Promise<void>
  buyTokens: (tokenAmount: string, maxCost: string, slippageTolerance?: number) => Promise<TradingResult>
  sellTokens: (tokenAmount: string, minReturn: string, slippageTolerance?: number) => Promise<TradingResult>
  
  // Utilities
  getTokenBalance: (tokenAddress: string, userAddress: string) => Promise<string>
  getNativeBalance: (userAddress: string) => Promise<string>
  
  // Event listening
  startListening: () => void
  stopListening: () => void
}

export function useBondingCurve(
  curveAddress: string | null,
  provider: ethers.providers.Web3Provider | null
): UseBondingCurveReturn {
  // State
  const [curveInfo, setCurveInfo] = useState<CurveInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Trading state
  const [buyQuote, setBuyQuote] = useState<TradingQuote | null>(null)
  const [sellQuote, setSellQuote] = useState<TradingQuote | null>(null)
  const [isTrading, setIsTrading] = useState(false)
  const [lastTrade, setLastTrade] = useState<TradingResult | null>(null)
  
  // Initialize service when provider changes
  useEffect(() => {
    if (provider) {
      bondingCurveTradingService.initialize(provider)
    }
  }, [provider])
  
  // Refresh curve info
  const refreshCurveInfo = useCallback(async () => {
    if (!curveAddress || !provider) {
      setError('No curve address or provider')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const info = await bondingCurveTradingService.getCurveInfo(curveAddress)
      if (info) {
        setCurveInfo(info)
      } else {
        setError('Failed to get curve info')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh curve info')
    } finally {
      setIsLoading(false)
    }
  }, [curveAddress, provider])

  // Get buy quote
  const getBuyQuote = useCallback(async (tokenAmount: string) => {
    if (!curveAddress || !provider) {
      setError('No curve address or provider')
      return
    }
    
    try {
      const quote = await bondingCurveTradingService.getBuyQuote(curveAddress, tokenAmount)
      setBuyQuote(quote)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to get buy quote')
      setBuyQuote(null)
    }
  }, [curveAddress, provider])

  // Get sell quote
  const getSellQuote = useCallback(async (tokenAmount: string) => {
    if (!curveAddress || !provider) {
      setError('No curve address or provider')
      return
    }
    
    try {
      const quote = await bondingCurveTradingService.getSellQuote(curveAddress, tokenAmount)
      setSellQuote(quote)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to get sell quote')
      setSellQuote(null)
    }
  }, [curveAddress, provider])
  
  // Buy tokens
  const buyTokens = useCallback(async (
    tokenAmount: string,
    maxCost: string,
    slippageTolerance: number = 0.05
  ): Promise<TradingResult> => {
    if (!curveAddress || !provider) {
      const error = 'No curve address or provider'
      setError(error)
      return { success: false, error }
    }
    
    setIsTrading(true)
    setError(null)
    
    try {
      const result = await bondingCurveTradingService.buyTokens(
        curveAddress,
        tokenAmount,
        maxCost,
        slippageTolerance
      )
      
      if (result.success) {
        setLastTrade(result)
        // Refresh curve info after successful trade
        await refreshCurveInfo()
      } else {
        setError(result.error || 'Buy transaction failed')
      }
      
      return result
    } catch (err: any) {
      const error = err.message || 'Buy transaction failed'
      setError(error)
      return { success: false, error }
    } finally {
      setIsTrading(false)
    }
  }, [curveAddress, provider, refreshCurveInfo])
  
  // Sell tokens
  const sellTokens = useCallback(async (
    tokenAmount: string,
    minReturn: string,
    slippageTolerance: number = 0.05
  ): Promise<TradingResult> => {
    if (!curveAddress || !provider) {
      const error = 'No curve address or provider'
      setError(error)
      return { success: false, error }
    }
    
    setIsTrading(true)
    setError(null)
    
    try {
      const result = await bondingCurveTradingService.sellTokens(
        curveAddress,
        tokenAmount,
        minReturn,
        slippageTolerance
      )
      
      if (result.success) {
        setLastTrade(result)
        // Refresh curve info after successful trade
        await refreshCurveInfo()
      } else {
        setError(result.error || 'Sell transaction failed')
      }
      
      return result
    } catch (err: any) {
      const error = err.message || 'Sell transaction failed'
      setError(error)
      return { success: false, error }
    } finally {
      setIsTrading(false)
    }
  }, [curveAddress, provider, refreshCurveInfo])
  
  // Get token balance
  const getTokenBalance = useCallback(async (tokenAddress: string, userAddress: string): Promise<string> => {
    if (!provider) {
      throw new Error('No provider')
    }
    
    return await bondingCurveTradingService.getTokenBalance(tokenAddress, userAddress)
  }, [provider])
  
  // Get native balance
  const getNativeBalance = useCallback(async (userAddress: string): Promise<string> => {
    if (!provider) {
      throw new Error('No provider')
    }
    
    return await bondingCurveTradingService.getNativeBalance(userAddress)
  }, [provider])
  
  // Start listening for events
  const startListening = useCallback(() => {
    if (!curveAddress || !provider) {
      return
    }
    
    bondingCurveTradingService.listenForCurveEvents(curveAddress, {
      onBuy: (buyer: string, ogIn: string, tokensOut: string, price: string) => {
        console.log(`🟢 Buy: ${buyer} bought ${tokensOut} tokens for ${ogIn} 0G at ${price} 0G/token`)
        // Refresh curve info when trades happen
        refreshCurveInfo()
      },
      onSell: (seller: string, tokensIn: string, ogOut: string, price: string) => {
        console.log(`🔴 Sell: ${seller} sold ${tokensIn} tokens for ${ogOut} 0G at ${price} 0G/token`)
        // Refresh curve info when trades happen
        refreshCurveInfo()
      },
      onPriceUpdate: (price: string, supply: string, ogReserve: string) => {
        console.log(`📊 Price update: ${price} 0G/token, Supply: ${supply}, Reserve: ${ogReserve} 0G`)
        // Update local state
        if (curveInfo) {
          setCurveInfo(prev => prev ? {
            ...prev,
            currentPrice: price,
            tokensSold: supply,
            nativeReserve: ogReserve
          } : null)
        }
      },
      onStepAdvance: (step: number, price: string) => {
        console.log(`📈 Step advanced: Step ${step}, Price: ${price} 0G/token`)
        // Update local state
        if (curveInfo) {
          setCurveInfo(prev => prev ? {
            ...prev,
            currentStep: step,
            currentPrice: price
          } : null)
        }
      },
      onGraduation: (tokensSold: string, ogReserve: string, timestamp: number) => {
        console.log(`🎓 Curve graduated: ${tokensSold} tokens sold, ${ogReserve} 0G reserve`)
        // Update local state
        if (curveInfo) {
          setCurveInfo(prev => prev ? {
            ...prev,
            isGraduated: true
          } : null)
        }
      }
    })
  }, [curveAddress, provider, curveInfo, refreshCurveInfo])
  
  // Stop listening for events
  const stopListening = useCallback(() => {
    if (curveAddress) {
      bondingCurveTradingService.stopListening(curveAddress)
    }
  }, [curveAddress])
  
  // Auto-refresh curve info when address changes
  useEffect(() => {
    if (curveAddress && provider) {
      refreshCurveInfo()
    }
  }, [curveAddress, provider, refreshCurveInfo])
  
  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  return {
    // State
    curveInfo,
    isLoading,
    error,
    
    // Trading state
    buyQuote,
    sellQuote,
    isTrading,
    lastTrade,
    
    // Actions
    refreshCurveInfo,
    getBuyQuote,
    getSellQuote,
    buyTokens,
    sellTokens,
    
    // Utilities
    getTokenBalance,
    getNativeBalance,
    
    // Event listening
    startListening,
    stopListening
  }
}
