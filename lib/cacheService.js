import { databaseManager } from './databaseManager.js';

/**
 * Professional Cache Service
 * Implements Redis caching for real-time data as recommended by ChatGPT
 * - Sub-millisecond access for frequently accessed data
 * - Automatic cache invalidation
 * - Fallback to database when cache misses
 */
class CacheService {
  constructor() {
    this.cachePrefixes = {
      USER_BALANCE: 'balance:',
      COIN_PRICE: 'price:',
      COIN_VOLUME: 'volume:',
      COIN_MARKET_CAP: 'market_cap:',
      USER_PROFILE: 'profile:',
      COIN_DATA: 'coin:',
      TRADING_STATS: 'stats:',
      MARKET_DATA: 'market:'
    };
    
    this.defaultTTL = {
      BALANCE: 30,      // 30 seconds
      PRICE: 10,        // 10 seconds
      VOLUME: 60,       // 1 minute
      MARKET_CAP: 300,  // 5 minutes
      PROFILE: 3600,    // 1 hour
      COIN_DATA: 600,   // 10 minutes
      STATS: 300,       // 5 minutes
      MARKET: 30        // 30 seconds
    };
  }

  /**
   * Cache user balance with automatic refresh
   */
  async cacheUserBalance(walletAddress, balance) {
    const key = `${this.cachePrefixes.USER_BALANCE}${walletAddress.toLowerCase()}`;
    return await databaseManager.cacheSet(key, balance, this.defaultTTL.BALANCE);
  }

  async getUserBalance(walletAddress) {
    const key = `${this.cachePrefixes.USER_BALANCE}${walletAddress.toLowerCase()}`;
    return await databaseManager.cacheGet(key);
  }

  /**
   * Cache coin price data
   */
  async cacheCoinPrice(coinId, priceData) {
    const key = `${this.cachePrefixes.COIN_PRICE}${coinId}`;
    return await databaseManager.cacheSet(key, priceData, this.defaultTTL.PRICE);
  }

  async getCoinPrice(coinId) {
    const key = `${this.cachePrefixes.COIN_PRICE}${coinId}`;
    return await databaseManager.cacheGet(key);
  }

  /**
   * Cache coin volume data
   */
  async cacheCoinVolume(coinId, volumeData) {
    const key = `${this.cachePrefixes.COIN_VOLUME}${coinId}`;
    return await databaseManager.cacheSet(key, volumeData, this.defaultTTL.VOLUME);
  }

  async getCoinVolume(coinId) {
    const key = `${this.cachePrefixes.COIN_VOLUME}${coinId}`;
    return await databaseManager.cacheGet(key);
  }

  /**
   * Cache market cap data
   */
  async cacheMarketCap(coinId, marketCapData) {
    const key = `${this.cachePrefixes.COIN_MARKET_CAP}${coinId}`;
    return await databaseManager.cacheSet(key, marketCapData, this.defaultTTL.MARKET_CAP);
  }

  async getMarketCap(coinId) {
    const key = `${this.cachePrefixes.COIN_MARKET_CAP}${coinId}`;
    return await databaseManager.cacheGet(key);
  }

  /**
   * Cache user profile data
   */
  async cacheUserProfile(walletAddress, profileData) {
    const key = `${this.cachePrefixes.USER_PROFILE}${walletAddress.toLowerCase()}`;
    return await databaseManager.cacheSet(key, profileData, this.defaultTTL.PROFILE);
  }

  async getUserProfile(walletAddress) {
    const key = `${this.cachePrefixes.USER_PROFILE}${walletAddress.toLowerCase()}`;
    return await databaseManager.cacheGet(key);
  }

  /**
   * Cache complete coin data
   */
  async cacheCoinData(coinId, coinData) {
    const key = `${this.cachePrefixes.COIN_DATA}${coinId}`;
    return await databaseManager.cacheSet(key, coinData, this.defaultTTL.COIN_DATA);
  }

  async getCoinData(coinId) {
    const key = `${this.cachePrefixes.COIN_DATA}${coinId}`;
    return await databaseManager.cacheGet(key);
  }

  /**
   * Cache trading statistics
   */
  async cacheTradingStats(userAddress, stats) {
    const key = `${this.cachePrefixes.TRADING_STATS}${userAddress.toLowerCase()}`;
    return await databaseManager.cacheSet(key, stats, this.defaultTTL.STATS);
  }

  async getTradingStats(userAddress) {
    const key = `${this.cachePrefixes.TRADING_STATS}${userAddress.toLowerCase()}`;
    return await databaseManager.cacheGet(key);
  }

  /**
   * Cache market data (top coins, trending, etc.)
   */
  async cacheMarketData(dataType, data) {
    const key = `${this.cachePrefixes.MARKET_DATA}${dataType}`;
    return await databaseManager.cacheSet(key, data, this.defaultTTL.MARKET);
  }

  async getMarketData(dataType) {
    const key = `${this.cachePrefixes.MARKET_DATA}${dataType}`;
    return await databaseManager.cacheGet(key);
  }

  /**
   * Invalidate cache for specific coin
   */
  async invalidateCoinCache(coinId) {
    const keys = [
      `${this.cachePrefixes.COIN_PRICE}${coinId}`,
      `${this.cachePrefixes.COIN_VOLUME}${coinId}`,
      `${this.cachePrefixes.COIN_MARKET_CAP}${coinId}`,
      `${this.cachePrefixes.COIN_DATA}${coinId}`
    ];

    for (const key of keys) {
      await databaseManager.cacheDel(key);
    }
  }

  /**
   * Invalidate cache for specific user
   */
  async invalidateUserCache(walletAddress) {
    const keys = [
      `${this.cachePrefixes.USER_BALANCE}${walletAddress.toLowerCase()}`,
      `${this.cachePrefixes.USER_PROFILE}${walletAddress.toLowerCase()}`,
      `${this.cachePrefixes.TRADING_STATS}${walletAddress.toLowerCase()}`
    ];

    for (const key of keys) {
      await databaseManager.cacheDel(key);
    }
  }

  /**
   * Batch cache operations for performance
   */
  async batchCacheSet(operations) {
    const promises = operations.map(({ key, value, ttl }) => 
      databaseManager.cacheSet(key, value, ttl)
    );
    return await Promise.all(promises);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      if (databaseManager.redis instanceof Map) {
        return {
          type: 'in-memory',
          size: databaseManager.redis.size,
          keys: Array.from(databaseManager.redis.keys())
        };
      } else {
        const info = await databaseManager.redis.info('memory');
        const keyspace = await databaseManager.redis.info('keyspace');
        return {
          type: 'redis',
          memory: info,
          keyspace: keyspace
        };
      }
    } catch (error) {
      return {
        type: 'error',
        error: error.message
      };
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache() {
    try {
      if (databaseManager.redis instanceof Map) {
        databaseManager.redis.clear();
        return true;
      } else {
        await databaseManager.redis.flushdb();
        return true;
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
export default cacheService;
