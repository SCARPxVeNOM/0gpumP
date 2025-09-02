import { ethers } from 'ethers'

// ABI for the new Factory contract
const FACTORY_ABI = [
  'function treasury() view returns (address)',
  'function defaultFeeBps() view returns (uint16)',
  'function createPair(string name, string symbol, uint256 seedTokenAmount) external payable returns (address tokenAddr, address curveAddr)',
  'event PairCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint256 seedOg, uint256 seedTokens)'
]

export interface CreatePairParams {
  name: string
  symbol: string
  seedTokenAmount: string // e.g., "1000000" for 1M tokens
  seedOgAmount: string // e.g., "0.5" for 0.5 OG
}

export interface CreatePairResult {
  success: boolean
  tokenAddress?: string
  curveAddress?: string
  txHash?: string
  error?: string
}

export class NewFactoryService {
  private provider: ethers.providers.Web3Provider | null = null
  private signer: ethers.Signer | null = null
  private factoryContract: ethers.Contract | null = null

  initialize(provider: ethers.providers.Web3Provider, factoryAddress: string) {
    this.provider = provider
    this.signer = provider.getSigner()
    this.factoryContract = new ethers.Contract(factoryAddress, FACTORY_ABI, this.signer)
  }

  // Create a new token pair with bonding curve
  async createPair(params: CreatePairParams): Promise<CreatePairResult> {
    if (!this.factoryContract || !this.signer) {
      throw new Error('Service not initialized')
    }

    try {
      console.log('🚀 Creating new token pair...')
      console.log(`📝 Name: ${params.name}`)
      console.log(`🏷️ Symbol: ${params.symbol}`)
      console.log(`💰 Seed Token Amount: ${params.seedTokenAmount}`)
      console.log(`⛽ Seed OG Amount: ${params.seedOgAmount}`)

      // Convert amounts to wei
      const seedTokenAmountWei = ethers.utils.parseEther(params.seedTokenAmount)
      const seedOgAmountWei = ethers.utils.parseEther(params.seedOgAmount)

      // Get current gas price and add premium for faster confirmation
      const gasPrice = await this.provider!.getGasPrice()
      const premiumGasPrice = gasPrice.mul(120).div(100) // 20% premium
      console.log(`⛽ Gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} Gwei`)
      console.log(`⛽ Premium gas price: ${ethers.utils.formatUnits(premiumGasPrice, 'gwei')} Gwei`)

      console.log('⏳ Sending transaction...')
      const tx = await this.factoryContract.createPair(
        params.name,
        params.symbol,
        seedTokenAmountWei,
        {
          value: seedOgAmountWei,
          gasPrice: premiumGasPrice,
          gasLimit: 5000000 // Much higher gas limit for complex deployment
        }
      )

      console.log(`⏳ Transaction sent: ${tx.hash}`)
      console.log(`⏳ Waiting for confirmation (this may take 30-60 seconds on 0G testnet)...`)

      let receipt
      let finalTxHash = tx.hash
      try {
        receipt = await tx.wait(1) // Wait for 1 confirmation
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`)
      } catch (error: any) {
        if (error.code === 'TRANSACTION_REPLACED' && error.replacement) {
          console.log(`🔄 Transaction was repriced, replacement hash: ${error.replacement.hash}`)
          if (error.receipt && error.receipt.status === 1) {
            receipt = error.receipt
            finalTxHash = error.replacement.hash
            console.log(`✅ Replacement transaction succeeded in block ${receipt.blockNumber}`)
          } else {
            throw error
          }
        } else {
          throw error
        }
      }

      // Parse the PairCreated event to get addresses
      const pairCreatedEvent = receipt.logs.find((log: any) => {
        try {
          const iface = new ethers.utils.Interface(FACTORY_ABI)
          const parsed = iface.parseLog(log)
          return parsed.name === 'PairCreated'
        } catch {
          return false
        }
      })

      if (!pairCreatedEvent) {
        throw new Error('PairCreated event not found in transaction receipt')
      }

      const iface = new ethers.utils.Interface(FACTORY_ABI)
      const parsed = iface.parseLog(pairCreatedEvent)
      const [tokenAddress, curveAddress] = parsed.args

      console.log(`✅ Token created successfully!`)
      console.log(`🪙 Token Address: ${tokenAddress}`)
      console.log(`📈 Curve Address: ${curveAddress}`)

      return {
        success: true,
        tokenAddress,
        curveAddress,
        txHash: finalTxHash
      }

    } catch (error: any) {
      console.error('❌ Failed to create token pair:', error)
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      }
    }
  }

  // Get factory info
  async getFactoryInfo(): Promise<{ treasury: string; defaultFeeBps: number } | null> {
    if (!this.factoryContract) return null

    try {
      const [treasury, defaultFeeBps] = await Promise.all([
        this.factoryContract.treasury(),
        this.factoryContract.defaultFeeBps()
      ])

      return {
        treasury,
        defaultFeeBps: defaultFeeBps.toNumber()
      }
    } catch (error) {
      console.error('Failed to get factory info:', error)
      return null
    }
  }
}

export const newFactoryService = new NewFactoryService()
