'use client'

import { useEffect, useState } from 'react'
import EnhancedTradingCard from '../components/EnhancedTradingCard'
import { bondingCurveTradingService } from '../../lib/bondingCurveTradingService'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { AlertCircle, CheckCircle, TrendingUp, TrendingDown, Zap, ArrowRight } from 'lucide-react'
import { ethers } from 'ethers'

export default function TestCurvePage() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [hasWallet, setHasWallet] = useState(false)

  // Deployed contract addresses
  const SAMPLE_TOKEN_ADDRESS = '0xC1fcb0feaa39d45b6D63948FEeB8dC83bF46B6Fa'
  const BONDING_CURVE_ADDRESS = '0x77bC0e9E529eB2bbbE44ED1EcAafAbc369b01A45'

  // Prevent hydration mismatch
  useEffect(() => {
    setIsClient(true)
    // Check if wallet is available
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      setHasWallet(true)
    }
  }, [])

  const initializeService = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = new ethers.providers.Web3Provider((window as any).ethereum)
        await bondingCurveTradingService.initialize(provider)
        setIsInitialized(true)
      } else {
        throw new Error('No wallet detected. Please install MetaMask or connect your wallet.')
      }
    } catch (err) {
      console.error('Failed to initialize service:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect to blockchain')
    }
  }

  useEffect(() => {
    if (isClient && hasWallet) {
      initializeService()
    }
  }, [isClient, hasWallet])

  // Don't render anything until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white p-8">
        <div className="max-w-6xl mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="text-gray-300 mt-4">Loading...</p>
        </div>
      </div>
    )
  }

  // Check if wallet is connected
  if (!hasWallet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              🔗 Connect Your Wallet
            </h1>
            <p className="text-xl text-gray-300">
              Please install MetaMask or another Web3 wallet to test the bonding curve trading
            </p>
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-yellow-200 text-sm">
                💡 Tip: Make sure your wallet is connected to the 0G Testnet (Chain ID: 16601)
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-400">
              ❌ Connection Error
            </h1>
            <p className="text-xl text-gray-300">{error}</p>
            <button
              onClick={initializeService}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            🚀 Bonding Curve Trading Platform
          </h1>
          <p className="text-xl text-gray-300">
            Test the pump.fun-style bonding curve with 0G tokens on 0G Testnet
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-white/5 border border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-orange-400" />
                <span>Bonding Curve</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Step-based pricing system where price increases as tokens are bought using 0G tokens
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                <span>Graduation to DEX</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                When curve fills up, liquidity automatically migrates to a standard DEX for continuous trading
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Contract Addresses */}
        <Card className="bg-white/5 border border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span>Deployed Contracts</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Sample Token:</p>
                <p className="font-mono bg-gray-800 p-2 rounded">{SAMPLE_TOKEN_ADDRESS}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Bonding Curve:</p>
                <p className="font-mono bg-gray-800 p-2 rounded">{BONDING_CURVE_ADDRESS}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trading Interface */}
        {isInitialized ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">🎯 Live Trading Interface</h2>
            <EnhancedTradingCard
              tokenAddress={SAMPLE_TOKEN_ADDRESS}
              curveAddress={BONDING_CURVE_ADDRESS}
              tokenSymbol="SAMPLE"
              tokenName="Sample Token"
            />
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
            <p className="text-gray-300">Initializing trading service...</p>
          </div>
        )}

        {/* Instructions */}
        <Card className="bg-white/5 border border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ArrowRight className="w-5 h-5 text-blue-400" />
              <span>How to Test</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-left space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">1</div>
              <div>
                <p className="font-medium">Buy tokens on the bonding curve</p>
                <p className="text-sm text-muted-foreground">Start with small amounts of 0G tokens to see the step-based pricing in action</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">2</div>
              <div>
                <p className="font-medium">Watch the price increase</p>
                <p className="text-sm text-muted-foreground">Each step increases the price by 0.1 0G tokens as tokens are bought</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">3</div>
              <div>
                <p className="font-medium">Experience graduation</p>
                <p className="text-sm text-muted-foreground">When all tokens are sold, the curve graduates to a standard DEX</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
