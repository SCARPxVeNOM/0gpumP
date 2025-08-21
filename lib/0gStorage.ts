export interface CoinData {
  id: string;
  name: string;
  symbol: string;
  supply: string;
  description: string;
  imageUrl: string;
  createdAt: string;
  creator: string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
  change24h?: number;
}

class OGStorageService {
  private storageKey = '0g_coins';

  async getAllCoins(): Promise<CoinData[]> {
    try {
      if (typeof window === 'undefined') return [];
      
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting coins from storage:', error);
      return [];
    }
  }

  async saveCoin(coinData: CoinData): Promise<void> {
    try {
      if (typeof window === 'undefined') return;
      
      const existingCoins = await this.getAllCoins();
      const updatedCoins = [...existingCoins, coinData];
      localStorage.setItem(this.storageKey, JSON.stringify(updatedCoins));
    } catch (error) {
      console.error('Error saving coin to storage:', error);
    }
  }

  async refreshFromSharedDatabase(): Promise<CoinData[]> {
    // For now, just return existing coins
    return this.getAllCoins();
  }

  async clearAllData(): Promise<void> {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}

export const ogStorageService = new OGStorageService();









