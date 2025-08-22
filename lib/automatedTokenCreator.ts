import { ethers } from 'ethers'
import { autoTradingService, AutoTradingConfig } from './autoTradingService'

// Contract ABIs
const OG_TOKEN_ABI = [
  'function constructor(string memory name, string memory symbol, uint256 initialSupply)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)'
]

export interface TokenCreationParams {
  name: string
  symbol: string
  initialSupply: string
  description?: string
  imageHash?: string
  enableTrading?: boolean
  autoLiquidity?: boolean
  tokenAmount?: string
  ethAmount?: string
}

export interface TokenCreationResult {
  success: boolean
  tokenAddress?: string
  txHash?: string
  tradingEnabled?: boolean
  pairAddress?: string
  error?: string
}

export interface TokenMetadata {
  name: string
  symbol: string
  totalSupply: string
  tokenAddress: string
  creator: string
  createdAt: number
  description?: string
  imageHash?: string
  tradingEnabled: boolean
  pairAddress?: string
}

class AutomatedTokenCreator {
  private provider: any = null
  private signer: any = null
  private autoTradingConfig: AutoTradingConfig | null = null
  private ogTokenFactory: any = null

  // Initialize the service
  async initialize(
    provider: any,
    autoTradingConfig: AutoTradingConfig
  ) {
    this.provider = provider
    this.signer = provider.getSigner()
    this.autoTradingConfig = autoTradingConfig

    // Initialize auto trading service
    await autoTradingService.initialize(provider, autoTradingConfig)

    // Get OGToken factory - commented out for build compatibility
    // const OGToken = await ethers.getContractFactory('OGToken')
    // this.ogTokenFactory = OGToken.connect(this.signer)
  }

  // Create token with automatic trading setup
  async createTokenWithAutoTrading(params: TokenCreationParams): Promise<TokenCreationResult> {
    try {
      if (!this.ogTokenFactory || !this.signer) {
        throw new Error('Service not initialized - ethers factory not available in build')
      }

      console.log(`🚀 Creating token: ${params.name} (${params.symbol})`)

      // Deploy the token - commented out for build compatibility
      // const initialSupply = ethers.utils.parseEther(params.initialSupply)
      // const token = await this.ogTokenFactory.deploy(
      //   params.name,
      //   params.symbol,
      //   initialSupply
      // )

      // await token.deployed()
      // const tokenAddress = token.address
      // const txHash = token.deployTransaction.hash

      // console.log(`✅ Token deployed: ${tokenAddress}`)

      // Enable trading automatically if requested
      let tradingEnabled = false
      let pairAddress: string | undefined

      if (params.enableTrading !== false) { // Default to true
        console.log('🔄 Enabling automatic trading...')
        
        const tradingResult = await autoTradingService.enableTradingForToken(
          '0x0000000000000000000000000000000000000000', // placeholder
          params.tokenAmount || '0',
          params.ethAmount || '0'
        )

        if (tradingResult.success) {
          tradingEnabled = true
          pairAddress = tradingResult.pairAddress
          console.log(`✅ Trading enabled! Pair: ${pairAddress}`)
        } else {
          console.warn(`⚠️ Trading setup failed: ${tradingResult.error}`)
        }
      }

      // Store token metadata (you can extend this to save to your database)
      const metadata: TokenMetadata = {
        name: params.name,
        symbol: params.symbol,
        totalSupply: params.initialSupply,
        tokenAddress: '0x0000000000000000000000000000000000000000', // placeholder
        creator: '0x0000000000000000000000000000000000000000', // placeholder
        createdAt: Date.now(),
        description: params.description,
        imageHash: params.imageHash,
        tradingEnabled,
        pairAddress
      }

      // You can save this metadata to your database here
      await this.saveTokenMetadata(metadata)

      return {
        success: false,
        error: 'Token creation disabled for build compatibility'
      }

    } catch (error: any) {
      console.error('Error creating token:', error)
      return {
        success: false,
        error: error.message || 'Failed to create token'
      }
    }
  }

  // Create multiple tokens with auto trading
  async createMultipleTokensWithAutoTrading(
    tokens: TokenCreationParams[]
  ): Promise<TokenCreationResult[]> {
    const results = []

    for (const tokenParams of tokens) {
      const result = await this.createTokenWithAutoTrading(tokenParams)
      results.push(result)
      
      // Add delay between deployments to avoid nonce issues
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    return results
  }

  // Enable trading for existing tokens
  async enableTradingForExistingTokens(
    tokenAddresses: string[]
  ): Promise<Array<{ address: string; success: boolean; pairAddress?: string; error?: string }>> {
    const results = []

    for (const address of tokenAddresses) {
      const result = await autoTradingService.enableTradingForToken(address)
      results.push({
        address,
        ...result
      })
    }

    return results
  }

  // Get token metadata
  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata | null> {
    try {
      if (!this.provider) {
        throw new Error('Service not initialized')
      }

      const token = new ethers.Contract(tokenAddress, OG_TOKEN_ABI, this.provider)
      
      // Get basic token info
      const name = await token.name()
      const symbol = await token.symbol()
      const totalSupply = await token.totalSupply()
      
      // Check trading status
      const tradingStatus = await autoTradingService.checkTradingStatus(tokenAddress)

      return {
        name,
        symbol,
        totalSupply: ethers.utils.formatEther(totalSupply),
        tokenAddress,
        creator: '', // Would need to track this in your database
        createdAt: 0, // Would need to track this in your database
        tradingEnabled: tradingStatus.isEnabled,
        pairAddress: tradingStatus.pairAddress || undefined
      }
    } catch (error) {
      console.error('Error getting token metadata:', error)
      return null
    }
  }

  // Get recommended token parameters
  getRecommendedTokenParams(
    name: string,
    symbol: string,
    marketCap?: number
  ): TokenCreationParams {
    // Calculate recommended supply based on market cap
    const recommendedSupply = marketCap ? 
      Math.floor(marketCap / 0.0001).toString() : // Assuming 0.0001 0G starting price
      '1000000' // Default 1M tokens

    return {
      name,
      symbol,
      initialSupply: recommendedSupply,
      enableTrading: true,
      autoLiquidity: true,
      tokenAmount: '100000', // 100k tokens for initial liquidity
      ethAmount: '1' // 1 0G for initial liquidity
    }
  }

  // Save token metadata to database
  private async saveTokenMetadata(metadata: TokenMetadata): Promise<void> {
    // Implement your database save logic here
    console.log('Saving token metadata:', metadata)
  }

  // Validate token parameters
  validateTokenParams(params: TokenCreationParams): { valid: boolean; errors: string[] } {
    const errors = []

    if (!params.name || params.name.length < 1) {
      errors.push('Token name is required')
    }

    if (!params.symbol || params.symbol.length < 1) {
      errors.push('Token symbol is required')
    }

    if (!params.initialSupply || parseFloat(params.initialSupply) <= 0) {
      errors.push('Initial supply must be greater than 0')
    }

    if (params.symbol && params.symbol.length > 10) {
      errors.push('Token symbol must be 10 characters or less')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // Get deployment status
  getStatus(): { initialized: boolean; hasFactory: boolean } {
    return {
      initialized: !!this.provider && !!this.signer,
      hasFactory: !!this.ogTokenFactory
    }
  }
}

// Export singleton instance
export const automatedTokenCreator = new AutomatedTokenCreator()
