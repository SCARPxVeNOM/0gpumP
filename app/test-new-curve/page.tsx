'use client'

import React, { useState } from 'react'
import { useAccount } from 'wagmi'
import { BrowserProvider } from 'ethers'
import { newFactoryService } from '../../lib/newFactoryService'
import { newBondingCurveTradingService } from '../../lib/newBondingCurveTradingService'

export default function TestNewCurve() {
  const { isConnected, address } = useAccount()
  
  // Factory configuration
  const [factoryAddress, setFactoryAddress] = useState('0x8A1173808F4BF4A35EBb9e6BAFe91E96B2bCc93c')
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Token creation
  const [tokenName, setTokenName] = useState('TEST')
  const [tokenSymbol, setTokenSymbol] = useState('TST')
  const [seedTokenAmount, setSeedTokenAmount] = useState('1000000')
  const [seedOgAmount, setSeedOgAmount] = useState('0.5')
  const [isCreating, setIsCreating] = useState(false)
  const [creationResult, setCreationResult] = useState<any>(null)
  
  // Trading test
  const [curveAddress, setCurveAddress] = useState('')
  const [tradeAmount, setTradeAmount] = useState('')
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy')
  const [isTrading, setIsTrading] = useState(false)
  const [curveInfo, setCurveInfo] = useState<any>(null)
  const [quote, setQuote] = useState<any>(null)

  const initializeFactory = async () => {
    if (!factoryAddress) {
      alert('Please enter factory address')
      return
    }

    try {
      const eth = (typeof window !== 'undefined') ? (window as any).ethereum : undefined
      if (!eth) {
        alert('No Ethereum provider found')
        return
      }
      
      const provider = new BrowserProvider(eth)
      await newFactoryService.initialize(provider as any, factoryAddress)
      await newBondingCurveTradingService.initialize(provider)
      
      const info = await newFactoryService.getFactoryInfo()
      console.log('Factory info:', info)
      
      setIsInitialized(true)
      alert('Factory initialized successfully!')
    } catch (error: any) {
      alert(`Failed to initialize factory: ${error.message}`)
    }
  }

  const createToken = async () => {
    if (!isInitialized) {
      alert('Please initialize factory first')
      return
    }

    setIsCreating(true)
    setCreationResult(null)

    try {
      const result = await newFactoryService.createPair({
        name: tokenName,
        symbol: tokenSymbol,
        seedTokenAmount,
        seedOgAmount
      })

      setCreationResult(result)
      
      if (result.success) {
        alert(`Token created successfully!\nToken: ${result.tokenAddress}\nCurve: ${result.curveAddress}`)
        setCurveAddress(result.curveAddress)
      } else {
        alert(`Failed to create token: ${result.error}`)
      }
    } catch (error: any) {
      alert(`Error creating token: ${error.message}`)
    } finally {
      setIsCreating(false)
    }
  }

  const loadCurveInfo = async () => {
    if (!curveAddress) {
      alert('Please enter curve address')
      return
    }

    try {
      const info = await newBondingCurveTradingService.getCurveInfo(curveAddress)
      setCurveInfo(info)
      console.log('Curve info:', info)
    } catch (error: any) {
      alert(`Failed to load curve info: ${error.message}`)
    }
  }

  const getQuote = async () => {
    if (!curveAddress || !tradeAmount) {
      alert('Please enter curve address and trade amount')
      return
    }

    try {
      let quoteResult
      if (tradeType === 'buy') {
        quoteResult = await newBondingCurveTradingService.getBuyQuote(curveAddress, tradeAmount)
      } else {
        quoteResult = await newBondingCurveTradingService.getSellQuote(curveAddress, tradeAmount)
      }
      
      setQuote(quoteResult)
      console.log('Quote:', quoteResult)
    } catch (error: any) {
      alert(`Failed to get quote: ${error.message}`)
    }
  }

  const executeTrade = async () => {
    if (!curveAddress || !tradeAmount || !quote) {
      alert('Please get a quote first')
      return
    }

    setIsTrading(true)

    try {
      let result
      if (tradeType === 'buy') {
        const minTokensOut = (parseFloat(quote.outputAmount) * 0.95).toString() // 5% slippage
        result = await newBondingCurveTradingService.buyTokens(curveAddress, tradeAmount, minTokensOut)
      } else {
        const minOgOut = (parseFloat(quote.outputAmount) * 0.95).toString() // 5% slippage
        result = await newBondingCurveTradingService.sellTokens(curveAddress, tradeAmount, minOgOut)
      }

      if (result.success) {
        alert(`Trade successful! TX: ${result.txHash}`)
        // Refresh curve info
        await loadCurveInfo()
      } else {
        alert(`Trade failed: ${result.error}`)
      }
    } catch (error: any) {
      alert(`Trade failed: ${error.message}`)
    } finally {
      setIsTrading(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Test New Bonding Curve</h1>
          <p className="text-slate-400">Please connect your wallet to continue</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Test New Bonding Curve System</h1>
        
        {/* Factory Initialization */}
        <div className="bg-slate-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">1. Initialize Factory</h2>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Factory Address"
              value={factoryAddress}
              onChange={(e) => setFactoryAddress(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-700 rounded border border-slate-600"
            />
            <button
              onClick={initializeFactory}
              disabled={isInitialized}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
            >
              {isInitialized ? 'Initialized' : 'Initialize'}
            </button>
          </div>
        </div>

        {/* Token Creation */}
        <div className="bg-slate-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">2. Create Token</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="Token Name"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              className="px-3 py-2 bg-slate-700 rounded border border-slate-600"
            />
            <input
              type="text"
              placeholder="Token Symbol"
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value)}
              className="px-3 py-2 bg-slate-700 rounded border border-slate-600"
            />
            <input
              type="text"
              placeholder="Seed Token Amount"
              value={seedTokenAmount}
              onChange={(e) => setSeedTokenAmount(e.target.value)}
              className="px-3 py-2 bg-slate-700 rounded border border-slate-600"
            />
            <input
              type="text"
              placeholder="Seed OG Amount"
              value={seedOgAmount}
              onChange={(e) => setSeedOgAmount(e.target.value)}
              className="px-3 py-2 bg-slate-700 rounded border border-slate-600"
            />
          </div>
          <button
            onClick={createToken}
            disabled={!isInitialized || isCreating}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Create Token'}
          </button>
          
          {creationResult && (
            <div className="mt-4 p-4 bg-slate-700 rounded">
              <pre className="text-sm">{JSON.stringify(creationResult, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Curve Info */}
        <div className="bg-slate-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">3. Load Curve Info</h2>
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder="Curve Address"
              value={curveAddress}
              onChange={(e) => setCurveAddress(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-700 rounded border border-slate-600"
            />
            <button
              onClick={loadCurveInfo}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
            >
              Load Info
            </button>
          </div>
          
          {curveInfo && (
            <div className="mt-4 p-4 bg-slate-700 rounded">
              <h3 className="font-semibold mb-2">Curve Information:</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Token Address: {curveInfo.tokenAddress}</div>
                <div>OG Reserve: {curveInfo.ogReserve}</div>
                <div>Token Reserve: {curveInfo.tokenReserve}</div>
                <div>Current Price: {curveInfo.currentPrice}</div>
                <div>Fee: {curveInfo.feeBps / 100}%</div>
                <div>Seeded: {curveInfo.seeded ? 'Yes' : 'No'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Trading Test */}
        <div className="bg-slate-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">4. Test Trading</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <select
              value={tradeType}
              onChange={(e) => setTradeType(e.target.value as 'buy' | 'sell')}
              className="px-3 py-2 bg-slate-700 rounded border border-slate-600"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
            <input
              type="text"
              placeholder="Amount"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              className="px-3 py-2 bg-slate-700 rounded border border-slate-600"
            />
            <button
              onClick={getQuote}
              disabled={!curveAddress || !tradeAmount}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded disabled:opacity-50"
            >
              Get Quote
            </button>
          </div>
          
          {quote && (
            <div className="mt-4 p-4 bg-slate-700 rounded">
              <h3 className="font-semibold mb-2">Quote:</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Input Amount: {quote.inputAmount}</div>
                <div>Output Amount: {quote.outputAmount}</div>
                <div>Fee: {quote.fee}</div>
                <div>Price Impact: {quote.priceImpact}</div>
              </div>
              <button
                onClick={executeTrade}
                disabled={isTrading}
                className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
              >
                {isTrading ? 'Executing...' : 'Execute Trade'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
