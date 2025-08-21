import { ethers } from 'ethers'
import { blockchainTradingService, Trade } from './blockchainTradingService'

// Bonding Curve ABI
const BONDING_CURVE_ABI = [
  'function getCurrentStep() external view returns (uint256)',
  'function getCurrentPrice() external view returns (uint256)',
  'function quoteBuy(uint256 qty) external view returns (uint256 totalCost)',
  'function quoteSell(uint256 qty) external view returns (uint256 ogReceived)',
  'function buy(uint256 qty, uint256 maxCost) external payable',
  'function sell(uint256 qty, uint256 minReturn) external',
  'function getCurveStats() external view returns (uint256 currentStep, uint256 currentPrice, uint256 tokensSold, uint256 nativeReserveAmount, bool isGraduated, uint256 remainingTokens)',
  'function graduated() external view returns (bool)',
  'event Trade(address indexed trader, bool isBuy, uint256 qty, uint256 costOrProceeds, uint256 stepIndex)',
  'event Graduated(uint256 tokensSoldOnCurve, uint256 nativeReserve, uint256 timestamp)',
  'event StepAdvanced(uint256 newStep, uint256 newPrice)'
]

// Liquidity Migrator ABI
const MIGRATOR_ABI = [
  'function migrateLiquidity(address token, uint256 tokenAmount, uint256 ethAmount) external',
  'function getMigrationStatus(address token) external view returns (bool isMigrated, address pairAddress, uint256 tokenBalance, uint256 ethBalance)',
  'function migratedTokens(address token) external view returns (bool)'
]

// Enhanced interfaces
export interface CurveStats {
  currentStep: number
  currentPrice: number
  tokensSold: number
  ethReserve: number
  isGraduated: boolean
  remainingTokens: number
}

export interface BondingCurveQuote {
  tokenAmount: number
  totalCost: number
  currentStep: number
  currentPrice: number
}

export interface TradingMode {
  mode: 'curve' | 'dex'
  curveAddress?: string
  dexPairAddress?: string
}

export interface EnhancedTrade extends Trade {
  mode: 'curve' | 'dex'
  curveStep?: number
  curvePrice?: number
}

// Main service class
class BondingCurveTradingService {
  private provider: ethers.providers.Web3Provider | null = null
  private signer: ethers.Signer | null = null
  
  // Contract addresses
  private MIGRATOR_ADDRESS = '0x537674873df0020F8B622172a46F99c1C94F99Fb' // Deployed migrator
  
  // Contract instances
  private migratorContract: ethers.Contract | null = null
  
  // Initialize the service
  async initialize(provider: ethers.providers.Web3Provider) {
    this.provider = provider
    this.signer = provider.getSigner()
    
    // Initialize blockchain trading service
    await blockchainTradingService.initialize(provider)
    
    // Initialize migrator contract if address is set
    if (this.MIGRATOR_ADDRESS) {
      this.migratorContract = new ethers.Contract(this.MIGRATOR_ADDRESS, MIGRATOR_ABI, this.signer)
    }
  }
  
  // Set migrator address (called after deployment)
  setMigratorAddress(address: string) {
    this.MIGRATOR_ADDRESS = address
    if (this.signer) {
      this.migratorContract = new ethers.Contract(address, MIGRATOR_ABI, this.signer)
    }
  }
  
  // Get trading mode for a token
  async getTradingMode(tokenAddress: string, curveAddress?: string): Promise<TradingMode> {
    if (!curveAddress) {
      // No curve address provided, check if token has DEX liquidity
      const hasLiquidity = await blockchainTradingService.hasLiquidityPool(tokenAddress)
      return {
        mode: hasLiquidity ? 'dex' : 'curve',
        dexPairAddress: hasLiquidity ? await blockchainTradingService.getLiquidityPool(tokenAddress).then(pool => pool?.tokenPrice ? 'exists' : undefined) : undefined
      }
    }
    
    // Check if curve has graduated
    const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider!)
    const isGraduated = await curveContract.graduated()
    
    if (isGraduated) {
      // Check if migrated to DEX
      if (this.migratorContract) {
        const isMigrated = await this.migratorContract.migratedTokens(tokenAddress)
        if (isMigrated) {
          const status = await this.migratorContract.getMigrationStatus(tokenAddress)
          return {
            mode: 'dex',
            dexPairAddress: status.pairAddress
          }
        }
      }
    }
    
    return {
      mode: 'curve',
      curveAddress
    }
  }
  
  // Get curve statistics
  async getCurveStats(curveAddress: string): Promise<CurveStats> {
    if (!this.provider) throw new Error('Service not initialized')
    
    const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
    const stats = await curveContract.getCurveStats()
    
    return {
      currentStep: stats.currentStep.toNumber(),
      currentPrice: parseFloat(ethers.utils.formatEther(stats.currentPrice)),
      tokensSold: parseFloat(ethers.utils.formatEther(stats.tokensSold)),
      ethReserve: parseFloat(ethers.utils.formatEther(stats.ogReserveAmount)), // Updated to ogReserve
      isGraduated: stats.isGraduated,
      remainingTokens: parseFloat(ethers.utils.formatEther(stats.remainingTokens))
    }
  }
  
  // Quote buy on bonding curve
  async quoteCurveBuy(curveAddress: string, tokenQty: string): Promise<BondingCurveQuote> {
    if (!this.provider) throw new Error('Service not initialized')
    
    const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
    const tokenQtyWei = ethers.utils.parseEther(tokenQty)
    
    const totalCost = await curveContract.quoteBuy(tokenQtyWei)
    const currentStep = await curveContract.getCurrentStep()
    const currentPrice = await curveContract.getCurrentPrice()
    
    return {
      tokenAmount: parseFloat(tokenQty),
      totalCost: parseFloat(ethers.utils.formatEther(totalCost)),
      currentStep: currentStep.toNumber(),
      currentPrice: parseFloat(ethers.utils.formatEther(currentPrice))
    }
  }
  
  // Quote sell on bonding curve
  async quoteCurveSell(curveAddress: string, tokenQty: string): Promise<number> {
    if (!this.provider) throw new Error('Service not initialized')
    
    const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
    const tokenQtyWei = ethers.utils.parseEther(tokenQty)
    
    const ogReceived = await curveContract.quoteSell(tokenQtyWei)
    return parseFloat(ethers.utils.formatEther(ogReceived))
  }
  
  // Execute trade (handles both curve and DEX)
  async executeTrade(
    tokenAddress: string,
    action: 'buy' | 'sell',
    amount: string,
    curveAddress?: string,
    slippageTolerance: number = 0.5
  ): Promise<EnhancedTrade> {
    // Determine trading mode
    const tradingMode = await this.getTradingMode(tokenAddress, curveAddress)
    
    if (tradingMode.mode === 'curve' && curveAddress) {
      return this.executeCurveTrade(curveAddress, action, amount, slippageTolerance)
    } else {
      // Use existing DEX trading
      const trade = await blockchainTradingService.executeTrade(tokenAddress, action, amount, slippageTolerance)
      return {
        ...trade,
        mode: 'dex'
      }
    }
  }
  
  // Execute trade on bonding curve
  private async executeCurveTrade(
    curveAddress: string,
    action: 'buy' | 'sell',
    amount: string,
    slippageTolerance: number
  ): Promise<EnhancedTrade> {
    if (!this.signer) throw new Error('Service not initialized')
    
    const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.signer)
    const currentStep = await curveContract.getCurrentStep()
    const currentPrice = await curveContract.getCurrentPrice()
    
    const trade: EnhancedTrade = {
      id: Date.now().toString(),
      tokenAddress: await curveContract.token(),
      action,
      amount,
      timestamp: Date.now(),
      status: 'pending',
      mode: 'curve',
      curveStep: currentStep.toNumber(),
      curvePrice: parseFloat(ethers.utils.formatEther(currentPrice))
    }
    
    try {
      let tx
      
      if (action === 'buy') {
        const tokenQtyWei = ethers.utils.parseEther(amount)
        const quote = await this.quoteCurveBuy(curveAddress, amount)
        const maxCost = ethers.utils.parseEther((quote.totalCost * 1.01).toString()) // 1% slippage protection
        
        tx = await curveContract.buy(tokenQtyWei, maxCost, { value: maxCost })
      } else {
        const tokenQtyWei = ethers.utils.parseEther(amount)
        const quote = await this.quoteCurveSell(curveAddress, amount)
        const minReturn = ethers.utils.parseEther((quote * 0.99).toString()) // 1% slippage protection
        
        // Approve curve to spend tokens
        const tokenContract = new ethers.Contract(await curveContract.token(), [
          'function approve(address spender, uint256 amount) external returns (bool)'
        ], this.signer)
        await tokenContract.approve(curveAddress, tokenQtyWei)
        
        tx = await curveContract.sell(tokenQtyWei, minReturn)
      }
      
      const receipt = await tx.wait()
      trade.txHash = receipt.transactionHash
      trade.status = 'completed'
      
      return trade
    } catch (error) {
      console.error('Curve trade execution failed:', error)
      trade.status = 'failed'
      throw error
    }
  }
  
  // Get enhanced market data (combines curve and DEX data)
  async getEnhancedMarketData(tokenAddress: string, curveAddress?: string): Promise<any> {
    const tradingMode = await this.getTradingMode(tokenAddress, curveAddress)
    
    if (tradingMode.mode === 'curve' && curveAddress) {
      const curveStats = await this.getCurveStats(curveAddress)
      return {
        currentPrice: curveStats.currentPrice,
        marketCap: 0, // Would need total supply
        volume24h: 0,
        change24h: 0,
        holders: 0,
        tradingMode: 'curve',
        curveStep: curveStats.currentStep,
        remainingTokens: curveStats.remainingTokens,
        isGraduated: curveStats.isGraduated
      }
    } else {
      const marketData = await blockchainTradingService.getMarketData(tokenAddress)
      return {
        ...marketData,
        tradingMode: 'dex'
      }
    }
  }
  
  // Get token balance for a user
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<number> {
    const balance = await blockchainTradingService.getTokenBalance(tokenAddress, userAddress)
    return typeof balance === 'string' ? parseFloat(balance) : balance
  }
  
  // Get 0G balance for a user
  async getETHBalance(userAddress: string): Promise<number> {
    const balance = await blockchainTradingService.getETHBalance(userAddress)
    return typeof balance === 'string' ? parseFloat(balance) : balance
  }
  
  // Listen for graduation events
  async listenForGraduation(curveAddress: string, callback: (event: any) => void) {
    if (!this.provider) throw new Error('Service not initialized')
    
    const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
    
    curveContract.on('Graduated', (totalTokensSold, totalEthReserve, timestamp, event) => {
      callback({
        totalTokensSold: ethers.utils.formatEther(totalTokensSold),
        totalEthReserve: ethers.utils.formatEther(totalEthReserve),
        timestamp: timestamp.toNumber(),
        event
      })
    })
  }
  
  // Listen for step advancement
  async listenForStepAdvancement(curveAddress: string, callback: (event: any) => void) {
    if (!this.provider) throw new Error('Service not initialized')
    
    const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
    
    curveContract.on('StepAdvanced', (newStep, newPrice, event) => {
      callback({
        newStep: newStep.toNumber(),
        newPrice: ethers.utils.formatEther(newPrice),
        event
      })
    })
  }
}

// Export singleton instance
export const bondingCurveTradingService = new BondingCurveTradingService()
