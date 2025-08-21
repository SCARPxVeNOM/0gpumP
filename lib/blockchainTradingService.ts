import { ethers } from 'ethers'
import { getCachedMarketSnapshot, saveMarketSnapshot } from './marketCache'

// Contract ABIs
const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function createPair(address tokenA, address tokenB) external returns (address pair)',
  'function allPairs(uint) external view returns (address pair)',
  'function allPairsLength() external view returns (uint)'
]

const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external'
]

const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)'
]

const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function totalSupply() external view returns (uint256)',
  'function decimals() external view returns (uint8)'
]

const IWETH_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256) external',
  'function transfer(address to, uint256 amount) external returns (bool)'
]

// Interfaces
export interface Trade {
  id: string
  tokenAddress: string
  action: 'buy' | 'sell'
  amount: string
  timestamp: number
  txHash?: string
  status: 'pending' | 'completed' | 'failed'
}

export interface MarketData {
  currentPrice: number
  marketCap: number
  volume24h: number
  change24h: number
  holders: number
}

export interface LiquidityPool {
  tokenReserve: number
  ethReserve: number
  totalSupply: number
  tokenPrice: number
}

// Main service class
class BlockchainTradingService {
  private provider: ethers.providers.Web3Provider | null = null
  private signer: ethers.Signer | null = null
  private readProvider: ethers.providers.FallbackProvider | null = null
  
  // Contract addresses from 0G testnet deployment
  // 0G testnet DEX (deployed via deployCoreDEX.js)
  private FACTORY_ADDRESS = '0x10ad7199954FE3479B77c9b8aaAFa2EA44275fd6'
  private ROUTER_ADDRESS = '0x631b62C792121cE905e73195b6B3a09bd3557a19'
  private WETH_ADDRESS = '0x2b4EcA0CD50864faBA28d21E4fEB9A73B0db9BDB'
  
  private factoryContract: ethers.Contract | null = null
  private routerContract: ethers.Contract | null = null
  private wethContract: ethers.Contract | null = null
  private readFactoryContract: ethers.Contract | null = null

  // Initialize the service with a Web3Provider
  async initialize(provider: ethers.providers.Web3Provider) {
    this.provider = provider
    this.signer = provider.getSigner()
    await this.ensureReadInitialized()
    
    // Initialize contract instances
    this.readFactoryContract = new ethers.Contract(this.FACTORY_ADDRESS, FACTORY_ABI, this.readProvider as any)
    this.factoryContract = new ethers.Contract(this.FACTORY_ADDRESS, FACTORY_ABI, this.signer)
    this.routerContract = new ethers.Contract(this.ROUTER_ADDRESS, ROUTER_ABI, this.signer)
    this.wethContract = new ethers.Contract(this.WETH_ADDRESS, ERC20_ABI, this.signer)
  }

  private async ensureReadInitialized() {
    if (this.readProvider && this.readFactoryContract) return
    try {
      const primary = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_EVM_RPC) || 'https://evmrpc-testnet.0g.ai'
      const staticReader = new ethers.providers.StaticJsonRpcProvider(primary, { name: '0g-testnet', chainId: 16601 })
      const readers = [ staticReader ]
      this.readProvider = new ethers.providers.FallbackProvider(readers, 1)
      await this.readProvider.getNetwork()
      this.readFactoryContract = new ethers.Contract(this.FACTORY_ADDRESS, FACTORY_ABI, this.readProvider as any)
    } catch {
      // As a last resort, if a wallet provider exists, use it for reads
      if (this.provider) {
        this.readProvider = new ethers.providers.FallbackProvider([this.provider as any], 1)
        this.readFactoryContract = new ethers.Contract(this.FACTORY_ADDRESS, FACTORY_ABI, this.readProvider as any)
      }
    }
  }

  private getAmountOutBN(amountIn: ethers.BigNumber, reserveIn: ethers.BigNumber, reserveOut: ethers.BigNumber, feeBps: number = 30): ethers.BigNumber {
    const feeDen = 10000
    const amountInWithFee = amountIn.mul(feeDen - feeBps).div(feeDen)
    const numerator = amountInWithFee.mul(reserveOut)
    const denominator = reserveIn.add(amountInWithFee)
    return numerator.div(denominator)
  }

  private async getPairAddress(tokenAddress: string): Promise<string> {
    await this.ensureReadInitialized()
    if (!this.readFactoryContract || !this.readProvider) return ethers.constants.AddressZero
    try {
      // Ensure factory exists on this network
      const factoryCode = await (this.readProvider as ethers.providers.Provider).getCode(this.FACTORY_ADDRESS)
      if (!factoryCode || factoryCode === '0x') {
        return ethers.constants.AddressZero
      }
      const pair = await this.readFactoryContract.getPair(tokenAddress, this.WETH_ADDRESS)
      return pair
    } catch {
      return ethers.constants.AddressZero
    }
  }

  // Get token price from DEX pair reserves
  async getTokenPrice(tokenAddress: string): Promise<number> {
    try {
      // Try recent cached snapshot first (30s)
      const cached = await getCachedMarketSnapshot(tokenAddress, 30_000)
      if (cached && typeof cached.price === 'number') return cached.price
      const pairAddress = await this.getPairAddress(tokenAddress)
      if (pairAddress === ethers.constants.AddressZero || !this.readProvider) return 0
      // Guard against non-contract at pair address
      const code = await (this.readProvider as ethers.providers.Provider).getCode(pairAddress)
      if (!code || code === '0x') return 0
      const pair = new ethers.Contract(pairAddress, PAIR_ABI, this.readProvider)
      const [r0, r1] = await pair.getReserves()
      const tokenIs0 = tokenAddress.toLowerCase() < this.WETH_ADDRESS.toLowerCase()
      const tokenReserve = tokenIs0 ? r0 : r1
      const wethReserve = tokenIs0 ? r1 : r0
      if (tokenReserve.isZero() || wethReserve.isZero()) return 0
      const priceWei = wethReserve.mul(ethers.constants.WeiPerEther).div(tokenReserve)
      const price = parseFloat(ethers.utils.formatUnits(priceWei, 18))
      // Save to 0G cache asynchronously (no await so UI isn't blocked)
      saveMarketSnapshot(tokenAddress, {
        tokenAddress,
        timestamp: Date.now(),
        price,
        marketCap: 0,
        reserves: { token: tokenReserve.toString(), weth: wethReserve.toString() },
        pairAddress
      }).catch(() => {})
      return price
    } catch (e) {
      const fallback = await getCachedMarketSnapshot(tokenAddress, 5 * 60_000)
      if (fallback && typeof fallback.price === 'number') return fallback.price
      return 0
    }
  }

  // Get market data for a token
  async getMarketData(tokenAddress: string): Promise<MarketData> {
    try {
      // Prefer cached
      const cached = await getCachedMarketSnapshot(tokenAddress, 30_000)
      const price = cached?.price ?? await this.getTokenPrice(tokenAddress)
      
      // Get token contract for total supply
      if (!this.provider && !this.readProvider) await this.ensureReadInitialized()
      const readProv = (this.provider || this.readProvider) as ethers.providers.Provider
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, readProv)
      const totalSupply = await tokenContract.totalSupply()
      const decimals = await tokenContract.decimals()
      const totalSupplyNumber = parseFloat(ethers.utils.formatUnits(totalSupply, decimals))
      const marketCap = price * totalSupplyNumber

      // Update cache (quiet)
      saveMarketSnapshot(tokenAddress, {
        tokenAddress,
        timestamp: Date.now(),
        price,
        marketCap
      }).catch(() => {})
      
      return {
        currentPrice: price,
        marketCap,
        volume24h: 0,
        change24h: 0,
        holders: 0
      }
    } catch (error) {
      console.debug('getMarketData: returning zeros due to read error')
      return {
        currentPrice: 0,
        marketCap: 0,
        volume24h: 0,
        change24h: 0,
        holders: 0
      }
    }
  }

  // Execute a trade (buy or sell)
  async executeTrade(
    tokenAddress: string, 
    action: 'buy' | 'sell', 
    amount: string,
    slippageTolerance: number = 0.5 // 0.5% default slippage
  ): Promise<Trade> {
    try {
      if (!this.signer || !this.provider) {
        throw new Error('Service not initialized')
      }

      const trade: Trade = {
        id: Date.now().toString(),
        tokenAddress,
        action,
        amount,
        timestamp: Date.now(),
        status: 'pending'
      }

      const pairAddress = await this.getPairAddress(tokenAddress)
      if (pairAddress === ethers.constants.AddressZero) throw new Error('No liquidity pool')
      const pair = new ethers.Contract(pairAddress, PAIR_ABI, this.signer)
      const tokenIs0 = tokenAddress.toLowerCase() < this.WETH_ADDRESS.toLowerCase()

      // use readProvider for reserves
      const reader = this.readProvider || this.provider
      const readPair = new ethers.Contract(pairAddress, PAIR_ABI, reader)
      const [r0, r1] = await readPair.getReserves()
      const reserveToken = tokenIs0 ? r0 : r1
      const reserveWeth  = tokenIs0 ? r1 : r0
      if (reserveToken.isZero() || reserveWeth.isZero()) throw new Error('Pool has zero reserves')

      let receipt: ethers.providers.TransactionReceipt
      if (action === 'buy') {
        const amtEth = ethers.utils.parseEther(amount)
        const weth = new ethers.Contract(this.WETH_ADDRESS, IWETH_ABI, this.signer)
        await (await weth.deposit({ value: amtEth })).wait()
        await (await weth.transfer(pairAddress, amtEth)).wait()
        const out = this.getAmountOutBN(amtEth, reserveWeth, reserveToken)
        const minOut = out.mul(10000 - Math.floor(slippageTolerance * 100)).div(10000)
        const amount0Out = tokenIs0 ? minOut : ethers.constants.Zero
        const amount1Out = tokenIs0 ? ethers.constants.Zero : minOut
        const tx = await pair.swap(amount0Out, amount1Out, await this.signer.getAddress(), '0x')
        receipt = await tx.wait()
      } else {
        const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer)
        const decimals: number = await token.decimals()
        const amtToken = ethers.utils.parseUnits(amount, decimals)
        await (await token.transfer(pairAddress, amtToken)).wait()
        const out = this.getAmountOutBN(amtToken, reserveToken, reserveWeth)
        const minOut = out.mul(10000 - Math.floor(slippageTolerance * 100)).div(10000)
        const amount0Out = tokenIs0 ? ethers.constants.Zero : minOut
        const amount1Out = tokenIs0 ? minOut : ethers.constants.Zero
        const tx = await pair.swap(amount0Out, amount1Out, await this.signer.getAddress(), '0x')
        await tx.wait()
        const weth = new ethers.Contract(this.WETH_ADDRESS, IWETH_ABI, this.signer)
        await (await weth.withdraw(minOut)).wait()
        receipt = await tx.wait()
      }

      trade.txHash = receipt.transactionHash
      trade.status = 'completed'

      return trade
    } catch (error) {
      console.error('Trade execution failed:', error)
      throw error
    }
  }

  // Add liquidity to a token-ETH pair
  async addLiquidity(
    tokenAddress: string, 
    ethAmount: string, 
    tokenAmount: string
  ): Promise<string> {
    try {
      if (!this.routerContract || !this.signer) {
        throw new Error('Service not initialized')
      }

      const ethAmountWei = ethers.utils.parseEther(ethAmount)
      const tokenAmountWei = ethers.utils.parseEther(tokenAmount)

      // Approve router to spend tokens
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer)
      await tokenContract.approve(this.ROUTER_ADDRESS, tokenAmountWei)

      const tx = await this.routerContract.addLiquidityETH(
        tokenAddress,
        tokenAmountWei,
        0,
        0,
        await this.signer.getAddress(),
        Math.floor(Date.now() / 1000) + 1800,
        { value: ethAmountWei }
      )

      const receipt = await tx.wait()
      return receipt.transactionHash
    } catch (error) {
      console.error('Add liquidity failed:', error)
      throw error
    }
  }

  // Get liquidity pool information
  async getLiquidityPool(tokenAddress: string): Promise<LiquidityPool | null> {
    try {
      if (!this.readFactoryContract || !this.readProvider) {
        throw new Error('Service not initialized')
      }
      const pairAddress = await this.getPairAddress(tokenAddress)
      if (pairAddress === ethers.constants.AddressZero) {
        return null // No pair exists
      }

      // Verify code exists at pair address to avoid call exceptions
      const code = await (this.readProvider as ethers.providers.Provider).getCode(pairAddress)
      if (!code || code === '0x') {
        return null
      }

      const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, this.readProvider)
      let r0: ethers.BigNumber, r1: ethers.BigNumber
      try {
        ;[r0, r1] = await pairContract.getReserves()
      } catch (_e) {
        return null
      }
      const tokenIs0 = tokenAddress.toLowerCase() < this.WETH_ADDRESS.toLowerCase()
      const tokenReserve = tokenIs0 ? r0 : r1
      const ethReserve = tokenIs0 ? r1 : r0

      const tokenReserveNumber = parseFloat(ethers.utils.formatUnits(tokenReserve, 18))
      const ethReserveNumber = parseFloat(ethers.utils.formatUnits(ethReserve, 18))
      const tokenPrice = ethReserveNumber / tokenReserveNumber

      return {
        tokenReserve: tokenReserveNumber,
        ethReserve: ethReserveNumber,
        totalSupply: 0,
        tokenPrice
      }
    } catch (_error) {
      return null
    }
  }

  // Check if a liquidity pool exists for a token
  async hasLiquidityPool(tokenAddress: string): Promise<boolean> {
    try {
      await this.ensureReadInitialized()
      if (!this.readFactoryContract || !this.readProvider) return false

      const pairAddress = await this.getPairAddress(tokenAddress)
      return pairAddress !== ethers.constants.AddressZero
    } catch (error) {
      // Quietly return false on read errors
      return false
    }
  }

  // Get user's token balance
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    try {
      if (!this.provider) throw new Error('Service not initialized')
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider)
      const balance = await tokenContract.balanceOf(userAddress)
      const decimals = await tokenContract.decimals()
      return ethers.utils.formatUnits(balance, decimals)
    } catch (error) {
      console.error('Error getting token balance:', error)
      return '0'
    }
  }

  // Get user's ETH balance
  async getETHBalance(userAddress: string): Promise<string> {
    try {
      if (!this.provider) throw new Error('Service not initialized')
      const balance = await this.provider.getBalance(userAddress)
      return ethers.utils.formatEther(balance)
    } catch (error) {
      console.error('Error getting ETH balance:', error)
      return '0'
    }
  }
}

// Export singleton instance
export const blockchainTradingService = new BlockchainTradingService()
