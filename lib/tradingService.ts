import { CoinData } from './0gStorage'

export interface Trade {
  id: string
  coin: CoinData
  action: 'buy' | 'sell'
  amount: string
  timestamp: number
  status: 'pending' | 'completed' | 'failed'
  txHash?: string
}

export interface Portfolio {
  totalTrades: number
  tokens: PortfolioToken[]
}

export interface PortfolioToken {
  coin: CoinData
  amount: number
}

class TradingService {
  private trades: Trade[] = []
  private portfolio: Portfolio = {
    totalTrades: 0,
    tokens: []
  }

  // Execute a trade
  async executeTrade(coin: CoinData, action: 'buy' | 'sell', amount: string): Promise<Trade> {
    const trade: Trade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      coin,
      action,
      amount,
      timestamp: Date.now(),
      status: 'pending'
    }

    try {
      // Simulate blockchain transaction
      await this.simulateBlockchainTransaction(trade)
      
      trade.status = 'completed'
      trade.txHash = `0x${Math.random().toString(36).substring(2, 15)}${Date.now().toString(16)}`
      
      // Add to trades history
      this.trades.unshift(trade)
      
      // Update portfolio
      this.updatePortfolio(trade)
      
      return trade
    } catch (error) {
      trade.status = 'failed'
      throw error
    }
  }

  // Simulate blockchain transaction
  private async simulateBlockchainTransaction(trade: Trade): Promise<void> {
    // Simulate network delay and transaction processing
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000))
    
    // Simulate potential failure (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Transaction failed: Insufficient liquidity')
    }
  }

  // Update portfolio after trade
  private updatePortfolio(trade: Trade): void {
    const { coin, action, amount } = trade
    const numAmount = parseFloat(amount)
    
    if (action === 'buy') {
      // Add to portfolio
      const existingToken = this.portfolio.tokens.find(t => t.coin.id === coin.id)
      
      if (existingToken) {
        // Update existing position
        existingToken.amount += numAmount
      } else {
        // Add new token to portfolio
        this.portfolio.tokens.push({
          coin,
          amount: numAmount
        })
      }
    } else {
      // Sell from portfolio
      const existingToken = this.portfolio.tokens.find(t => t.coin.id === coin.id)
      
      if (existingToken && existingToken.amount >= numAmount) {
        existingToken.amount -= numAmount
        
        // Remove token if amount becomes 0
        if (existingToken.amount === 0) {
          this.portfolio.tokens = this.portfolio.tokens.filter(t => t.coin.id !== coin.id)
        }
      }
    }
    
    // Update portfolio totals
    this.updatePortfolioTotals()
  }

  // Update portfolio totals
  private updatePortfolioTotals(): void {
    this.portfolio.totalTrades = this.trades.length
  }

  // Get portfolio
  getPortfolio(): Portfolio {
    this.updatePortfolioTotals()
    return { ...this.portfolio }
  }

  // Get trading history
  getTradingHistory(): Trade[] {
    return [...this.trades]
  }

  // Get recent trades
  getRecentTrades(limit: number = 10): Trade[] {
    return this.trades.slice(0, limit)
  }
}

// Export singleton instance
export const tradingService = new TradingService()
