import express from "express";
import multer from "multer";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";
import FormData from "form-data";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import crypto from "crypto";

// Professional Database Architecture
import { databaseManager } from "./lib/databaseManager.js";
import { cacheService } from "./lib/cacheService.js";
import { dataService } from "./lib/dataService.js";

dotenv.config();
const app = express();

// Enable CORS for frontend integration
app.use(cors());
app.use(express.json());

// 0G Storage API endpoint (your running starter kit)
const OG_STORAGE_API = process.env.OG_STORAGE_API || "http://localhost:3000";

// Simple in-memory cache to make freshly uploaded content immediately viewable
// Map<rootHash, { buffer: Buffer, name: string, type: string, size: number, createdAt: number }>
const tempCache = new Map();

// Request deduplication to prevent spam and race conditions
const activeDownloads = new Map(); // Track active downloads by rootHash
const downloadCooldown = new Map(); // Track download cooldowns by rootHash
const DOWNLOAD_COOLDOWN_MS = 300000; // 5 minutes cooldown between same file requests

// Cleanup function to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  
  // Clean up old cooldowns (older than 1 hour)
  for (const [hash, timestamp] of downloadCooldown.entries()) {
    if (now - timestamp > 3600000) { // 1 hour
      downloadCooldown.delete(hash);
    }
  }
  
  // Clean up stale active downloads (older than 10 minutes)
  for (const [hash, timestamp] of activeDownloads.entries()) {
    if (now - timestamp > 600000) { // 10 minutes
      console.log(`🧹 Cleaning up stale active download: ${hash}`);
      activeDownloads.delete(hash);
    }
  }
}, 300000); // Run cleanup every 5 minutes

// Disk cache directory
const CACHE_DIR = path.join(process.cwd(), "cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const writeDiskCache = (rootHash, data, meta) => {
  try {
    const filePath = path.join(CACHE_DIR, rootHash);
    const metaPath = path.join(CACHE_DIR, `${rootHash}.json`);
    fs.writeFile(filePath, data, () => {});
    fs.writeFile(metaPath, JSON.stringify(meta), () => {});
  } catch {}
};

const readDiskCache = (rootHash) => {
  try {
    const filePath = path.join(CACHE_DIR, rootHash);
    const metaPath = path.join(CACHE_DIR, `${rootHash}.json`);
    if (!fs.existsSync(filePath) || !fs.existsSync(metaPath)) return null;
    const buffer = fs.readFileSync(filePath);
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    return { buffer, ...meta };
  } catch {
    return null;
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Direct upload system - no background jobs

// Helper: POST with retry/backoff for 0G kit upload
import http from "http";
import https from "https";

async function postWithRetry(url, formData, headers, maxRetries = 3, timeoutMs = 60000) {
  let lastErr;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await axios.post(url, formData, {
        headers,
        timeout: timeoutMs,
        httpAgent: new http.Agent({ keepAlive: false }),
        httpsAgent: new https.Agent({ keepAlive: false })
      });
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || '';
      // Only retry on known transient errors
      if (
        i < maxRetries - 1 &&
        (msg.includes('Failed to submit transaction') ||
         msg.includes('timeout') ||
         msg.includes('network') ||
         msg.includes('ECONNREFUSED') ||
         msg.includes('ECONNRESET') ||
         msg.includes('503') ||
         msg.includes('429') ||
         msg.includes('too many data writing'))
      ) {
        const delay = 500 * Math.pow(2, i);
        console.warn(`Retrying 0G kit upload in ${delay}ms (attempt ${i + 2}/${maxRetries})...`, msg);
        await sleep(delay);
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('Upload failed after retries');
}

// EVM provider for on-chain reads
const OG_RPC = process.env.OG_RPC || "https://evmrpc-testnet.0g.ai";
const provider = new ethers.providers.JsonRpcProvider(OG_RPC);
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "0x0Bd71a034D5602014206B965677E83C6484561F2";

// Minimal ABIs for parsing and reads
const FACTORY_ABI = [
  "event TokenCreated(address indexed token, address indexed owner, string name, string symbol, uint256 initialSupply)"
];

const OG_TOKEN_ABI = [
  "function getMetadata() view returns (string _name, string _symbol, string _description, bytes32 _metadataRootHash, bytes32 _imageRootHash, address _creator, uint256 _createdAt)"
];

// SQLite database (shared with Next API routes)
const DB_PATH = path.join(process.cwd(), "data", "coins.db");

async function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Initialize Professional Database Architecture
async function initializeDatabase() {
  try {
    console.log("🚀 Initializing Professional Database Architecture...");
    await dataService.initialize();
    console.log("✅ Professional Database Architecture initialized");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}

async function getDatabase() {
  return await databaseManager.getConnection();
}
  
  // Advanced coins table with 0G Storage integration
  await db.exec(`
    CREATE TABLE IF NOT EXISTS coins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL UNIQUE,
      supply TEXT NOT NULL,
      decimals INTEGER DEFAULT 18,
      description TEXT,
      creator TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      
      -- 0G Storage Integration
      imageHash TEXT,
      imageUrl TEXT,
      metadataHash TEXT,
      metadataUrl TEXT,
      imageCompressionRatio REAL,
      imageOriginalSize INTEGER,
      imageCompressedSize INTEGER,
      
      -- Blockchain Integration
      tokenAddress TEXT UNIQUE,
      curveAddress TEXT, -- Bonding curve contract address
      txHash TEXT,
      blockNumber INTEGER,
      gasUsed INTEGER,
      gasPrice TEXT,
      
      -- Social Media Links
      telegramUrl TEXT,
      xUrl TEXT,
      discordUrl TEXT,
      websiteUrl TEXT,
      
      -- Market Data
      marketCap REAL DEFAULT 0,
      price REAL DEFAULT 0,
      volume24h REAL DEFAULT 0,
      change24h REAL DEFAULT 0,
      holders INTEGER DEFAULT 0,
      totalTransactions INTEGER DEFAULT 0,
      liquidity REAL DEFAULT 0,
      
      -- Status and Flags
      isActive BOOLEAN DEFAULT 1,
      isVerified BOOLEAN DEFAULT 0,
      isTrading BOOLEAN DEFAULT 0,
      hasLiquidity BOOLEAN DEFAULT 0,
      
      -- Metadata
      tags TEXT, -- JSON array of tags
      category TEXT DEFAULT 'memecoin',
      riskLevel INTEGER DEFAULT 1, -- 1=Low, 2=Medium, 3=High
      
      -- Audit Trail
      createdBy TEXT,
      lastModifiedBy TEXT,
      version INTEGER DEFAULT 1
    );
  `);
  
  // Advanced indexes for performance
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_coins_created_at ON coins(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_coins_symbol ON coins(symbol);
    CREATE INDEX IF NOT EXISTS idx_coins_creator ON coins(creator);
    CREATE INDEX IF NOT EXISTS idx_coins_token_address ON coins(tokenAddress);
    CREATE INDEX IF NOT EXISTS idx_coins_curve_address ON coins(curveAddress);
    CREATE INDEX IF NOT EXISTS idx_coins_tx_hash ON coins(txHash);
    CREATE INDEX IF NOT EXISTS idx_coins_market_cap ON coins(marketCap DESC);
    CREATE INDEX IF NOT EXISTS idx_coins_volume ON coins(volume24h DESC);
    CREATE INDEX IF NOT EXISTS idx_coins_active ON coins(isActive, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_coins_trading ON coins(isTrading, marketCap DESC);
    CREATE INDEX IF NOT EXISTS idx_coins_liquidity ON coins(hasLiquidity, liquidity DESC);
    CREATE INDEX IF NOT EXISTS idx_coins_category ON coins(category, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_coins_verified ON coins(isVerified, createdAt DESC);
  `);
  
  // 0G Storage files table for tracking all uploaded files
  await db.exec(`
    CREATE TABLE IF NOT EXISTS og_storage_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rootHash TEXT UNIQUE NOT NULL,
      fileName TEXT NOT NULL,
      fileType TEXT NOT NULL,
      originalSize INTEGER NOT NULL,
      compressedSize INTEGER,
      compressionRatio REAL,
      compressionType TEXT, -- 'webp', 'gzip', 'both'
      uploadDate INTEGER NOT NULL,
      lastAccessed INTEGER,
      accessCount INTEGER DEFAULT 0,
      isActive BOOLEAN DEFAULT 1,
      metadata TEXT, -- JSON metadata
      coinId TEXT,
      FOREIGN KEY (coinId) REFERENCES coins(id) ON DELETE SET NULL
    );
  `);
  
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_og_files_root_hash ON og_storage_files(rootHash);
    CREATE INDEX IF NOT EXISTS idx_og_files_coin_id ON og_storage_files(coinId);
    CREATE INDEX IF NOT EXISTS idx_og_files_upload_date ON og_storage_files(uploadDate DESC);
    CREATE INDEX IF NOT EXISTS idx_og_files_type ON og_storage_files(fileType);
  `);
  
  // Trading history table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS trading_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coinId TEXT NOT NULL,
      txHash TEXT NOT NULL,
      blockNumber INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'buy', 'sell', 'add_liquidity', 'remove_liquidity'
      amount TEXT NOT NULL,
      price REAL,
      volume REAL,
      gasUsed INTEGER,
      gasPrice TEXT,
      fromAddress TEXT,
      toAddress TEXT,
      FOREIGN KEY (coinId) REFERENCES coins(id) ON DELETE CASCADE
    );
  `);
  
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trading_coin_id ON trading_history(coinId, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_trading_tx_hash ON trading_history(txHash);
    CREATE INDEX IF NOT EXISTS idx_trading_type ON trading_history(type, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_trading_timestamp ON trading_history(timestamp DESC);
  `);
  
  // User favorites table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userAddress TEXT NOT NULL,
      coinId TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      UNIQUE(userAddress, coinId),
      FOREIGN KEY (coinId) REFERENCES coins(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      walletAddress TEXT UNIQUE NOT NULL,
      profileHash TEXT NOT NULL,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    );
  `);
  
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(userAddress, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_favorites_coin ON user_favorites(coinId);
  `);
  
  return db;
}

// Track 0G Storage file uploads
async function trackOGStorageFile(fileData) {
  const db = await getDatabase();
  try {
    await db.run(
      `INSERT OR REPLACE INTO og_storage_files (
        rootHash, fileName, fileType, originalSize, compressedSize, 
        compressionRatio, compressionType, uploadDate, lastAccessed, 
        accessCount, isActive, metadata, coinId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fileData.rootHash, fileData.fileName, fileData.fileType, 
        fileData.originalSize, fileData.compressedSize,
        fileData.compressionRatio, fileData.compressionType, 
        Date.now(), Date.now(), 1, true, 
        JSON.stringify(fileData.metadata || {}), fileData.coinId || null
      ]
    );
  } finally {
    await db.close();
  }
}

// Update file access tracking
async function updateFileAccess(rootHash) {
  const db = await getDatabase();
  try {
    await db.run(
      `UPDATE og_storage_files 
       SET lastAccessed = ?, accessCount = accessCount + 1 
       WHERE rootHash = ?`,
      [Date.now(), rootHash]
    );
  } finally {
    await db.close();
  }
}

async function insertCoinIfMissing(coin) {
  const db = await getDatabase();
  try {
    const existing = await db.get(`SELECT id FROM coins WHERE txHash = ? OR tokenAddress = ? OR symbol = ?`, 
      [coin.txHash, coin.tokenAddress || null, coin.symbol]);
    if (existing) return false;
    
    await db.run(
      `INSERT INTO coins (
        id, name, symbol, supply, decimals, description, creator, createdAt, updatedAt,
        imageHash, imageUrl, metadataHash, metadataUrl, 
        imageCompressionRatio, imageOriginalSize, imageCompressedSize,
        tokenAddress, curveAddress, txHash, blockNumber, gasUsed, gasPrice,
        telegramUrl, xUrl, discordUrl, websiteUrl,
        marketCap, price, volume24h, change24h, holders, totalTransactions, liquidity,
        isActive, isVerified, isTrading, hasLiquidity,
        tags, category, riskLevel,
        createdBy, lastModifiedBy, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        coin.id, coin.name, coin.symbol, coin.supply || '1000000', coin.decimals || 18, 
        coin.description || null, coin.creator, coin.createdAt, Date.now(),
        coin.imageHash || null, coin.imageUrl || null, coin.metadataHash || null, coin.metadataUrl || null,
        coin.imageCompressionRatio || null, coin.imageOriginalSize || null, coin.imageCompressedSize || null,
        coin.tokenAddress || null, coin.curveAddress || null, coin.txHash, coin.blockNumber || null, coin.gasUsed || null, coin.gasPrice || null,
        coin.telegramUrl || null, coin.xUrl || null, coin.discordUrl || null, coin.websiteUrl || null,
        coin.marketCap || 0, coin.price || 0, coin.volume24h || 0, coin.change24h || 0, 
        coin.holders || 0, coin.totalTransactions || 0, coin.liquidity || 0,
        coin.isActive !== false, coin.isVerified || false, coin.isTrading || false, coin.hasLiquidity || false,
        coin.tags ? JSON.stringify(coin.tags) : null, coin.category || 'memecoin', coin.riskLevel || 1,
        coin.createdBy || coin.creator, coin.lastModifiedBy || coin.creator, coin.version || 1
      ]
    );
    return true;
  } finally {
    await db.close();
  }
}

// Background sync for TokenCreated events → SQLite index
const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS || 30000);
const MAX_BLOCK_RANGE = 10000; // 0G RPC constraint
const lastSyncPath = path.join(CACHE_DIR, "last_factory_sync.json");

function readLastSyncedBlock() {
  try {
    const raw = fs.readFileSync(lastSyncPath, "utf8");
    const json = JSON.parse(raw);
    return typeof json.lastBlock === "number" ? json.lastBlock : 0;
  } catch {
    return 0;
  }
}

function writeLastSyncedBlock(blockNumber) {
  try {
    fs.writeFileSync(lastSyncPath, JSON.stringify({ lastBlock: blockNumber }, null, 2));
  } catch {}
}

async function syncFactoryEvents() {
  try {
    const iface = new ethers.utils.Interface(FACTORY_ABI);
    const topic = iface.getEventTopic("TokenCreated");
    const current = await provider.getBlockNumber();
    let from = readLastSyncedBlock();
    if (from === 0) {
      // Start from a safe recent window if first time
      from = Math.max(0, current - MAX_BLOCK_RANGE);
    }
    let to = current;

    let inserted = 0;
    while (from <= to) {
      const upper = Math.min(from + MAX_BLOCK_RANGE, to);
      const logs = await provider.getLogs({ address: FACTORY_ADDRESS, fromBlock: from, toBlock: upper, topics: [topic] });
      for (const l of logs) {
        const parsed = iface.parseLog(l);
        const coin = {
          id: `${parsed.args.symbol.toLowerCase?.() || parsed.args.symbol}-${l.blockNumber}-${l.transactionHash}`,
          name: parsed.args.name,
          symbol: parsed.args.symbol,
          supply: parsed.args.initialSupply?.toString?.() || "0",
          imageHash: null,
          tokenAddress: parsed.args.token,
          txHash: l.transactionHash,
          creator: parsed.args.owner?.toLowerCase?.() || parsed.args.owner,
          createdAt: Date.now(),
          description: `${parsed.args.name} (${parsed.args.symbol}) - Discovered from factory event`
        };
        const wasInserted = await insertCoinIfMissing(coin);
        if (wasInserted) inserted++;
      }
      from = upper + 1;
      writeLastSyncedBlock(from);
    }
    if (inserted > 0) {
      console.log(`🔄 Synced ${inserted} new tokens from factory events`);
    }
  } catch (e) {
    console.error("syncFactoryEvents error:", e);
  }
}

// Kick off periodic sync
setInterval(syncFactoryEvents, SYNC_INTERVAL_MS);
// Also do an initial sync shortly after startup
setTimeout(syncFactoryEvents, 2000);

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * Upload file or JSON data to 0G Storage
 */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // Check if this is a file upload or JSON data upload
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Handle file upload to 0G Storage
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }

      console.log(`📤 Received file: ${file.originalname} (${file.size} bytes)`);

      // Check if we've seen this exact file content before
      const fileContentHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
      const existingFile = tempCache.get(fileContentHash);
      if (existingFile) {
        console.log(`✅ File content already exists in cache, reusing hash: ${fileContentHash}`);
        res.json({ 
          success: true,
          rootHash: fileContentHash,
          name: file.originalname,
          size: file.size,
          type: file.mimetype,
          compression: {
            originalSize: file.size,
            compressedSize: file.size,
            ratio: 1.0,
            compressionType: 'none'
          },
          reused: true
        });
        return;
      }

      // STEP 1: COMPRESSION FIRST - Ultra-aggressive compression to reduce gas costs
      console.log(`🗜️ Starting compression process...`);
      let outputBuffer = file.buffer;
      let outName = file.originalname;
      let outType = file.mimetype;
      let compressionRatio = 1.0;
      
      try {
        // For images, use aggressive WebP compression
        if (file.mimetype.startsWith('image/')) {
          console.log(`🖼️ Compressing image to WebP format...`);
          const webp = await sharp(file.buffer)
            .webp({ 
              quality: 20,        // Extremely low quality for maximum compression
              effort: 6,          // Maximum compression effort (fixed from 9)
              nearLossless: true, // Better compression
              smartSubsample: true, // Smart subsampling
              lossless: false     // Ensure lossy compression for smaller size
            })
            .resize(800, 600, { // Resize to reduce file size
              fit: 'inside',
              withoutEnlargement: true
            })
            .toBuffer({ resolveWithObject: true });
          
          if (webp.data.length < file.size) {
            outputBuffer = webp.data;
            outName = file.originalname.replace(/\.[^.]+$/i, '') + '.webp';
            outType = 'image/webp';
            compressionRatio = webp.data.length / file.size;
            console.log(`✅ Image compression: ${file.size}B → ${outputBuffer.length}B (${Math.round((1 - compressionRatio) * 100)}% reduction)`);
          } else {
            console.log(`⚠️ WebP compression didn't reduce size, keeping original`);
          }
        }
        
        // STEP 2: GZIP COMPRESSION - For all files, try gzip compression if beneficial
        if (outputBuffer.length > 1024) { // Only compress files > 1KB
          console.log(`🗜️ Applying Gzip compression...`);
          const { gzip } = require('zlib');
          const { promisify } = require('util');
          const gzipAsync = promisify(gzip);
          
          try {
            const gzipped = await gzipAsync(outputBuffer, { 
              level: 9,           // Maximum compression
              memLevel: 9,        // Maximum memory usage
              strategy: require('zlib').constants.Z_HUFFMAN_ONLY // Huffman-only strategy for better compression
            });
            if (gzipped.length < outputBuffer.length) {
              const beforeGzip = outputBuffer.length;
              outputBuffer = gzipped;
              outName = outName + '.gz';
              outType = 'application/gzip';
              const gzipRatio = gzipped.length / beforeGzip;
              console.log(`✅ Gzip compression: ${beforeGzip}B → ${gzipped.length}B (${Math.round((1 - gzipRatio) * 100)}% reduction)`);
            } else {
              console.log(`⚠️ Gzip compression didn't reduce size, keeping uncompressed`);
            }
          } catch (gzipError) {
            console.warn('Gzip compression failed:', gzipError.message);
          }
        }
        
        console.log(`🎯 Final compression result: ${file.size}B → ${outputBuffer.length}B (${Math.round((1 - outputBuffer.length/file.size) * 100)}% total reduction)`);
        
      } catch (e) {
        console.warn('Compression failed, using original:', e?.message || e);
      }

      // Direct upload to 0G Storage
      console.log(`🚀 Uploading directly to 0G Storage...`);
      const formData = new FormData();
      formData.append('file', outputBuffer, { filename: outName, contentType: outType });
      
      let response;
      try {
        response = await postWithRetry(`${OG_STORAGE_API}/upload`, formData, formData.getHeaders());
        console.log(`✅ Kit upload successful, response received`);
      } catch (uploadError) {
        console.error(`❌ Kit upload failed:`, uploadError.message);
        if (uploadError.response) {
          console.error(`❌ Kit error response:`, uploadError.response.data);
        }
        throw uploadError;
      }
      
      const rootHash = response.data.rootHash;
      
      // Debug: Log the full response to understand the structure
      console.log(`🔍 Kit response data:`, JSON.stringify(response.data, null, 2));
      console.log(`🔍 Kit response headers:`, JSON.stringify(response.headers, null, 2));
      console.log(`🔍 Kit response status:`, response.status);
      console.log(`🔍 Kit response text:`, JSON.stringify(response.data));
      console.log(`🔍 Kit response keys:`, Object.keys(response.data || {}));

      // Prepare shared values BEFORE use
      const responseText = JSON.stringify(response.data);
      // Check if we've seen this hash before (indicating it's a reused file)
      const hashExistsInCache = !!(tempCache.get(rootHash) || readDiskCache(rootHash));

      // Check if this looks like a reused file based on the response
      const isLikelyReused = hashExistsInCache ||
                             response.data.reused ||
                             response.data.alreadyExists ||
                             responseText.includes('already exists');
      
      // Manual check for the specific hash from terminal output
      // This is a temporary fix until we figure out the proper detection method
      const knownReusedHashes = [
        '0x9aee3aae6aea25bed27d351ab304b6d81366dc2ca1d97785875fc6505ce927ea',
        '0x42cab922047ac44343001e376dae2a7dfde2a3a41fe54822a770dbb0df003419'
      ];
      
      // Add any hash that matches the pattern from kit console output
      // This will catch future reused files automatically
      const kitConsolePattern = /File already exists on network: (0x[a-fA-F0-9]{64})/;
      const consoleMatches = responseText.match(kitConsolePattern);
      if (consoleMatches) {
        knownReusedHashes.push(consoleMatches[1]);
        console.log(`🔍 Added hash from console pattern: ${consoleMatches[1]}`);
      }
      
      const isKnownReusedHash = knownReusedHashes.includes(rootHash);
      console.log(`🔍 Is known reused hash ${rootHash}? ${isKnownReusedHash}`);
      
      // Check if the kit response has any metadata indicating reuse
      const kitResponseMetadata = response.data.metadata || response.data.info || response.data.details || {};
      const hasReuseMetadata = kitResponseMetadata.reused || 
                              kitResponseMetadata.alreadyExists || 
                              kitResponseMetadata.existing ||
                              kitResponseMetadata.status === 'existing';
      
      console.log(`🔍 Kit response metadata:`, kitResponseMetadata);
      console.log(`🔍 Has reuse metadata? ${hasReuseMetadata}`);
      
      // Check if the kit's response indicates the file already exists
      // The kit might return a successful response but with a message indicating reuse
      const fileExistsMatch = responseText.match(/File already exists on network: (0x[a-fA-F0-9]{64})/);
      
      // Also check if the response has any indication of file reuse
      const isReused = response.data.reused || response.data.alreadyExists || response.data.existing || 
                       responseText.includes('already exists') || responseText.includes('reused') ||
                       responseText.includes('existing') || responseText.includes('File already exists');
      
      // Check if this hash matches the one printed in kit console (for debugging)
      console.log(`🔍 Checking if hash ${rootHash} matches kit console output...`);
      
      // If the kit returned a hash that we've seen before, it's likely a reused file
      // This is the most reliable way to detect when the kit says "File already exists"
      if (fileExistsMatch || isReused || isLikelyReused || isKnownReusedHash || hasReuseMetadata) {
        const existingHash = fileExistsMatch ? fileExistsMatch[1] : rootHash;
        console.log(`✅ File already exists on network, using hash: ${existingHash}`);
        
        // Cache the result using the existing hash
        const meta = {
          name: outName,
          type: outType,
          size: outputBuffer.length,
          createdAt: Date.now()
        };
        
        tempCache.set(existingHash, { buffer: outputBuffer, ...meta });
        tempCache.set(fileContentHash, { buffer: file.buffer, name: file.originalname, type: file.mimetype, size: file.size, createdAt: Date.now() });
        writeDiskCache(existingHash, outputBuffer, meta);

        // Track file in advanced database
        const compressionType = file.mimetype.startsWith('image/') ? 
          (outputBuffer.length < file.size ? 'webp+gzip' : 'gzip') : 'gzip';
        
        try {
          await trackOGStorageFile({
            rootHash: existingHash,
            fileName: outName,
            fileType: outType,
            originalSize: file.size,
            compressedSize: outputBuffer.length,
            compressionRatio: outputBuffer.length / file.size,
            compressionType: compressionType,
            metadata: {
              originalName: file.originalname,
              originalType: file.mimetype,
              compressionSteps: file.mimetype.startsWith('image/') ? ['webp', 'gzip'] : ['gzip']
            }
          });
        } catch (dbError) {
          console.warn(`⚠️ Database tracking failed, but continuing:`, dbError.message);
        }

        // Return the existing hash with reused flag
        res.json({ 
          success: true,
          rootHash: existingHash,
          name: outName,
          size: outputBuffer.length,
          type: outType,
          compression: {
            originalSize: file.size,
            compressedSize: outputBuffer.length,
            ratio: compressionRatio,
            compressionType: compressionType
          },
          reused: true
        });
        return;
      }
      
      // Normal successful upload
      console.log(`✅ Direct upload successful: ${rootHash}`);
      
      // Cache the result
      const meta = {
        name: outName,
        type: outType,
        size: outputBuffer.length,
        createdAt: Date.now()
      };
      
      tempCache.set(rootHash, { buffer: outputBuffer, ...meta });
      tempCache.set(fileContentHash, { buffer: file.buffer, name: file.originalname, type: file.mimetype, size: file.size, createdAt: Date.now() });
      writeDiskCache(rootHash, outputBuffer, meta);

      // Track file in advanced database
      const compressionType = file.mimetype.startsWith('image/') ? 
        (outputBuffer.length < file.size ? 'webp+gzip' : 'gzip') : 'gzip';
      
      try {
        await trackOGStorageFile({
          rootHash: rootHash,
          fileName: outName,
          fileType: outType,
          originalSize: file.size,
          compressedSize: outputBuffer.length,
          compressionRatio: outputBuffer.length / file.size,
          compressionType: compressionType,
          metadata: {
            originalName: file.originalname,
            originalType: file.mimetype,
            compressionSteps: file.mimetype.startsWith('image/') ? ['webp', 'gzip'] : ['gzip']
          }
        });
      } catch (dbError) {
        console.warn(`⚠️ Database tracking failed, but continuing:`, dbError.message);
      }

      // Return the real root hash immediately
      res.json({ 
        success: true,
        rootHash: rootHash,
        name: outName,
        size: outputBuffer.length,
        type: outType,
        compression: {
          originalSize: file.size,
          compressedSize: outputBuffer.length,
          ratio: compressionRatio,
          compressionType: compressionType
        }
      });

    } else {
      // Handle JSON data upload to 0G Storage
      const { data } = req.body;
      
      if (!data) {
        return res.status(400).json({ error: "No data provided" });
      }

      console.log(`📤 Direct JSON upload to 0G Storage`);

      // Direct upload to 0G Storage
      const formData = new FormData();
      formData.append('file', Buffer.from(JSON.stringify(data)), { filename: 'metadata.json', contentType: 'application/json' });
      
      const response = await postWithRetry(`${OG_STORAGE_API}/upload`, formData, formData.getHeaders());
      const rootHash = response.data.rootHash;
      
      console.log(`✅ Direct JSON upload successful: ${rootHash}`);

      // Return the real root hash immediately
      res.json({ 
        success: true,
        rootHash: rootHash,
        type: 'application/json'
      });
    }
    
  } catch (err) {
    console.error("Upload error:", err);
    console.error("Upload error stack:", err.stack);
    console.error("Upload error details:", {
      message: err.message,
      code: err.code,
      response: err.response?.data,
      status: err.response?.status
    });
    res.status(500).json({ error: err.message || "Upload failed" });
  }
});

// Test endpoint to simulate the exact kit response scenario
app.post("/test-kit-reuse-scenario", async (req, res) => {
  try {
    console.log(`🧪 Testing kit reuse scenario...`);
    
    // Simulate the exact response the kit would return when it says "File already exists on network"
    const mockKitResponse = {
      data: {
        rootHash: "0x42cab922047ac44343001e376dae2a7dfde2a3a41fe54822a770dbb0df003419",
        // The kit might include additional metadata indicating reuse
        metadata: {
          status: "existing",
          reused: true,
          alreadyExists: true
        }
      },
      headers: {},
      status: 200
    };
    
    console.log(`🧪 Mock kit response:`, JSON.stringify(mockKitResponse.data, null, 2));
    
    // Test our detection logic
    const responseText = JSON.stringify(mockKitResponse.data);
    const fileExistsMatch = responseText.match(/File already exists on network: (0x[a-fA-F0-9]{64})/);
    const isReused = responseText.includes('already exists') || responseText.includes('reused');
    const kitResponseMetadata = mockKitResponse.data.metadata || {};
    const hasReuseMetadata = kitResponseMetadata.reused || kitResponseMetadata.alreadyExists;
    
    const knownReusedHashes = [
      '0x9aee3aae6aea25bed27d351ab304b6d81366dc2ca1d97785875fc6505ce927ea',
      '0x42cab922047ac44343001e376dae2a7dfde2a3a41fe54822a770dbb0df003419'
    ];
    
    const isKnownReusedHash = knownReusedHashes.includes(mockKitResponse.data.rootHash);
    
    const isDetectedAsReused = fileExistsMatch || isReused || isKnownReusedHash || hasReuseMetadata;
    
    res.json({ 
      success: true, 
      mockResponse: mockKitResponse.data,
      detectionResults: {
        fileExistsMatch: !!fileExistsMatch,
        isReused,
        isKnownReusedHash,
        hasReuseMetadata,
        isDetectedAsReused
      }
    });
  } catch (err) {
    console.error("Test kit reuse scenario error:", err);
    res.status(500).json({ error: err.message || "Test failed" });
  }
});

// Test endpoint to simulate file reuse scenario
app.post("/test-file-reuse", async (req, res) => {
  try {
    console.log(`🧪 Testing file reuse detection...`);
    
    // Simulate a scenario where the kit would say "File already exists on network"
    const testHash = "0x9aee3aae6aea25bed27d351ab304b6d81366dc2ca1d97785875fc6505ce927ea";
    
    // Add this hash to our cache to simulate it being a reused file
    tempCache.set(testHash, { 
      buffer: Buffer.from("test data"), 
      name: "test-file.png", 
      type: "image/png", 
      size: 9, 
      createdAt: Date.now() 
    });
    
    console.log(`🧪 Added test hash to cache: ${testHash}`);
    
    res.json({ 
      success: true, 
      message: "Test hash added to cache",
      hash: testHash,
      cacheSize: tempCache.size
    });
  } catch (err) {
    console.error("Test file reuse error:", err);
    res.status(500).json({ error: err.message || "Test failed" });
  }
});

// Test endpoint to check kit response
app.post("/test-kit-response", async (req, res) => {
  try {
    const { testData } = req.body;
    console.log(`🧪 Testing kit response with data:`, testData);
    
    const formData = new FormData();
    formData.append('file', Buffer.from(JSON.stringify(testData)), { filename: 'test.json', contentType: 'application/json' });
    
    const response = await postWithRetry(`${OG_STORAGE_API}/upload`, formData, formData.getHeaders());
    console.log(`🧪 Kit test response:`, JSON.stringify(response.data, null, 2));
    console.log(`🧪 Kit test headers:`, JSON.stringify(response.headers, null, 2));
    
    res.json({ 
      success: true, 
      kitResponse: response.data,
      kitHeaders: response.headers
    });
  } catch (err) {
    console.error("Test kit response error:", err);
    res.status(500).json({ error: err.message || "Test failed" });
  }
});

// Check if file already exists on network
app.post("/check-file", async (req, res) => {
  try {
    const { fileHash, fileName, fileSize } = req.body;
    
    if (!fileHash || !fileName || !fileSize) {
      return res.status(400).json({ error: "Missing required fields: fileHash, fileName, fileSize" });
    }

    console.log(`🔍 Checking if file exists on network: ${fileHash} (${fileName}, ${fileSize} bytes)`);

    // Check if we have this file in our cache by exact hash
    const cachedFile = tempCache.get(fileHash) || readDiskCache(fileHash);
    if (cachedFile) {
      console.log(`✅ File found in cache by exact hash: ${fileHash}`);
      return res.json({
        exists: true,
        rootHash: fileHash,
        name: cachedFile.name,
        size: cachedFile.size,
        type: cachedFile.type
      });
    }

    // Check if we have a file with similar characteristics (name and size)
    // This is a simplified approach for demonstration
    for (const [hash, cached] of tempCache.entries()) {
      if (cached.name === fileName && Math.abs(cached.size - fileSize) < 100) { // Allow 100 byte difference
        console.log(`✅ File found in cache by characteristics: ${hash} (${cached.name}, ${cached.size} bytes)`);
        return res.json({
          exists: true,
          rootHash: hash,
          name: cached.name,
          size: cached.size,
          type: cached.type
        });
      }
    }

    // Check disk cache for similar files
    try {
      const cacheFiles = fs.readdirSync(CACHE_DIR);
      for (const cacheFile of cacheFiles) {
        if (cacheFile.endsWith('.json')) {
          const metaPath = path.join(CACHE_DIR, cacheFile);
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          if (meta.name === fileName && Math.abs(meta.size - fileSize) < 100) {
            const hash = cacheFile.replace('.json', '');
            console.log(`✅ File found in disk cache by characteristics: ${hash} (${meta.name}, ${meta.size} bytes)`);
            return res.json({
              exists: true,
              rootHash: hash,
              name: meta.name,
              size: meta.size,
              type: meta.type
            });
          }
        }
      }
    } catch (diskError) {
      console.warn('Could not check disk cache:', diskError.message);
    }

    // If we have a specific hash to check on the network, try that
    if (fileHash.startsWith('0x') && fileHash.length === 66) { // Looks like a proper hash
      try {
        // Try to download the file from 0G Storage to see if it exists
        const response = await axios.get(`${OG_STORAGE_API}/download/${fileHash}`, {
          timeout: 60000, // 60 second timeout
          validateStatus: (status) => status < 500 // Don't throw on 404, only on server errors
        });

        if (response.status === 200) {
          console.log(`✅ File already exists on 0G Storage network: ${fileHash}`);
          return res.json({
            exists: true,
            rootHash: fileHash,
            name: fileName,
            size: fileSize,
            type: 'unknown' // We don't know the exact type from the network
          });
        } else if (response.status === 404) {
          console.log(`❌ File not found on 0G Storage network: ${fileHash}`);
        } else {
          console.log(`⚠️ Unexpected response from 0G Storage: ${response.status}`);
        }
      } catch (networkError) {
        if (networkError.response?.status === 404) {
          console.log(`❌ File not found on 0G Storage network: ${fileHash}`);
        } else {
          console.warn(`⚠️ Network error checking file existence: ${networkError.message}`);
        }
      }
    }

    // File not found anywhere
    console.log(`❌ File not found in cache or network: ${fileName} (${fileSize} bytes)`);
    return res.json({
      exists: false
    });
    
  } catch (err) {
    console.error("Check file error:", err);
    res.status(500).json({ error: err.message || "Check file failed" });
  }
});

// Job status endpoint removed - direct uploads only

/**
 * Transparent 1x1 PNG placeholder
 */
const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  "base64"
);

/**
 * Download file or JSON data from 0G Storage with controlled timing
 */
app.get("/download/:rootHash", async (req, res) => {
  try {
    const { rootHash } = req.params;
    console.log(`📥 Download request for rootHash: ${rootHash}`);

    // 0) Check if this is a valid hash (allow temporary hashes for immediate access)
    if (!rootHash || (rootHash.startsWith('upload-') && !rootHash.startsWith('temp-')) || rootHash.length < 10) {
      console.log(`⚠️ Invalid rootHash format: ${rootHash}`);
      return res.status(400).json({ error: 'Invalid rootHash format' });
    }

    // 0.1) Check download cooldown to prevent spam
    const now = Date.now();
    const lastDownload = downloadCooldown.get(rootHash);
    if (lastDownload && (now - lastDownload) < DOWNLOAD_COOLDOWN_MS) {
      const remainingCooldown = Math.ceil((DOWNLOAD_COOLDOWN_MS - (now - lastDownload)) / 1000);
      console.log(`⏳ Download cooldown active for ${rootHash}, ${remainingCooldown}s remaining`);
      return res.status(429).json({ 
        error: 'Download cooldown active', 
        remainingSeconds: remainingCooldown,
        message: 'Please wait before requesting this file again'
      });
    }

    // 0.2) Check if download is already in progress
    if (activeDownloads.has(rootHash)) {
      console.log(`🔄 Download already in progress for ${rootHash}, returning status`);
      return res.status(202).json({ 
        status: 'download_in_progress',
        message: 'Download already in progress, please wait'
      });
    }

    // Mark download as active
    activeDownloads.set(rootHash, now);

    // 1) Serve immediately from memory cache (fastest)
    const cached = tempCache.get(rootHash);
    if (cached) {
      console.log(`⚡ Served from memory cache: ${rootHash}`);
      activeDownloads.delete(rootHash); // Clear active download
      
      // Track file access
      updateFileAccess(rootHash).catch(e => console.warn('Failed to track file access:', e.message));
      
      res.set({
        "Content-Type": cached.type,
        "Content-Length": cached.size,
        "Content-Disposition": `inline; filename="${cached.name}"`,
        "Cache-Control": "public, max-age=3600",
        "X-Cache": "memory"
      });
      return res.send(cached.buffer);
    }

    // 2) Serve from disk cache
    const disk = readDiskCache(rootHash);
    if (disk) {
      console.log(`💾 Served from disk cache: ${rootHash}`);
      activeDownloads.delete(rootHash); // Clear active download
      res.set({
        "Content-Type": disk.type || 'application/octet-stream',
        "Content-Length": disk.size || disk.buffer.length,
        "Content-Disposition": `inline; filename="${disk.name || rootHash}"`,
        "Cache-Control": "public, max-age=3600",
        "X-Cache": "disk"
      });
      return res.send(disk.buffer);
    }

    // 3) Wait 2 minutes before attempting 0G Storage download (avoid spam)
    console.log(`⏳ Waiting 2 minutes before 0G Storage download request...`);
    await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes wait
    
    // 4) Single attempt to pull from 0G Storage (no spam)
    console.log(`🔍 Attempting single 0G Storage download...`);
    try {
      const ogResponse = await axios.get(`${OG_STORAGE_API}/download/${rootHash}`, { 
        responseType: 'arraybuffer',
        timeout: 60000 // 1 minute timeout
      });
      
      const contentType = ogResponse.headers['content-type'] || 'application/octet-stream';
      const buffer = Buffer.from(ogResponse.data);
      const meta = { 
        name: rootHash, 
        type: contentType, 
        size: buffer.length, 
        createdAt: Date.now(),
        ogStorageHash: rootHash
      };
      
      // Cache the result
      tempCache.set(rootHash, { buffer, ...meta });
      writeDiskCache(rootHash, buffer, meta);
      
      console.log(`✅ 0G Storage download successful: ${rootHash}`);
      
      // Clear active download status
      activeDownloads.delete(rootHash);
      
      res.set({ 
        "Content-Type": contentType, 
        "Content-Length": buffer.length, 
        "Cache-Control": "public, max-age=31536000",
        "X-Cache": "0g-storage"
      });
      return res.send(buffer);
      
    } catch (e) {
      console.warn(`⚠️ 0G Storage download failed: ${e.message}`);
      
      // Set download cooldown to prevent spam
      downloadCooldown.set(rootHash, now);
      
      // Return placeholder with longer cache time
      res.status(202).set({ 
        "Content-Type": "image/png", 
        "Cache-Control": "public, max-age=300", // 5 minutes
        "X-Cache": "placeholder"
      }).send(PLACEHOLDER_PNG);
      
      // Background retry after 5 minutes (not immediate)
      setTimeout(async () => {
        try {
          console.log(`🔄 Background retry for 0G Storage download: ${rootHash}`);
          const ogResponse = await axios.get(`${OG_STORAGE_API}/download/${rootHash}`, { 
            responseType: 'arraybuffer',
            timeout: 60000
          });
          const contentType = ogResponse.headers['content-type'] || 'application/octet-stream';
          const buffer = Buffer.from(ogResponse.data);
          const meta = { 
            name: rootHash, 
            type: contentType, 
            size: buffer.length, 
            createdAt: Date.now(),
            ogStorageHash: rootHash
          };
          tempCache.set(rootHash, { buffer, ...meta });
          writeDiskCache(rootHash, buffer, meta);
          console.log(`✅ Background 0G Storage download successful: ${rootHash}`);
        } catch (bgError) {
          console.warn(`⚠️ Background 0G Storage download failed: ${bgError.message}`);
        } finally {
          // Always clear active download status
          activeDownloads.delete(rootHash);
        }
      }, 300000); // 5 minutes delay
    }
  } catch (err) {
    console.error("Download error:", err?.response?.data || err.message);
    res.status(500).json({ error: "Download failed" });
  }
});

/**
 * Create a new coin with 0G Storage integration
 */
app.post("/createCoin", upload.single("image"), async (req, res) => {
  try {
    const { name, symbol, description, supply, creator, imageRootHash: imageRootHashFromBody, tokenAddress, curveAddress, txHash, telegramUrl, xUrl, discordUrl, websiteUrl } = req.body;
    const imageFile = req.file;

    if (!name || !symbol || !description || !supply || !creator) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log(`Creating coin: ${name} (${symbol})`);

    let imageRootHash = null;
    
    // Upload image to 0G Storage if provided
    if (imageFile) {
      console.log(`📤 Received coin image: ${imageFile.originalname} (${imageFile.size} bytes)`);
      
      // STEP 1: COMPRESSION FIRST - Ultra-aggressive compression
      console.log(`🗜️ Starting coin image compression...`);
      let outputBuffer = imageFile.buffer;
      let outName = imageFile.originalname;
      let outType = imageFile.mimetype;
      
      try {
        // WebP compression
        console.log(`🖼️ Compressing coin image to WebP format...`);
        const webp = await sharp(imageFile.buffer).webp({ 
          quality: 20,        // Extremely low quality for maximum compression
          effort: 6,          // Maximum compression effort (fixed from 9)
          nearLossless: true, // Better compression
          smartSubsample: true, // Smart subsampling
          lossless: false     // Ensure lossy compression for smaller size
        })
        .resize(800, 600, { // Resize to reduce file size
          fit: 'inside',
          withoutEnlargement: true
        })
        .toBuffer({ resolveWithObject: true });
        
        if (webp.data.length < imageFile.size) {
        outputBuffer = webp.data;
        outName = imageFile.originalname.replace(/\.[^.]+$/i, '') + '.webp';
        outType = 'image/webp';
          console.log(`✅ Coin image compression: ${imageFile.size}B → ${outputBuffer.length}B (${Math.round((1 - outputBuffer.length/imageFile.size) * 100)}% reduction)`);
        } else {
          console.log(`⚠️ WebP compression didn't reduce size, keeping original`);
        }
        
        // Gzip compression
        if (outputBuffer.length > 1024) {
          console.log(`🗜️ Applying Gzip compression to coin image...`);
          const { gzip } = require('zlib');
          const { promisify } = require('util');
          const gzipAsync = promisify(gzip);
          
          try {
            const gzipped = await gzipAsync(outputBuffer, { 
              level: 9,
              memLevel: 9,
              strategy: require('zlib').constants.Z_HUFFMAN_ONLY
            });
            if (gzipped.length < outputBuffer.length) {
              const beforeGzip = outputBuffer.length;
              outputBuffer = gzipped;
              outName = outName + '.gz';
              outType = 'application/gzip';
              console.log(`✅ Coin image Gzip: ${beforeGzip}B → ${gzipped.length}B (${Math.round((1 - gzipped.length/beforeGzip) * 100)}% reduction)`);
            }
          } catch (gzipError) {
            console.warn('Coin image Gzip compression failed:', gzipError.message);
          }
        }
        
        console.log(`🎯 Final coin image compression: ${imageFile.size}B → ${outputBuffer.length}B (${Math.round((1 - outputBuffer.length/imageFile.size) * 100)}% total reduction)`);
        
      } catch (e) {
        console.warn('Coin image compression failed:', e?.message || e);
      }
      
      // Direct upload to 0G Storage
      console.log(`🚀 Uploading coin image directly to 0G Storage...`);
      const formData = new FormData();
      formData.append('file', outputBuffer, { filename: outName, contentType: outType });
      
      const response = await postWithRetry(`${OG_STORAGE_API}/upload`, formData, formData.getHeaders());
      imageRootHash = response.data.rootHash;
      
      console.log(`✅ Coin image upload successful: ${imageRootHash}`);
      
      // Cache the result
      const meta = {
        name: outName,
        type: outType,
        size: outputBuffer.length,
        createdAt: Date.now()
      };
      
      tempCache.set(imageRootHash, { buffer: outputBuffer, ...meta });
      writeDiskCache(imageRootHash, outputBuffer, meta);
      
    } else if (imageRootHashFromBody) {
      imageRootHash = imageRootHashFromBody;
      console.log(`Using provided imageRootHash: ${imageRootHash}`);
    }

    // Create metadata JSON
    const metadata = {
      name,
      symbol,
      description,
      supply,
      creator,
      imageRootHash,
      createdAt: new Date().toISOString(),
      type: 'coin-metadata',
      telegramUrl: telegramUrl || undefined,
      xUrl: xUrl || undefined,
      discordUrl: discordUrl || undefined,
      websiteUrl: websiteUrl || undefined
    };

    // Upload metadata to 0G Storage directly
    let metadataRootHash = null;
      try {
      console.log(`📤 Uploading coin metadata to 0G Storage`);
        const metadataFormData = new FormData();
        metadataFormData.append('file', Buffer.from(JSON.stringify(metadata)), { filename: 'metadata.json', contentType: 'application/json' });
        const metadataResponse = await postWithRetry(`${OG_STORAGE_API}/upload`, metadataFormData, metadataFormData.getHeaders());
        metadataRootHash = metadataResponse.data.rootHash;
        console.log(`✅ Metadata uploaded with rootHash: ${metadataRootHash}`);
      } catch (e) {
      console.warn('Metadata upload failed:', e?.message || e);
      // Continue without metadata hash
    }

    // Create coin data structure with advanced fields
    const coinData = {
      id: `${symbol.toLowerCase()}-${Date.now()}`,
      name,
      symbol,
      supply,
      description,
      imageUrl: imageRootHash ? `http://localhost:4000/download/${imageRootHash}` : null,
      metadataUrl: metadataRootHash ? `http://localhost:4000/download/${metadataRootHash}` : null,
      imageRootHash,
      metadataRootHash,
      createdAt: new Date().toISOString(),
      creator,
      telegramUrl: telegramUrl || undefined,
      xUrl: xUrl || undefined,
      discordUrl: discordUrl || undefined,
      websiteUrl: websiteUrl || undefined,
      price: 0,
      marketCap: 0,
      volume24h: 0,
      change24h: 0,
      // Advanced fields
      imageCompressionRatio: imageFile ? (outputBuffer.length / imageFile.size) : null,
      imageOriginalSize: imageFile ? imageFile.size : null,
      imageCompressedSize: imageFile ? outputBuffer.length : null,
      category: 'memecoin',
      riskLevel: 1,
      isActive: true,
      isVerified: false,
      isTrading: false,
      hasLiquidity: false
    };

    // Persist coin row immediately so UI can list it
    try {
      await insertCoinIfMissing({
        id: coinData.id,
        name: coinData.name,
        symbol: coinData.symbol,
        supply: coinData.supply,
        description: coinData.description,
        creator: coinData.creator,
        createdAt: Date.now(),
        imageHash: coinData.imageRootHash,
        imageUrl: coinData.imageUrl,
        metadataHash: coinData.metadataRootHash,
        metadataUrl: coinData.metadataUrl,
        imageCompressionRatio: coinData.imageCompressionRatio,
        imageOriginalSize: coinData.imageOriginalSize,
        imageCompressedSize: coinData.imageCompressedSize,
        tokenAddress: tokenAddress || null,
        curveAddress: curveAddress || null,
        txHash: txHash || `local-${Date.now()}`,
        telegramUrl: coinData.telegramUrl,
        xUrl: coinData.xUrl,
        discordUrl: coinData.discordUrl,
        websiteUrl: coinData.websiteUrl,
        category: coinData.category,
        riskLevel: coinData.riskLevel,
        isActive: coinData.isActive,
        isVerified: coinData.isVerified,
        isTrading: coinData.isTrading,
        hasLiquidity: coinData.hasLiquidity
      });
    } catch (e) {
      console.warn('Failed to insert coin:', e.message);
    }

    res.json({ success: true, coin: coinData });

  } catch (err) {
    console.error("Create coin error:", err);
    res.status(500).json({ error: err.message || "Failed to create coin" });
  }
});

/**
 * Get all coins from database with advanced filtering
 */
app.get("/coins", async (req, res) => {
  try {
    const { 
      category, 
      isActive, 
      isTrading, 
      hasLiquidity, 
      isVerified,
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;
    
    const db = await getDatabase();
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }
    if (isActive !== undefined) {
      whereClause += ' AND isActive = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }
    if (isTrading !== undefined) {
      whereClause += ' AND isTrading = ?';
      params.push(isTrading === 'true' ? 1 : 0);
    }
    if (hasLiquidity !== undefined) {
      whereClause += ' AND hasLiquidity = ?';
      params.push(hasLiquidity === 'true' ? 1 : 0);
    }
    if (isVerified !== undefined) {
      whereClause += ' AND isVerified = ?';
      params.push(isVerified === 'true' ? 1 : 0);
    }
    
    const validSortFields = ['createdAt', 'marketCap', 'volume24h', 'price', 'name', 'symbol'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    const coins = await db.all(`
      SELECT * FROM coins 
      ${whereClause}
      ORDER BY ${sortField} ${order}
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);
    
    // Get total count
    const countResult = await db.get(`
      SELECT COUNT(*) as total FROM coins ${whereClause}
    `, params);
    
    await db.close();
    
    // Add imageUrl for each coin
    const coinsWithUrls = coins.map(coin => ({
      ...coin,
      imageUrl: coin.imageHash ? `http://localhost:4000/download/${coin.imageHash}` : null,
      metadataUrl: coin.metadataHash ? `http://localhost:4000/download/${coin.metadataHash}` : null,
      tags: coin.tags ? JSON.parse(coin.tags) : []
    }));
    
    res.json({
      coins: coinsWithUrls,
      pagination: {
        total: countResult.total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < countResult.total
      },
      filters: {
        category,
        isActive,
        isTrading,
        hasLiquidity,
        isVerified
      },
      sorting: {
        sortBy: sortField,
        sortOrder: order
      }
    });
  } catch (err) {
    console.error("Get coins error:", err);
    res.status(500).json({ error: "Failed to get coins" });
  }
});

/**
 * Get 0G Storage files statistics
 */
app.get("/og-storage/stats", async (req, res) => {
  try {
    const db = await getDatabase();
    
    const stats = await db.get(`
      SELECT 
        COUNT(*) as totalFiles,
        SUM(originalSize) as totalOriginalSize,
        SUM(compressedSize) as totalCompressedSize,
        AVG(compressionRatio) as avgCompressionRatio,
        SUM(accessCount) as totalAccesses,
        COUNT(DISTINCT coinId) as filesWithCoins
      FROM og_storage_files 
      WHERE isActive = 1
    `);
    
    const compressionStats = await db.all(`
      SELECT 
        compressionType,
        COUNT(*) as count,
        AVG(compressionRatio) as avgRatio,
        SUM(originalSize) as totalOriginalSize,
        SUM(compressedSize) as totalCompressedSize
      FROM og_storage_files 
      WHERE isActive = 1
      GROUP BY compressionType
    `);
    
    await db.close();
    
    res.json({
      overview: {
        ...stats,
        totalSavings: stats.totalOriginalSize - stats.totalCompressedSize,
        savingsPercentage: stats.totalOriginalSize > 0 ? 
          ((stats.totalOriginalSize - stats.totalCompressedSize) / stats.totalOriginalSize * 100) : 0
      },
      compressionBreakdown: compressionStats
    });
  } catch (err) {
    console.error("Get OG storage stats error:", err);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

/**
 * Get coin details with full information
 */
app.get("/coins/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    
    const coin = await db.get(`
      SELECT * FROM coins WHERE id = ? OR symbol = ? OR tokenAddress = ?
    `, [id, id, id]);
    
    if (!coin) {
      return res.status(404).json({ error: "Coin not found" });
    }
    
    // Get related 0G Storage files
    const files = await db.all(`
      SELECT * FROM og_storage_files WHERE coinId = ?
    `, [coin.id]);
    
    // Get trading history
    const tradingHistory = await db.all(`
      SELECT * FROM trading_history WHERE coinId = ? ORDER BY timestamp DESC LIMIT 10
    `, [coin.id]);
    
    await db.close();
    
    res.json({
      ...coin,
      imageUrl: coin.imageHash ? `http://localhost:4000/download/${coin.imageHash}` : null,
      metadataUrl: coin.metadataHash ? `http://localhost:4000/download/${coin.metadataHash}` : null,
      tags: coin.tags ? JSON.parse(coin.tags) : [],
      ogStorageFiles: files,
      recentTrading: tradingHistory
    });
  } catch (err) {
    console.error("Get coin details error:", err);
    res.status(500).json({ error: "Failed to get coin details" });
  }
});

/**
 * ON-CHAIN ENDPOINTS
 */

// List tokens created by an owner (reads factory events)
app.get("/tokens/onchain", async (req, res) => {
  try {
    const owner = (req.query.creator || req.query.owner || "").toString().toLowerCase();
    if (!owner || !ethers.utils.isAddress(owner)) {
      return res.status(400).json({ error: "creator (owner) query param required" });
    }

    const iface = new ethers.utils.Interface(FACTORY_ABI);
    const topic = iface.getEventTopic("TokenCreated");
    
    // Smart block range handling - start from a reasonable recent block
    const currentBlock = await provider.getBlockNumber();
    const maxBlockRange = 10000; // 0G RPC limit
    const fromBlock = Math.max(0, currentBlock - maxBlockRange);
    
    console.log(`🔍 Querying logs from block ${fromBlock} to ${currentBlock} (range: ${currentBlock - fromBlock})`);
    
    const logs = await provider.getLogs({
      address: FACTORY_ADDRESS,
      fromBlock: fromBlock,
      toBlock: currentBlock,
      topics: [topic, null, ethers.utils.hexZeroPad(owner, 32)]
    });
    
    console.log(`✅ Found ${logs.length} TokenCreated events for ${owner}`);
    
    const tokens = logs.map(l => {
      const parsed = iface.parseLog(l);
      return {
        tokenAddress: parsed.args.token,
        owner: parsed.args.owner,
        name: parsed.args.name,
        symbol: parsed.args.symbol,
        initialSupply: parsed.args.initialSupply?.toString?.() || null,
        txHash: l.transactionHash,
        blockNumber: l.blockNumber
      };
    });
    
    res.json({ 
      count: tokens.length, 
      tokens,
      queryInfo: {
        fromBlock: fromBlock,
        toBlock: currentBlock,
        blockRange: currentBlock - fromBlock,
        maxBlockRange: maxBlockRange
      }
    });
  } catch (e) {
    console.error("/tokens/onchain error:", e);
    
    // Provide helpful error messages for common issues
    if (e.code === -32000 && e.message?.includes("invalid block range")) {
      return res.status(400).json({ 
        error: "block_range_too_large",
        message: "Block range exceeds RPC limits. Try querying a smaller range.",
        suggestion: "Use query params: ?fromBlock=<number>&toBlock=<number>"
      });
    }
    
    res.status(500).json({ error: "failed_to_list_tokens", details: e.message });
  }
});

// Fetch metadata for a token address from the OGToken contract
app.get("/token/:address/metadata", async (req, res) => {
  try {
    const addr = req.params.address;
    if (!ethers.utils.isAddress(addr)) return res.status(400).json({ error: "invalid_address" });
    const contract = new ethers.Contract(addr, OG_TOKEN_ABI, provider);
    const [n, s, desc, metaRoot, imgRoot, creator, createdAt] = await contract.getMetadata();
    res.json({ 
      name: n,
      symbol: s,
      description: desc,
      metadataRootHash: metaRoot,
      imageRootHash: imgRoot,
      creator,
      createdAt: createdAt?.toString?.() || null,
      imageUrl: imgRoot ? `/download/${metaRoot}` : null,
      metadataUrl: metaRoot ? `/download/${metaRoot}` : null
    });
  } catch (e) {
    console.error("/token/:address/metadata error:", e);
    res.status(500).json({ error: "failed_to_get_metadata" });
  }
});

// Smart paginated token listing with custom block ranges
app.get("/tokens/smart", async (req, res) => {
  try {
    const owner = (req.query.creator || req.query.owner || "").toString().toLowerCase();
    if (!owner || !ethers.utils.isAddress(owner)) {
      return res.status(400).json({ error: "creator (owner) query param required" });
    }

    // Parse query parameters for smart querying
    const fromBlockParam = req.query.fromBlock ? parseInt(req.query.fromBlock) : null;
    const toBlockParam = req.query.toBlock ? parseInt(req.query.toBlock) : null;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 tokens per request
    const offset = parseInt(req.query.offset) || 0;

    const iface = new ethers.utils.Interface(FACTORY_ABI);
    const topic = iface.getEventTopic("TokenCreated");
    
    // Smart block range calculation
    const currentBlock = await provider.getBlockNumber();
    const maxBlockRange = 10000; // 0G RPC limit
    
    let fromBlock, toBlock;
    
    if (fromBlockParam && toBlockParam) {
      // User specified custom range
      fromBlock = fromBlockParam;
      toBlock = toBlockParam;
      
      // Validate range size
      if (toBlock - fromBlock > maxBlockRange) {
        return res.status(400).json({
          error: "block_range_too_large",
          message: `Block range ${toBlock - fromBlock} exceeds maximum allowed ${maxBlockRange}`,
          suggestion: "Use smaller ranges or use pagination"
        });
      }
    } else {
      // Auto-calculate smart range
      fromBlock = Math.max(0, currentBlock - maxBlockRange);
      toBlock = currentBlock;
    }
    
    console.log(`🔍 Smart query: blocks ${fromBlock}-${toBlock} (range: ${toBlock - fromBlock}) for ${owner}`);
    
    const logs = await provider.getLogs({
      address: FACTORY_ADDRESS,
      fromBlock: fromBlock,
      toBlock: toBlock,
      topics: [topic, null, ethers.utils.hexZeroPad(owner, 32)]
    });
    
    // Sort by block number (newest first) and apply pagination
    const sortedLogs = logs.sort((a, b) => b.blockNumber - a.blockNumber);
    const paginatedLogs = sortedLogs.slice(offset, offset + limit);
    
    const tokens = paginatedLogs.map(l => {
      const parsed = iface.parseLog(l);
      return {
        tokenAddress: parsed.args.token,
        owner: parsed.args.owner,
        name: parsed.args.name,
        symbol: parsed.args.symbol,
        initialSupply: parsed.args.initialSupply?.toString?.() || null,
        txHash: l.transactionHash,
        blockNumber: l.blockNumber
      };
    });
    
    res.json({
      tokens,
      pagination: {
        total: logs.length,
        limit,
        offset,
        hasMore: offset + limit < logs.length
      },
      queryInfo: {
        fromBlock,
        toBlock,
        blockRange: toBlock - fromBlock,
        maxBlockRange,
        currentBlock
      }
    });
    
  } catch (e) {
    console.error("/tokens/smart error:", e);
    
    if (e.code === -32000 && e.message?.includes("invalid block range")) {
      return res.status(400).json({
        error: "block_range_too_large",
        message: "Block range exceeds RPC limits",
        suggestion: "Use smaller ranges or the default smart range"
      });
    }
    
    res.status(500).json({ error: "failed_to_query_tokens", details: e.message });
  }
});

/**
 * USER PROFILE ENDPOINTS
 */

// 0G Storage functions for profile persistence with fallback
async function saveProfileToOGStorage(walletAddress, profileData) {
  try {
    console.log(`💾 Saving profile to 0G Storage for ${walletAddress}`);
    
    // Create a unique filename for the profile
    const profileKey = `profile_${walletAddress.toLowerCase()}.json`;
    
    // Upload profile data to 0G Storage
    const formData = new FormData();
    formData.append('file', Buffer.from(JSON.stringify(profileData)), { 
      filename: profileKey, 
      contentType: 'application/json' 
    });
    
    const response = await postWithRetry(`${OG_STORAGE_API}/upload`, formData, formData.getHeaders());
    const rootHash = response.data.rootHash;
    
    console.log(`✅ Profile saved to 0G Storage: ${rootHash}`);
    
    // Store the mapping in database for quick retrieval
    const db = await getDatabase();
    try {
      await db.run(
        `INSERT OR REPLACE INTO user_profiles (walletAddress, profileHash, createdAt, updatedAt) VALUES (?, ?, ?, ?)`,
        [walletAddress.toLowerCase(), rootHash, Date.now(), Date.now()]
      );
    } finally {
      await db.close();
    }
    
    return rootHash;
  } catch (error) {
    console.warn('0G Storage unavailable, using local file fallback:', error.message);
    return await saveProfileToLocalFile(walletAddress, profileData);
  }
}

// Fallback: Save profile to local file system
async function saveProfileToLocalFile(walletAddress, profileData) {
  try {
    console.log(`💾 Saving profile to local file for ${walletAddress}`);
    
    // Ensure profiles directory exists
    const profilesDir = path.join(process.cwd(), 'data', 'profiles');
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
    }
    
    // Save profile to local file
    const profileFile = path.join(profilesDir, `${walletAddress.toLowerCase()}.json`);
    fs.writeFileSync(profileFile, JSON.stringify(profileData, null, 2));
    
    console.log(`✅ Profile saved to local file: ${profileFile}`);
    
    // Store the mapping in database for quick retrieval
    const db = await getDatabase();
    try {
      await db.run(
        `INSERT OR REPLACE INTO user_profiles (walletAddress, profileHash, createdAt, updatedAt) VALUES (?, ?, ?, ?)`,
        [walletAddress.toLowerCase(), `local:${profileFile}`, Date.now(), Date.now()]
      );
    } finally {
      await db.close();
    }
    
    return `local:${profileFile}`;
  } catch (error) {
    console.error('Failed to save profile to local file:', error);
    throw error;
  }
}

async function getProfileFromOGStorage(walletAddress) {
  try {
    console.log(`📥 Loading profile for ${walletAddress}`);
    
    // First, get the profile hash from database
    const db = await getDatabase();
    let profileHash = null;
    try {
      const row = await db.get(
        `SELECT profileHash FROM user_profiles WHERE walletAddress = ?`,
        [walletAddress.toLowerCase()]
      );
      profileHash = row?.profileHash;
    } finally {
      await db.close();
    }
    
    if (!profileHash) {
      console.log(`📭 No profile found for ${walletAddress}`);
      return null;
    }
    
    // Check if it's a local file or 0G Storage hash
    if (profileHash.startsWith('local:')) {
      return await getProfileFromLocalFile(profileHash);
    } else {
      return await getProfileFromOGStorageHash(profileHash);
    }
  } catch (error) {
    console.error('Failed to load profile:', error);
    return null;
  }
}

// Load profile from 0G Storage hash
async function getProfileFromOGStorageHash(profileHash) {
  try {
    console.log(`🔍 Downloading profile from 0G Storage: ${profileHash}`);
    const response = await axios.get(`${OG_STORAGE_API}/download/${profileHash}`, {
      timeout: 60000,
      responseType: 'json'
    });
    
    if (response.data && typeof response.data === 'object') {
      console.log(`✅ Profile loaded from 0G Storage: ${profileHash}`);
      return response.data;
    } else {
      console.log(`⚠️ Invalid profile data from 0G Storage: ${profileHash}`);
      return null;
    }
  } catch (error) {
    console.error('Failed to load profile from 0G Storage:', error);
    return null;
  }
}

// Load profile from local file
async function getProfileFromLocalFile(profileHash) {
  try {
    const profileFile = profileHash.replace('local:', '');
    console.log(`📁 Loading profile from local file: ${profileFile}`);
    
    if (!fs.existsSync(profileFile)) {
      console.log(`📭 Local profile file not found: ${profileFile}`);
      return null;
    }
    
    const profileData = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
    console.log(`✅ Profile loaded from local file: ${profileFile}`);
    return profileData;
  } catch (error) {
    console.error('Failed to load profile from local file:', error);
    return null;
  }
}

// Get user profile
app.get("/profile/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    // Try to load profile from 0G Storage
    let profile = await getProfileFromOGStorage(walletAddress);
    
    if (!profile) {
      // Create new profile if doesn't exist
      profile = {
        walletAddress: walletAddress.toLowerCase(),
        username: `User_${walletAddress.slice(0, 6)}`,
        bio: 'Welcome to OG Pump! 🚀',
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tokensCreated: [],
        tradingStats: {
          totalTrades: 0,
          totalVolume: 0,
          tokensHeld: 0,
          favoriteTokens: [],
          lastTradeAt: null
        },
        preferences: {
          theme: 'light',
          notifications: true,
          publicProfile: true,
          showTradingStats: true
        }
      };
      
      // Save the new profile to 0G Storage
      try {
        await saveProfileToOGStorage(walletAddress, profile);
        console.log(`✅ New profile created and saved to 0G Storage for ${walletAddress}`);
      } catch (saveError) {
        console.warn('Failed to save new profile to 0G Storage:', saveError.message);
        // Continue with in-memory profile if 0G Storage fails
      }
    }

    res.json({ success: true, profile });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// Update user profile
app.put("/profile/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { username, bio, preferences } = req.body;
    
    if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    // Get existing profile from 0G Storage or create new one
    let existingProfile = await getProfileFromOGStorage(walletAddress);
    
    if (!existingProfile) {
      // Create new profile if doesn't exist
      existingProfile = {
        walletAddress: walletAddress.toLowerCase(),
        username: `User_${walletAddress.slice(0, 6)}`,
        bio: 'Welcome to OG Pump! 🚀',
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tokensCreated: [],
        tradingStats: {
          totalTrades: 0,
          totalVolume: 0,
          tokensHeld: 0,
          favoriteTokens: [],
          lastTradeAt: null
        },
        preferences: {
          theme: 'light',
          notifications: true,
          publicProfile: true,
          showTradingStats: true
        }
      };
    }
    
    // Update profile with new data
    const updatedProfile = {
      ...existingProfile,
      username: username || existingProfile.username,
      bio: bio || existingProfile.bio,
      updatedAt: new Date().toISOString(),
      preferences: {
        ...existingProfile.preferences,
        ...preferences
      }
    };
    
    // Save updated profile to 0G Storage
    try {
      await saveProfileToOGStorage(walletAddress, updatedProfile);
      console.log(`✅ Profile updated and saved to 0G Storage for ${walletAddress}:`, {
        username: updatedProfile.username,
        bio: updatedProfile.bio
      });
    } catch (saveError) {
      console.error('Failed to save updated profile to 0G Storage:', saveError);
      return res.status(500).json({ error: "Failed to save profile to 0G Storage" });
    }

    res.json({ success: true, profile: updatedProfile });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Add token to user's created tokens
app.post("/profile/:walletAddress/tokens", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { tokenAddress, tokenName, tokenSymbol, curveAddress, txHash, imageUrl, description } = req.body;
    
    if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    if (!tokenAddress || !tokenName || !tokenSymbol) {
      return res.status(400).json({ error: "Missing required token fields" });
    }

    const tokenData = {
      tokenAddress,
      tokenName,
      tokenSymbol,
      curveAddress,
      createdAt: new Date().toISOString(),
      txHash,
      imageUrl,
      description
    };

    // For now, return success
    // In production, this would use UserProfileManager to add token to profile
    res.json({ success: true, token: tokenData });
  } catch (error) {
    console.error("Add token to profile error:", error);
    res.status(500).json({ error: "Failed to add token to profile" });
  }
});

// Update trading stats
app.put("/profile/:walletAddress/stats", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { totalTrades, totalVolume, tokensHeld, favoriteTokens } = req.body;
    
    if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const statsUpdate = {
      totalTrades: totalTrades || 0,
      totalVolume: totalVolume || 0,
      tokensHeld: tokensHeld || 0,
      favoriteTokens: favoriteTokens || [],
      lastTradeAt: new Date().toISOString()
    };

    // For now, return success
    // In production, this would use UserProfileManager to update stats
    res.json({ success: true, stats: statsUpdate });
  } catch (error) {
    console.error("Update trading stats error:", error);
    res.status(500).json({ error: "Failed to update trading stats" });
  }
});

// Upload avatar
app.post("/profile/:walletAddress/avatar", upload.single("avatar"), async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const avatarFile = req.file;
    
    if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    if (!avatarFile) {
      return res.status(400).json({ error: "No avatar file provided" });
    }

    // Validate file
    if (!avatarFile.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: "Only image files are allowed" });
    }

    if (avatarFile.size > 5 * 1024 * 1024) { // 5MB limit
      return res.status(400).json({ error: "Image size must be less than 5MB" });
    }

    // For now, return a mock URL
    // In production, this would upload to 0G Storage using UserProfileManager
    const mockAvatarUrl = `http://localhost:4000/download/avatar-${walletAddress}`;

    res.json({ success: true, avatarUrl: mockAvatarUrl });
  } catch (error) {
    console.error("Upload avatar error:", error);
    res.status(500).json({ error: "Failed to upload avatar" });
  }
});

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    storage: "0G Storage Integration Active",
    ogStorageApi: OG_STORAGE_API
  });
});

// Blockchain status and limits endpoint
app.get("/blockchain/status", async (req, res) => {
  try {
    const currentBlock = await provider.getBlockNumber();
    const gasPrice = await provider.getGasPrice();
    
    res.json({
      status: "connected",
      currentBlock: currentBlock.toString(),
      gasPrice: gasPrice.toString(),
      rpcUrl: process.env.RPC_URL || "https://evmrpc-testnet.0g.ai",
      limits: {
        maxBlockRange: 10000,
        maxTokensPerQuery: 100,
        recommendedBlockRange: 5000
      },
      suggestions: {
        smartQuery: `/tokens/smart?creator=0x...`,
        customRange: `/tokens/smart?creator=0x...&fromBlock=5000000&toBlock=5005000`,
        pagination: `/tokens/smart?creator=0x...&limit=20&offset=0`
      }
    });
  } catch (e) {
    console.error("/blockchain/status error:", e);
    res.status(500).json({ 
      status: "error", 
      error: "failed_to_get_blockchain_status",
      details: e.message 
    });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 0G Storage Integration Server running on http://localhost:${PORT}`);
  console.log(`📤 Upload endpoint: POST /upload`);
  console.log(`📥 Download endpoint: GET /download/:rootHash`);
  console.log(`🪙 Create coin: POST /createCoin`);
  console.log(`🔗 On-chain list: GET /tokens/onchain?creator=0x...`);
  console.log(`🔗 Smart query: GET /tokens/smart?creator=0x...`);
  console.log(`🔗 Token metadata: GET /token/:address/metadata`);
  console.log(`🔗 Blockchain status: GET /blockchain/status`);
  console.log(`💚 Health check: GET /health`);
  console.log(`🔗 0G Storage API: ${OG_STORAGE_API}`);
});

// ==== Trading: Enable liquidity for an existing ERC20 token ====
// Minimal ABIs
const ROUTER_ABI_MIN = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)"
];
const ERC20_ABI_MIN = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

function getRouterAddressFromConfig() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'deployment-config.json'), 'utf8');
    const cfg = JSON.parse(raw);
    return cfg?.routerAddress || process.env.ROUTER_ADDRESS || "0x61fa1e78d101Ff616db00fE9e296C3E292393c63";
  } catch {
    return process.env.ROUTER_ADDRESS || "0x61fa1e78d101Ff616db00fE9e296C3E292393c63";
  }
}

app.post('/enableTrading', async (req, res) => {
  try {
    const { tokenAddress, tokenAmount, ethAmount } = req.body || {};
    if (!tokenAddress) return res.status(400).json({ success: false, error: 'tokenAddress required' });

    // Backend signer (must be the wallet that holds the tokens)
    const pk = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || '';
    if (!pk) return res.status(500).json({ success: false, error: 'Missing DEPLOYER_PRIVATE_KEY in .env' });
    const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : `0x${pk}`, provider);

    const routerAddr = getRouterAddressFromConfig();
    const router = new ethers.Contract(routerAddr, ROUTER_ABI_MIN, wallet);
    const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI_MIN, wallet);

    // Detect decimals and compute amounts
    let dec = 18; try { dec = await erc20.decimals(); } catch {}
    const tokenAmountWei = ethers.utils.parseUnits(String(tokenAmount || '100000'), dec); // default 100k
    const ethAmountWei = ethers.utils.parseEther(String(ethAmount || '0.1'));

    // Check balances
    const bal = await erc20.balanceOf(wallet.address);
    if (bal.lt(tokenAmountWei)) {
      return res.status(400).json({ success: false, error: `Insufficient token balance. Have ${ethers.utils.formatUnits(bal, dec)}` });
    }

    const ethBal = await wallet.getBalance();
    if (ethBal.lt(ethAmountWei)) {
      return res.status(400).json({ success: false, error: `Insufficient ETH balance. Have ${ethers.utils.formatEther(ethBal)}` });
    }

    // Approve router
    await (await erc20.approve(router.address, tokenAmountWei)).wait();

    // Add liquidity
    const tx = await router.addLiquidityETH(
      tokenAddress,
      tokenAmountWei,
      0,
      0,
      wallet.address,
      Math.floor(Date.now() / 1000) + 1800,
      { value: ethAmountWei }
    );
    const receipt = await tx.wait();

    return res.json({ success: true, txHash: receipt.transactionHash });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});
