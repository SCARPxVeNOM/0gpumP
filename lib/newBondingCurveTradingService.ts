import { ethers, BrowserProvider, Contract, formatEther, parseEther } from 'ethers'

// ABI for the new BondingCurve contract
const BONDING_CURVE_ABI = [
  'function token() view returns (address)',
  'function treasury() view returns (address)',
  'function feeBps() view returns (uint16)',
  'function ogReserve() view returns (uint256)',
  'function tokenReserve() view returns (uint256)',
  'function seeded() view returns (bool)',
  'function buy(uint256 minTokensOut, uint256 deadline) external payable',
  'function sell(uint256 tokensIn, uint256 minOgOut, uint256 deadline) external',
  'function setFeeBps(uint16 _feeBps) external',
  'function setTreasury(address _treasury) external',
  'event Buy(address indexed buyer, uint256 ogIn, uint256 tokensOut, uint256 priceImpact)',
  'event Sell(address indexed seller, uint256 tokensIn, uint256 ogOut, uint256 priceImpact)',
  'event Seeded(uint256 ogReserve, uint256 tokenReserve)'
]

// ABI for the new MemeToken contract
const MEME_TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function transfer(address to, uint256 amount) external returns (bool)'
]

export interface CurveInfo {
  tokenAddress: string
  curveAddress: string
  ogReserve: string
  tokenReserve: string
  currentPrice: string
  feeBps: number
  seeded: boolean
}

export interface BuyQuote {
  inputAmount: string // OG amount
  outputAmount: string // Token amount
  fee: string
  priceImpact: string
}

export interface SellQuote {
  inputAmount: string // Token amount
  outputAmount: string // OG amount
  fee: string
  priceImpact: string
}

export class NewBondingCurveTradingService {
  private provider: BrowserProvider | null = null
  private signer: any = null

  async initialize(provider: BrowserProvider) {
    this.provider = provider
    this.signer = await provider.getSigner()
  }

  // Get curve information
  async getCurveInfo(curveAddress: string): Promise<CurveInfo | null> {
    if (!this.provider) throw new Error('Service not initialized')
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
      
      // Get all curve data
      const [tokenAddress, ogReserve, tokenReserve, feeBps, seeded] = await Promise.all([
        curve.token(),
        curve.ogReserve(),
        curve.tokenReserve(),
        curve.feeBps(),
        curve.seeded()
      ])

      // Calculate current price (OG per token)
      const currentPrice = ogReserve > 0n && tokenReserve > 0n 
        ? (ogReserve * parseEther('1')) / tokenReserve
        : 0n

      return {
        tokenAddress,
        curveAddress,
        ogReserve: formatEther(ogReserve),
        tokenReserve: formatEther(tokenReserve),
        currentPrice: formatEther(currentPrice),
        feeBps: Number(feeBps),
        seeded
      }
    } catch (error) {
      console.error('Error getting curve info:', error)
      return null
    }
  }

  // Get buy quote
  async getBuyQuote(curveAddress: string, ogAmount: string): Promise<BuyQuote | null> {
    if (!this.provider) throw new Error('Service not initialized')
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
      const ogAmountWei = parseEther(ogAmount)
      
      // Get current reserves
      const [ogReserve, tokenReserve, feeBps] = await Promise.all([
        curve.ogReserve(),
        curve.tokenReserve(),
        curve.feeBps()
      ])

      // Calculate fee
      const fee = (ogAmountWei * BigInt(feeBps)) / 10000n
      const ogInAfterFee = ogAmountWei - fee

      // Calculate tokens out using constant product formula
      const k = ogReserve * tokenReserve
      const newOgReserve = ogReserve + ogInAfterFee
      const newTokenReserve = k / newOgReserve
      const tokensOut = tokenReserve - newTokenReserve

      // Calculate price impact
      const priceImpact = (tokensOut * parseEther('1')) / ogInAfterFee

      return {
        inputAmount: ogAmount,
        outputAmount: formatEther(tokensOut),
        fee: formatEther(fee),
        priceImpact: formatEther(priceImpact)
      }
    } catch (error) {
      console.error('Error getting buy quote:', error)
      return null
    }
  }

  // Get sell quote
  async getSellQuote(curveAddress: string, tokenAmount: string): Promise<SellQuote | null> {
    if (!this.provider) throw new Error('Service not initialized')
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
      const tokenAmountWei = parseEther(tokenAmount)
      
      // Get current reserves
      const [ogReserve, tokenReserve, feeBps] = await Promise.all([
        curve.ogReserve(),
        curve.tokenReserve(),
        curve.feeBps()
      ])

      // Calculate OG out using constant product formula
      const k = ogReserve * tokenReserve
      const newTokenReserve = tokenReserve + tokenAmountWei
      const newOgReserve = k / newTokenReserve
      const ogOutBeforeFee = ogReserve - newOgReserve

      // Calculate fee
      const fee = (ogOutBeforeFee * BigInt(feeBps)) / 10000n
      const ogOut = ogOutBeforeFee - fee

      // Calculate price impact
      const priceImpact = (ogOut * parseEther('1')) / tokenAmountWei

      return {
        inputAmount: tokenAmount,
        outputAmount: formatEther(ogOut),
        fee: formatEther(fee),
        priceImpact: formatEther(priceImpact)
      }
    } catch (error) {
      console.error('Error getting sell quote:', error)
      return null
    }
  }

  // Execute buy
  async buyTokens(curveAddress: string, ogAmount: string, minTokensOut: string): Promise<{ success: boolean; txHash: string; error?: string }> {
    if (!this.signer) throw new Error('No signer available')
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_ABI, this.signer)
      const ogAmountWei = parseEther(ogAmount)
      const minTokensOutWei = parseEther(minTokensOut)
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 1200
      
      const tx = await curve.buy(minTokensOutWei, deadline, { value: ogAmountWei })
      const receipt = await tx.wait()
      
      // Record trading transaction
      try {
        const userAddress = await this.signer.getAddress()
        const curveInfo = await this.getCurveInfo(curveAddress)
        if (curveInfo) {
          await this.recordTradingTransaction({
            coinId: curveInfo.tokenAddress, // Use token address as coinId
            userAddress,
            txHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            timestamp: Math.floor(Date.now() / 1000),
            type: 'buy',
            amount: minTokensOut,
            amountOg: parseFloat(ogAmount),
            price: parseFloat(ogAmount) / parseFloat(minTokensOut),
            volume: parseFloat(ogAmount),
            gasUsed: receipt.gasUsed?.toString() || '0',
            gasPrice: receipt.gasPrice?.toString() || '0'
          })
        }
      } catch (recordError) {
        console.warn('Failed to record trading transaction:', recordError)
      }
      
      return {
        success: true,
        txHash: receipt.transactionHash
      }
    } catch (error: any) {
      return {
        success: false,
        txHash: '',
        error: error.message
      }
    }
  }

  // Execute sell - FIXED: Now properly converts minOgOut to BigNumber
  async sellTokens(curveAddress: string, tokenAmount: string, minOgOut: string): Promise<{ success: boolean; txHash: string; error?: string }> {
    if (!this.signer) throw new Error('No signer available')
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_ABI, this.signer)
      const tokenAmountWei = parseEther(tokenAmount)
      const minOgOutWei = parseEther(minOgOut) // FIXED: Convert to BigNumber
      
      // First approve the curve to spend tokens
      const curveInfo = await this.getCurveInfo(curveAddress)
      if (!curveInfo) throw new Error('Could not get curve info')
      
      const token = new Contract(curveInfo.tokenAddress, MEME_TOKEN_ABI, this.signer)
      
      const allowance = await token.allowance(await this.signer.getAddress(), curveAddress)
      if (allowance < tokenAmountWei) {
        const approveTx = await token.approve(curveAddress, tokenAmountWei)
        await approveTx.wait()
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 1200
      
      const tx = await curve.sell(tokenAmountWei, minOgOutWei, deadline) // FIXED: Use minOgOutWei
      const receipt = await tx.wait()
      
      // Record trading transaction
      try {
        const userAddress = await this.signer.getAddress()
        await this.recordTradingTransaction({
          coinId: curveInfo.tokenAddress, // Use token address as coinId
          userAddress,
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          timestamp: Math.floor(Date.now() / 1000),
          type: 'sell',
          amount: tokenAmount,
          amountOg: parseFloat(minOgOut),
          price: parseFloat(minOgOut) / parseFloat(tokenAmount),
          volume: parseFloat(minOgOut),
          gasUsed: receipt.gasUsed?.toString() || '0',
          gasPrice: receipt.gasPrice?.toString() || '0'
        })
      } catch (recordError) {
        console.warn('Failed to record trading transaction:', recordError)
      }
      
      return {
        success: true,
        txHash: receipt.transactionHash
      }
    } catch (error: any) {
      return {
        success: false,
        txHash: '',
        error: error.message
      }
    }
  }

  // Get token balance
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    if (!this.provider) throw new Error('Service not initialized')
    
    try {
      const token = new Contract(tokenAddress, MEME_TOKEN_ABI, this.provider)
      const balance = await token.balanceOf(userAddress)
      return formatEther(balance)
    } catch (error) {
      console.error('Error getting token balance:', error)
      return '0'
    }
  }

  // Get native balance (OG)
  async getNativeBalance(userAddress: string): Promise<string> {
    if (!this.provider) throw new Error('Service not initialized')
    
    try {
      const balance = await this.provider.getBalance(userAddress)
      return formatEther(balance)
    } catch (error) {
      console.error('Error getting native balance:', error)
      return '0'
    }
  }

  // Record trading transaction to backend
  private async recordTradingTransaction(transactionData: {
    coinId: string
    userAddress: string
    txHash: string
    blockNumber: number
    timestamp: number
    type: 'buy' | 'sell'
    amount: string
    amountOg: number
    price: number
    volume: number
    gasUsed: string
    gasPrice: string
  }) {
    try {
      const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
      await fetch(`${backendBase}/trading/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData)
      })
    } catch (error) {
      console.error('Failed to record trading transaction:', error)
    }
  }
}

export const newBondingCurveTradingService = new NewBondingCurveTradingService()
