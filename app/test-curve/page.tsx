'use client'

import React, { useState } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { ethers } from 'ethers'
import { bondingCurveTradingService } from '../../lib/bondingCurveTradingService'

export default function TestCurvePage() {
  const { address: userAddress, isConnected } = useAccount()
  const publicClient = usePublicClient()
  
  // Test state
  const [curveAddress, setCurveAddress] = useState('')
  const [testResult, setTestResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  
  // Initialize service
  React.useEffect(() => {
    if (publicClient) {
      // Convert publicClient to provider for compatibility
      const provider = {
        getSigner: () => null,
        getBalance: (address: string) => publicClient.getBalance({ address: address as any }),
        // Add other provider methods as needed
      } as any
      
      bondingCurveTradingService.initialize(provider)
    }
  }, [publicClient])
  
  const testCurve = async () => {
    if (!curveAddress) {
      setTestResult('Please enter a curve address')
      return
    }
    
    setIsLoading(true)
    setTestResult('Testing curve...')
    
    try {
      // Test getting curve info
      const curveInfo = await bondingCurveTradingService.getCurveInfo(curveAddress)
      
      if (curveInfo) {
        setTestResult(JSON.stringify(curveInfo, null, 2))
      } else {
        setTestResult('Failed to get curve info')
      }
    } catch (error: any) {
      setTestResult(`Error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }
  
  const testBuyQuote = async () => {
    if (!curveAddress) {
      setTestResult('Please enter a curve address')
      return
    }
    
    setIsLoading(true)
    setTestResult('Getting buy quote...')
    
    try {
      const quote = await bondingCurveTradingService.getBuyQuote(curveAddress, '100')
      setTestResult(JSON.stringify(quote, null, 2))
    } catch (error: any) {
      setTestResult(`Error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }
  
  const testSellQuote = async () => {
    if (!curveAddress) {
      setTestResult('Please enter a curve address')
      return
    }
    
    setIsLoading(true)
    setTestResult('Getting sell quote...')
    
    try {
      const quote = await bondingCurveTradingService.getSellQuote(curveAddress, '100')
      setTestResult(JSON.stringify(quote, null, 2))
    } catch (error: any) {
      setTestResult(`Error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Bonding Curve Test Page</h1>
        
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Curve Address
            </label>
            <input
              type="text"
              value={curveAddress}
              onChange={(e) => setCurveAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={testCurve}
              disabled={isLoading}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-400"
            >
              Test Curve Info
            </button>
            
            <button
              onClick={testBuyQuote}
              disabled={isLoading}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors disabled:bg-gray-400"
            >
              Test Buy Quote
            </button>
            
            <button
              onClick={testSellQuote}
              disabled={isLoading}
              className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors disabled:bg-gray-400"
            >
              Test Sell Quote
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          
          {isLoading && (
            <div className="flex items-center space-x-2 mb-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="text-gray-600">Loading...</span>
            </div>
          )}
          
          {testResult && (
            <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              {testResult}
            </pre>
          )}
        </div>
        
        <div className="mt-8 text-center text-gray-600">
          <p>Use this page to test bonding curve functionality before integrating with the main app.</p>
          <p>Make sure you have a valid curve address from a deployed BondingCurveAMM contract.</p>
        </div>
      </div>
    </div>
  )
}
