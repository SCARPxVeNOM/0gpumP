import { ethers } from 'ethers'

// Contract ABIs
const AUTO_TRADING_FACTORY_ABI = [
  'function enableTradingForToken(address token, uint256 tokenAmount, uint256 ethAmount) external payable returns (address pair)',
  'function hasTradingEnabled(address token) external view returns (bool hasTrading, address pairAddress)',
  'function getTradingStats(address token) external view returns (address pairAddress, uint256 tokenReserve, uint256 ethReserve, uint256 totalSupply)'
]

const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function createPair(address tokenA, address tokenB) external returns (address pair)'
]

const ROUTER_ABI = [
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)'
]

const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function totalSupply() external view returns (uint256)',
  'function decimals() external view returns (uint8)'
]

// Configuration
const DEFAULT_LIQUIDITY_CONFIG = {
  tokenAmount: '1000000', // 1M tokens
  ethAmount: '10',        // 10 0G
  slippage: 0.5          // 0.5%
}

export interface AutoTradingConfig {
  factoryAddress: string
  routerAddress: string
  wethAddress: string
  autoTradingFactoryAddress: string
  defaultTokenAmount: string
  defaultEthAmount: string
}

export interface TradingStatus {
  isEnabled: boolean
  pairAddress: string | null
  tokenReserve: number
  ethReserve: number
  totalSupply: number
  price: number
}

class AutoTradingService {
  private provider: ethers.providers.Web3Provider | null = null
  private signer: ethers.Signer | null = null
  private config: AutoTradingConfig | null = null
  
  // Contract instances
  private autoTradingFactory: ethers.Contract | null = null
  private factory: ethers.Contract | null = null
  private router: ethers.Contract | null = null

  // Initialize the service
  async initialize(
    provider: ethers.providers.Web3Provider,
    config: AutoTradingConfig
  ) {
    this.provider = provider
    this.signer = provider.getSigner()
    this.config = config

    // Initialize contract instances
    this.autoTradingFactory = new ethers.Contract(
      config.autoTradingFactoryAddress,
      AUTO_TRADING_FACTORY_ABI,
      this.signer
    )
    
    this.factory = new ethers.Contract(
      config.factoryAddress,
      FACTORY_ABI,
      this.signer
    )
    
    this.router = new ethers.Contract(
      config.routerAddress,
      ROUTER_ABI,
      this.signer
    )
  }

  // Check if trading is enabled for a token
  async checkTradingStatus(tokenAddress: string): Promise<TradingStatus> {
    try {
      if (!this.autoTradingFactory) {
        throw new Error('Service not initialized')
      }

      const [hasTrading, pairAddress] = await this.autoTradingFactory.hasTradingEnabled(tokenAddress)
      
      if (!hasTrading) {
        return {
          isEnabled: false,
          pairAddress: null,
          tokenReserve: 0,
          ethReserve: 0,
          totalSupply: 0,
          price: 0
        }
      }

      // Get trading stats
      const [pairAddr, tokenReserve, ethReserve, totalSupply] = await this.autoTradingFactory.getTradingStats(tokenAddress)
      
      const price = ethReserve > 0 ? ethReserve / tokenReserve : 0

      return {
        isEnabled: true,
        pairAddress: pairAddr,
        tokenReserve: parseFloat(ethers.utils.formatEther(tokenReserve)),
        ethReserve: parseFloat(ethers.utils.formatEther(ethReserve)),
        totalSupply: parseFloat(ethers.utils.formatEther(totalSupply)),
        price
      }
    } catch (error) {
      console.error('Error checking trading status:', error)
      return {
        isEnabled: false,
        pairAddress: null,
        tokenReserve: 0,
        ethReserve: 0,
        totalSupply: 0,
        price: 0
      }
    }
  }

  // Automatically enable trading for a token
  async enableTradingForToken(
    tokenAddress: string,
    tokenAmount?: string,
    ethAmount?: string
  ): Promise<{ success: boolean; pairAddress?: string; error?: string }> {
    try {
      if (!this.autoTradingFactory || !this.signer) {
        throw new Error('Service not initialized')
      }

      // Check if already enabled
      const status = await this.checkTradingStatus(tokenAddress)
      if (status.isEnabled) {
        return {
          success: true,
          pairAddress: status.pairAddress || undefined
        }
      }

      // Use default amounts if not provided
      const finalTokenAmount = tokenAmount || this.config?.defaultTokenAmount || DEFAULT_LIQUIDITY_CONFIG.tokenAmount
      const finalEthAmount = ethAmount || this.config?.defaultEthAmount || DEFAULT_LIQUIDITY_CONFIG.ethAmount

      // Check token balance
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer)
      const tokenBalance = await tokenContract.balanceOf(await this.signer.getAddress())
      const requiredAmount = ethers.utils.parseEther(finalTokenAmount)

      if (tokenBalance.lt(requiredAmount)) {
        throw new Error(`Insufficient token balance. Need ${finalTokenAmount} tokens`)
      }

      // Approve tokens for auto trading factory
      await tokenContract.approve(this.config!.autoTradingFactoryAddress, requiredAmount)

      // Enable trading
      const tx = await this.autoTradingFactory.enableTradingForToken(
        tokenAddress,
        requiredAmount,
        ethers.utils.parseEther(finalEthAmount),
        { value: ethers.utils.parseEther(finalEthAmount) }
      )

      const receipt = await tx.wait()
      
      // Get the pair address from the event
      const event = receipt.events?.find((e: any) => e.event === 'TradingEnabled')
      const pairAddress = event?.args?.pair

      return {
        success: true,
        pairAddress
      }
    } catch (error: any) {
      console.error('Error enabling trading:', error)
      return {
        success: false,
        error: error.message || 'Failed to enable trading'
      }
    }
  }

  // Enable trading for multiple tokens
  async enableTradingForMultipleTokens(
    tokens: Array<{ address: string; tokenAmount?: string; ethAmount?: string }>
  ): Promise<Array<{ address: string; success: boolean; pairAddress?: string; error?: string }>> {
    const results = []

    for (const token of tokens) {
      const result = await this.enableTradingForToken(
        token.address,
        token.tokenAmount,
        token.ethAmount
      )
      
      results.push({
        address: token.address,
        ...result
      })
    }

    return results
  }

  // Get recommended liquidity amounts based on token supply
  async getRecommendedLiquidity(tokenAddress: string): Promise<{ tokenAmount: string; ethAmount: string }> {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider)
      const totalSupply = await tokenContract.totalSupply()
      const decimals = await tokenContract.decimals()
      
      const totalSupplyNumber = parseFloat(ethers.utils.formatUnits(totalSupply, decimals))
      
      // Recommend 10% of total supply for liquidity
      const recommendedTokenAmount = Math.min(totalSupplyNumber * 0.1, 1000000) // Max 1M tokens
      const recommendedEthAmount = Math.max(recommendedTokenAmount * 0.00001, 1) // Min 1 0G
      
      return {
        tokenAmount: recommendedTokenAmount.toString(),
        ethAmount: recommendedEthAmount.toString()
      }
    } catch (error) {
      console.error('Error getting recommended liquidity:', error)
      return {
        tokenAmount: DEFAULT_LIQUIDITY_CONFIG.tokenAmount,
        ethAmount: DEFAULT_LIQUIDITY_CONFIG.ethAmount
      }
    }
  }

  // Check if user has sufficient balance for enabling trading
  async checkUserBalance(
    tokenAddress: string,
    tokenAmount?: string,
    ethAmount?: string
  ): Promise<{ hasTokenBalance: boolean; hasEthBalance: boolean; tokenBalance: string; ethBalance: string }> {
    try {
      if (!this.signer) {
        throw new Error('Service not initialized')
      }

      const userAddress = await this.signer.getAddress()
      
      // Check token balance
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider)
      const tokenBalance = await tokenContract.balanceOf(userAddress)
      const requiredTokenAmount = ethers.utils.parseEther(tokenAmount || this.config?.defaultTokenAmount || DEFAULT_LIQUIDITY_CONFIG.tokenAmount)
      
      // Check ETH balance
      const ethBalance = await this.provider!.getBalance(userAddress)
      const requiredEthAmount = ethers.utils.parseEther(ethAmount || this.config?.defaultEthAmount || DEFAULT_LIQUIDITY_CONFIG.ethAmount)

      return {
        hasTokenBalance: tokenBalance.gte(requiredTokenAmount),
        hasEthBalance: ethBalance.gte(requiredEthAmount),
        tokenBalance: ethers.utils.formatEther(tokenBalance),
        ethBalance: ethers.utils.formatEther(ethBalance)
      }
    } catch (error) {
      console.error('Error checking user balance:', error)
      return {
        hasTokenBalance: false,
        hasEthBalance: false,
        tokenBalance: '0',
        ethBalance: '0'
      }
    }
  }
}

// Export singleton instance
export const autoTradingService = new AutoTradingService()
