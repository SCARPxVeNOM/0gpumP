import { databaseManager } from './databaseManager.js';
import { cacheService } from './cacheService.js';
import { ethers } from 'ethers';

/**
 * Professional Data Service
 * Implements the recommended architecture:
 * - Redis for real-time caching (sub-millisecond)
 * - SQLite for permanent storage and indexing
 * - Automatic cache invalidation
 * - Optimized queries with proper indexing
 */
class DataService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize the data service
   */
  async initialize() {
    if (!this.isInitialized) {
      await databaseManager.initialize();
      this.isInitialized = true;
      console.log("✅ Data Service initialized");
    }
  }

  /**
   * COIN OPERATIONS
   */

  /**
   * Get coin data with caching
   */
  async getCoin(coinId) {
    await this.initialize();
    
    // Try cache first
    let coinData = await cacheService.getCoinData(coinId);
    if (coinData) {
      return coinData;
    }

    // Cache miss - get from database
    const db = await databaseManager.getConnection();
    const coin = await db.get(
      `SELECT * FROM coins WHERE id = ? OR tokenAddress = ? OR curveAddress = ?`,
      [coinId, coinId, coinId]
    );

    if (coin) {
      // Cache the result
      await cacheService.cacheCoinData(coin.id, coin);
      return coin;
    }

    return null;
  }

  /**
   * Get all coins with caching and pagination
   */
  async getCoins(limit = 50, offset = 0, sortBy = 'marketCap', order = 'DESC') {
    await this.initialize();
    
    const cacheKey = `coins:${limit}:${offset}:${sortBy}:${order}`;
    let coins = await cacheService.getMarketData(cacheKey);
    
    if (coins) {
      return coins;
    }

    // Cache miss - get from database
    const db = await databaseManager.getConnection();
    const validSortColumns = ['marketCap', 'volume24h', 'price', 'createdAt', 'updatedAt'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'marketCap';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const results = await db.all(
      `SELECT * FROM coins 
       ORDER BY ${sortColumn} ${sortOrder} 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Cache the result for 5 minutes
    await cacheService.cacheMarketData(cacheKey, results, 300);
    
    return results;
  }

  /**
   * Create or update coin
   */
  async upsertCoin(coinData) {
    await this.initialize();
    
    const db = await databaseManager.getConnection();
    
    // Check if coin exists
    const existing = await db.get(
      `SELECT id FROM coins WHERE tokenAddress = ? OR id = ?`,
      [coinData.tokenAddress, coinData.id]
    );

    if (existing) {
      // Update existing coin
      await db.run(
        `UPDATE coins SET 
         name = ?, symbol = ?, supply = ?, decimals = ?, description = ?, 
         imageHash = ?, imageUrl = ?, metadataHash = ?, metadataUrl = ?,
         imageCompressionRatio = ?, imageOriginalSize = ?, imageCompressedSize = ?,
         tokenAddress = ?, curveAddress = ?, txHash = ?, blockNumber = ?,
         gasUsed = ?, gasPrice = ?, telegramUrl = ?, xUrl = ?, discordUrl = ?, websiteUrl = ?,
         marketCap = ?, price = ?, volume24h = ?, change24h = ?, holders = ?,
         totalTransactions = ?, liquidity = ?, updatedAt = ?, lastPriceUpdate = ?, lastVolumeUpdate = ?
         WHERE id = ?`,
        [
          coinData.name, coinData.symbol, coinData.supply, coinData.decimals, coinData.description,
          coinData.imageHash, coinData.imageUrl, coinData.metadataHash, coinData.metadataUrl,
          coinData.imageCompressionRatio, coinData.imageOriginalSize, coinData.imageCompressedSize,
          coinData.tokenAddress, coinData.curveAddress, coinData.txHash, coinData.blockNumber,
          coinData.gasUsed, coinData.gasPrice, coinData.telegramUrl, coinData.xUrl, 
          coinData.discordUrl, coinData.websiteUrl, coinData.marketCap, coinData.price,
          coinData.volume24h, coinData.change24h, coinData.holders, coinData.totalTransactions,
          coinData.liquidity, Date.now(), Date.now(), Date.now(), existing.id
        ]
      );
    } else {
      // Insert new coin
      const insertStatement = `INSERT INTO coins (
        id, name, symbol, supply, decimals, description, creator, createdAt, updatedAt,
        imageHash, imageUrl, metadataHash, metadataUrl, imageCompressionRatio,
        imageOriginalSize, imageCompressedSize, tokenAddress, curveAddress,
        txHash, blockNumber, gasUsed, gasPrice, telegramUrl, xUrl, discordUrl,
        websiteUrl, marketCap, price, volume24h, change24h, holders,
        totalTransactions, liquidity, lastPriceUpdate, lastVolumeUpdate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const values = [
        coinData.id, coinData.name, coinData.symbol, coinData.supply, coinData.decimals,
        coinData.description, coinData.creator, Date.now(), Date.now(), coinData.imageHash, coinData.imageUrl,
        coinData.metadataHash, coinData.metadataUrl, coinData.imageCompressionRatio,
        coinData.imageOriginalSize, coinData.imageCompressedSize, coinData.tokenAddress,
        coinData.curveAddress, coinData.txHash, coinData.blockNumber, coinData.gasUsed,
        coinData.gasPrice, coinData.telegramUrl, coinData.xUrl, coinData.discordUrl,
        coinData.websiteUrl, coinData.marketCap, coinData.price, coinData.volume24h,
        coinData.change24h, coinData.holders, coinData.totalTransactions, coinData.liquidity,
        Date.now(), Date.now()
      ];

      await db.run(insertStatement, values);
    }

    // Invalidate cache
    await cacheService.invalidateCoinCache(coinData.id);
    
    return coinData;
  }

  /**
   * Update coin market data
   */
  async updateCoinMarketData(coinId, marketData) {
    await this.initialize();
    
    const db = await databaseManager.getConnection();
    
    await db.run(
      `UPDATE coins SET 
       marketCap = ?, price = ?, volume24h = ?, change24h = ?, 
       holders = ?, totalTransactions = ?, liquidity = ?,
       lastPriceUpdate = ?, lastVolumeUpdate = ?, updatedAt = ?
       WHERE id = ?`,
      [
        marketData.marketCap, marketData.price, marketData.volume24h, marketData.change24h,
        marketData.holders, marketData.totalTransactions, marketData.liquidity,
        Date.now(), Date.now(), Date.now(), coinId
      ]
    );

    // Update cache
    await cacheService.cacheCoinPrice(coinId, marketData);
    await cacheService.cacheCoinVolume(coinId, marketData);
    await cacheService.cacheMarketCap(coinId, marketData);
    
    // Invalidate coin data cache
    await cacheService.invalidateCoinCache(coinId);
  }

  /**
   * USER PROFILE OPERATIONS
   */

  /**
   * Get user profile with caching
   */
  async getUserProfile(walletAddress) {
    await this.initialize();
    
    // Try cache first
    let profile = await cacheService.getUserProfile(walletAddress);
    if (profile) {
      return profile;
    }

    // Cache miss - get from database
    const db = await databaseManager.getConnection();
    const profileRow = await db.get(
      `SELECT * FROM user_profiles WHERE walletAddress = ?`,
      [walletAddress.toLowerCase()]
    );

    if (profileRow) {
      // Cache the result
      await cacheService.cacheUserProfile(walletAddress, profileRow);
      return profileRow;
    }

    return null;
  }

  /**
   * Update user profile (hybrid storage support)
   */
  async updateUserProfile(walletAddress, profileData) {
    await this.initialize();
    
    const db = await databaseManager.getConnection();
    
    // Handle both profileData (JSON string) and profileHash (0G Storage hash)
    const profileDataStr = typeof profileData === 'string' ? profileData : JSON.stringify(profileData);
    const profileHash = (typeof profileData === 'object' && profileData.profileHash) ? profileData.profileHash : null;
    
    await db.run(
      `INSERT OR REPLACE INTO user_profiles (walletAddress, profileData, profileHash, createdAt, updatedAt) 
       VALUES (?, ?, ?, COALESCE((SELECT createdAt FROM user_profiles WHERE walletAddress = ?), ?), ?)`,
      [walletAddress.toLowerCase(), profileDataStr, profileHash, walletAddress.toLowerCase(), Date.now(), Date.now()]
    );

    // Invalidate cache
    await cacheService.invalidateUserCache(walletAddress);
  }

  /**
   * TRADING HISTORY OPERATIONS
   */

  /**
   * Add trading transaction
   */
  async addTradingTransaction(transactionData) {
    await this.initialize();
    
    const db = await databaseManager.getConnection();
    
    await db.run(
      `INSERT INTO trading_history (
        coinId, userAddress, txHash, blockNumber, timestamp, type,
        amount, amountOg, price, volume, gasUsed, gasPrice
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transactionData.coinId, transactionData.userAddress, transactionData.txHash,
        transactionData.blockNumber, transactionData.timestamp, transactionData.type,
        transactionData.amount, transactionData.amountOg || 0, transactionData.price, 
        transactionData.volume, transactionData.gasUsed, transactionData.gasPrice
      ]
    );

    // Invalidate coin cache
    await cacheService.invalidateCoinCache(transactionData.coinId);
  }

  /**
   * Get user trading history by wallet address
   */
  async getUserTradingHistory(userAddress, limit = 50, offset = 0) {
    await this.initialize();
    
    const db = await databaseManager.getConnection();
    
    const history = await db.all(
      `SELECT th.*, c.name as coinName, c.symbol as coinSymbol, c.imageUrl as coinImageUrl
       FROM trading_history th
       LEFT JOIN coins c ON th.coinId = c.id
       WHERE th.userAddress = ?
       ORDER BY th.timestamp DESC
       LIMIT ? OFFSET ?`,
      [userAddress, limit, offset]
    );

    return history;
  }

  /**
   * Get coin trading history
   */
  async getCoinTradingHistory(coinId, limit = 50, offset = 0) {
    await this.initialize();
    
    const db = await databaseManager.getConnection();
    
    const history = await db.all(
      `SELECT * FROM trading_history 
       WHERE coinId = ?
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`,
      [coinId, limit, offset]
    );

    return history;
  }

  /**
   * 0G STORAGE OPERATIONS
   */

  /**
   * Track 0G Storage file
   */
  async trackOGStorageFile(fileData) {
    await this.initialize();
    
    const db = await databaseManager.getConnection();
    
    await db.run(
      `INSERT OR REPLACE INTO og_storage_files (
        rootHash, fileName, fileType, originalSize, compressedSize,
        compressionRatio, compressionType, uploadDate, lastAccessed,
        accessCount, isActive, metadata, coinId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fileData.rootHash, fileData.fileName, fileData.fileType,
        fileData.originalSize, fileData.compressedSize, fileData.compressionRatio,
        fileData.compressionType, Date.now(), Date.now(), 1, true,
        JSON.stringify(fileData.metadata || {}), fileData.coinId || null
      ]
    );
  }

  /**
   * Update file access tracking
   */
  async updateFileAccess(rootHash) {
    await this.initialize();
    
    const db = await databaseManager.getConnection();
    
    await db.run(
      `UPDATE og_storage_files 
       SET lastAccessed = ?, accessCount = accessCount + 1
       WHERE rootHash = ?`,
      [Date.now(), rootHash]
    );
  }

  /**
   * ANALYTICS OPERATIONS
   */

  /**
   * Get market statistics
   */
  async getMarketStats() {
    await this.initialize();
    
    const cacheKey = 'market_stats';
    let stats = await cacheService.getMarketData(cacheKey);
    
    if (stats) {
      return stats;
    }

    const db = await databaseManager.getConnection();
    
    const [
      totalCoins,
      totalMarketCap,
      totalVolume,
      topGainers,
      topLosers
    ] = await Promise.all([
      db.get(`SELECT COUNT(*) as count FROM coins`),
      db.get(`SELECT SUM(marketCap) as total FROM coins`),
      db.get(`SELECT SUM(volume24h) as total FROM coins`),
      db.all(`SELECT * FROM coins WHERE change24h > 0 ORDER BY change24h DESC LIMIT 5`),
      db.all(`SELECT * FROM coins WHERE change24h < 0 ORDER BY change24h ASC LIMIT 5`)
    ]);

    stats = {
      totalCoins: totalCoins.count,
      totalMarketCap: totalMarketCap.total || 0,
      totalVolume: totalVolume.total || 0,
      topGainers,
      topLosers
    };

    // Cache for 5 minutes
    await cacheService.cacheMarketData(cacheKey, stats, 300);
    
    return stats;
  }

  /**
   * Get user statistics
   */
  async getUserStats(userAddress) {
    await this.initialize();
    
    // Try cache first
    let stats = await cacheService.getTradingStats(userAddress);
    if (stats) {
      return stats;
    }

    const db = await databaseManager.getConnection();
    
    // Since trading_history doesn't have userAddress, we'll get stats from user_favorites
    const favoriteTokens = await db.all(
      `SELECT c.* FROM user_favorites uf 
       JOIN coins c ON uf.coinId = c.id 
       WHERE uf.userAddress = ? 
       ORDER BY uf.createdAt DESC LIMIT 10`, 
      [userAddress.toLowerCase()]
    );

    stats = {
      totalTrades: 0, // Would need to be tracked separately
      totalVolume: 0, // Would need to be tracked separately
      tokensHeld: favoriteTokens.length,
      favoriteTokens
    };

    // Cache for 5 minutes
    await cacheService.cacheTradingStats(userAddress, stats);
    
    return stats;
  }

  /**
   * UTILITY OPERATIONS
   */

  /**
   * Get database health status
   */
  async getHealthStatus() {
    await this.initialize();
    
    try {
      const db = await databaseManager.getConnection();
      await db.get(`SELECT 1`);
      
      const cacheStats = await cacheService.getCacheStats();
      
      return {
        database: 'healthy',
        cache: cacheStats.type,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        database: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get the count of unique tokens held by a user
   */
  async getTokensHeldCount(userAddress) {
    await this.initialize();
    
    if (!process.env.RPC_URL) {
      console.warn('RPC_URL not set. Cannot fetch token balances.');
      return 0;
    }

    try {
      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      const db = await databaseManager.getConnection();
      
      // Get all coins with valid token addresses
      const coins = await db.all(
        `SELECT tokenAddress FROM coins WHERE tokenAddress IS NOT NULL AND tokenAddress != ''`
      );

      let tokensHeld = 0;
      
      // ERC-20 balanceOf ABI
      const erc20Abi = ['function balanceOf(address owner) view returns (uint256)'];
      
      for (const coin of coins) {
        try {
          const tokenContract = new ethers.Contract(coin.tokenAddress, erc20Abi, provider);
          const balance = await tokenContract.balanceOf(userAddress);
          
          // Check if balance is greater than 0
          if (balance > 0n) {
            tokensHeld++;
          }
        } catch (error) {
          console.warn(`Error fetching balance for token ${coin.tokenAddress}:`, error.message);
          // Continue to next token even if one fails
        }
      }
      
      console.log(`Found ${tokensHeld} tokens held by ${userAddress}`);
      return tokensHeld;
    } catch (error) {
      console.error('Error getting tokens held count:', error);
      return 0;
    }
  }

  /**
   * Close connections
   */
  async close() {
    await databaseManager.close();
  }
}

// Export singleton instance
export const dataService = new DataService();
export default dataService;
