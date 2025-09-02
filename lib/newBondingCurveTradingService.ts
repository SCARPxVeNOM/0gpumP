import { ethers } from 'ethers'

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
  private provider: ethers.providers.Web3Provider | null = null
  private signer: ethers.Signer | null = null

  initialize(provider: ethers.providers.Web3Provider) {
    this.provider = provider
    this.signer = provider.getSigner()
  }

  // Get curve information
  async getCurveInfo(curveAddress: string): Promise<CurveInfo | null> {
    if (!this.provider) throw new Error('Service not initialized')
    
    try {
      const curve = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
      
      // Get all curve data
      const [tokenAddress, ogReserve, tokenReserve, feeBps, seeded] = await Promise.all([
        curve.token(),
        curve.ogReserve(),
        curve.tokenReserve(),
        curve.feeBps(),
        curve.seeded()
      ])

      // Calculate current price (OG per token)
      const currentPrice = ogReserve.gt(0) && tokenReserve.gt(0) 
        ? ogReserve.mul(ethers.utils.parseEther('1')).div(tokenReserve)
        : ethers.BigNumber.from(0)

      return {
        tokenAddress,
        curveAddress,
        ogReserve: ethers.utils.formatEther(ogReserve),
        tokenReserve: ethers.utils.formatEther(tokenReserve),
        currentPrice: ethers.utils.formatEther(currentPrice),
        feeBps: feeBps.toNumber ? feeBps.toNumber() : Number(feeBps),
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
      const curve = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
      const ogAmountWei = ethers.utils.parseEther(ogAmount)
      
      // Get current reserves
      const [ogReserve, tokenReserve, feeBps] = await Promise.all([
        curve.ogReserve(),
        curve.tokenReserve(),
        curve.feeBps()
      ])

      // Calculate fee
      const fee = ogAmountWei.mul(feeBps).div(10000)
      const ogInAfterFee = ogAmountWei.sub(fee)

      // Calculate tokens out using constant product formula
      const k = ogReserve.mul(tokenReserve)
      const newOgReserve = ogReserve.add(ogInAfterFee)
      const newTokenReserve = k.div(newOgReserve)
      const tokensOut = tokenReserve.sub(newTokenReserve)

      // Calculate price impact
      const priceImpact = tokensOut.mul(ethers.utils.parseEther('1')).div(ogInAfterFee)

      return {
        inputAmount: ogAmount,
        outputAmount: ethers.utils.formatEther(tokensOut),
        fee: ethers.utils.formatEther(fee),
        priceImpact: ethers.utils.formatEther(priceImpact)
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
      const curve = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
      const tokenAmountWei = ethers.utils.parseEther(tokenAmount)
      
      // Get current reserves
      const [ogReserve, tokenReserve, feeBps] = await Promise.all([
        curve.ogReserve(),
        curve.tokenReserve(),
        curve.feeBps()
      ])

      // Calculate OG out using constant product formula
      const k = ogReserve.mul(tokenReserve)
      const newTokenReserve = tokenReserve.add(tokenAmountWei)
      const newOgReserve = k.div(newTokenReserve)
      const ogOutBeforeFee = ogReserve.sub(newOgReserve)

      // Calculate fee
      const fee = ogOutBeforeFee.mul(feeBps).div(10000)
      const ogOut = ogOutBeforeFee.sub(fee)

      // Calculate price impact
      const priceImpact = ogOut.mul(ethers.utils.parseEther('1')).div(tokenAmountWei)

      return {
        inputAmount: tokenAmount,
        outputAmount: ethers.utils.formatEther(ogOut),
        fee: ethers.utils.formatEther(fee),
        priceImpact: ethers.utils.formatEther(priceImpact)
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
      const curve = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.signer)
      const ogAmountWei = ethers.utils.parseEther(ogAmount)
      const minTokensOutWei = ethers.utils.parseEther(minTokensOut)
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 1200
      
      const tx = await curve.buy(minTokensOutWei, deadline, { value: ogAmountWei })
      const receipt = await tx.wait()
      
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
      const curve = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.signer)
      const tokenAmountWei = ethers.utils.parseEther(tokenAmount)
      const minOgOutWei = ethers.utils.parseEther(minOgOut) // FIXED: Convert to BigNumber
      
      // First approve the curve to spend tokens
      const curveInfo = await this.getCurveInfo(curveAddress)
      if (!curveInfo) throw new Error('Could not get curve info')
      
      const token = new ethers.Contract(curveInfo.tokenAddress, MEME_TOKEN_ABI, this.signer)
      
      const allowance = await token.allowance(await this.signer.getAddress(), curveAddress)
      if (allowance.lt(tokenAmountWei)) {
        const approveTx = await token.approve(curveAddress, tokenAmountWei)
        await approveTx.wait()
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 1200
      
      const tx = await curve.sell(tokenAmountWei, minOgOutWei, deadline) // FIXED: Use minOgOutWei
      const receipt = await tx.wait()
      
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
      const token = new ethers.Contract(tokenAddress, MEME_TOKEN_ABI, this.provider)
      const balance = await token.balanceOf(userAddress)
      return ethers.utils.formatEther(balance)
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
      return ethers.utils.formatEther(balance)
    } catch (error) {
      console.error('Error getting native balance:', error)
      return '0'
    }
  }
}

export const newBondingCurveTradingService = new NewBondingCurveTradingService()
