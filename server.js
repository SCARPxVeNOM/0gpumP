import express from "express";
import multer from "multer";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";
import FormData from "form-data";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

import crypto from "crypto";


// Professional Database Architecture
import { databaseManager } from "./lib/databaseManager.js";
import { cacheService } from "./lib/cacheService.js";
import { dataService } from "./lib/dataService.js";

dotenv.config();
const app = express();

// Enable CORS for frontend integration
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 0G Storage API configuration
let OG_STORAGE_API ="https://zerog-storage-kit.onrender.com";

// Smart contract addresses and ABIs
const FACTORY_ADDRESS = "0x560C7439E28359E2E8C0D72A52e8b5d6645766e7";
const FACTORY_ABI = [
  "function createToken(string memory _name, string memory _symbol, string memory _description, bytes32 _metadataRootHash, bytes32 _imageRootHash) external returns (address token, address curve)",
  "event TokenCreated(address indexed token, address indexed curve, address indexed creator, uint256 timestamp, string name, string symbol, string description, bytes32 metadataRootHash, bytes32 imageRootHash)"
];

// Minimal ABI for the new bonding-curve Factory (used only for log parsing)
const NEW_FACTORY_EVENT_ABI = [
  'event PairCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint256 seedOg, uint256 seedTokens)'
];

// Temporary cache for file content hashing
const tempCache = new Map();

// -----------------------------
// Dialogue storage (walletAddress -> rootHash) persistence
// -----------------------------
const DIALOGUE_MAP_FILE = path.join(process.cwd(), 'data', 'dialogue-map.json');
let dialogueMap = new Map();

function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

const UPLOADS_CACHE_DIR = path.join(process.cwd(), 'data', 'uploads-cache');
function ensureUploadsCacheDir() {
  ensureDataDir();
  if (!fs.existsSync(UPLOADS_CACHE_DIR)) {
    fs.mkdirSync(UPLOADS_CACHE_DIR, { recursive: true });
  }
}

async function loadDialogueMap() {
  try {
    ensureDataDir();
    if (fs.existsSync(DIALOGUE_MAP_FILE)) {
      const raw = fs.readFileSync(DIALOGUE_MAP_FILE, 'utf8');
      const obj = JSON.parse(raw || '{}');
      dialogueMap = new Map(Object.entries(obj));
      console.log(`🗺️  Dialogue map loaded (${dialogueMap.size} entries)`);
    } else {
      dialogueMap = new Map();
      console.log('ℹ️  No existing dialogue map found. A new one will be created.');
    }
  } catch (e) {
    console.warn('⚠️ Failed to load dialogue map:', e?.message || e);
    dialogueMap = new Map();
  }
}

async function saveDialogueMap() {
  try {
    ensureDataDir();
    const obj = Object.fromEntries(dialogueMap);
    fs.writeFileSync(DIALOGUE_MAP_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.warn('⚠️ Failed to save dialogue map:', e?.message || e);
  }
}

// Helper: Direct POST to 0G kit upload (no retry)
import http from "http";
import https from "https";
import { Indexer, ZgFile } from "@0glabs/0g-ts-sdk";
import os from "os";

// (legacy kit proxy helper retained for compat, but no longer used in new flow)
async function postToOGStorage(url, formData, headers, timeoutMs = 60000) {
      return await axios.post(url, formData, {
        headers,
        timeout: timeoutMs,
        maxRedirects: 5,
        httpAgent: new http.Agent({ keepAlive: true }),
        httpsAgent: new https.Agent({ keepAlive: true })
      });
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

// -----------------------------
// Direct SDK (optional) uploader context
// -----------------------------
let ogIndexer = null;
let ogProvider = null;
let ogSigner = null;
let ogRpcUrl = null;
async function initializeOGSdkOnce() {
  if (ogIndexer) return;
  const RPC_URL = process.env.RPC_URL || process.env.OG_RPC || 'https://evmrpc-testnet.0g.ai';
  const INDEXER_RPC = process.env.INDEXER_RPC || 'https://indexer-storage-testnet-turbo.0g.ai';
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  try {
    ogIndexer = ogIndexer || new Indexer(INDEXER_RPC);
    // Provider is helpful for tx waits but optional for downloads
    ogProvider = ogProvider || new ethers.JsonRpcProvider(RPC_URL);
    ogRpcUrl = RPC_URL;
    if (PRIVATE_KEY) {
      ogSigner = new ethers.Wallet(PRIVATE_KEY, ogProvider);
      console.log('✅ 0G SDK context initialized (direct upload)');
    } else {
      console.log('ℹ️  0G SDK context initialized (read-only downloads)');
    }
  } catch (e) {
    console.warn('⚠️ Failed to init 0G SDK context:', e?.message || e);
  }
}

// -----------------------------
// Direct SDK helpers
// -----------------------------
async function uploadBufferDirect(buffer, filename) {
  await initializeOGSdkOnce();
  if (!ogIndexer || !ogSigner) throw new Error('0G SDK not initialized');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '0g-upload-'));
  const tempFile = path.join(tempDir, filename || `upload-${Date.now()}`);
  fs.writeFileSync(tempFile, buffer);
  try {
    const zgFile = await ZgFile.fromFilePath(tempFile);
    const [tree, treeErr] = await zgFile.merkleTree();
    if (treeErr) throw new Error(String(treeErr));
    // Submit upload with timeout fallback to avoid UI hanging
    const submitPromise = ogIndexer.upload(zgFile, ogRpcUrl, ogSigner);
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve([null, new Error('upload-timeout')]), 20000));
    const result = await Promise.race([submitPromise, timeoutPromise]);
    const [tx, uploadErr] = result;
    if (uploadErr && String(uploadErr) !== 'Error: upload-timeout') throw new Error(String(uploadErr));
    const rootHash = tree.rootHash();
    await zgFile.close();
    try { fs.unlinkSync(tempFile); fs.rmdirSync(tempDir); } catch {}
    // Save a local cache copy for immediate serving
    try {
      ensureUploadsCacheDir();
      const cachePath = path.join(UPLOADS_CACHE_DIR, rootHash);
      if (!fs.existsSync(cachePath)) {
        fs.writeFileSync(cachePath, buffer);
      }
    } catch {}
    return { rootHash, txHash: tx ? (tx.hash || tx) : null, pending: !tx };
  } catch (e) {
    try { fs.unlinkSync(tempFile); fs.rmdirSync(tempDir); } catch {}
    throw e;
  }
}

async function downloadRootToStream(rootHash, res) {
  await initializeOGSdkOnce();
  if (!ogIndexer) throw new Error('0G SDK not initialized');
  // Serve from local cache first if available
  try {
    ensureUploadsCacheDir();
    const cachePath = path.join(UPLOADS_CACHE_DIR, rootHash);
    if (fs.existsSync(cachePath)) {
      const stat = fs.statSync(cachePath);
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=31536000'
      });
      return fs.createReadStream(cachePath).pipe(res);
    }
  } catch {}
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '0g-download-'));
  const tempFile = path.join(tempDir, rootHash);
  try {
    // Try a few times in case the write just landed and not yet replicated
    let err = await ogIndexer.download(rootHash, tempFile, true);
    if (err) {
      await new Promise(r => setTimeout(r, 1500));
      err = await ogIndexer.download(rootHash, tempFile, true);
    }
    if (err) throw new Error(String(err));
    const stat = fs.statSync(tempFile);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=31536000'
    });
    const stream = fs.createReadStream(tempFile);
    stream.on('close', () => { try { fs.unlinkSync(tempFile); fs.rmdirSync(tempDir); } catch {} });
    stream.pipe(res);
  } catch (e) {
    try { fs.unlinkSync(tempFile); fs.rmdirSync(tempDir); } catch {}
    throw e;
  }
}

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * HEALTH CHECK ENDPOINT
 */
app.get("/health", async (req, res) => {
  try {
    const healthStatus = await dataService.getHealthStatus();
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: healthStatus.database,
      cache: healthStatus.cache,
      services: {
        database: "operational",
        cache: "operational",
        ogStorage: "operational"
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Render/Fly root check
app.get('/', (_req, res) => {
  res.send('0G Pump backend is running');
});

/**
 * DIALOGUE ENDPOINTS (similar to 0g_storage_service)
 */
app.get('/dialogue/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    await loadDialogueMap();
    const rootHash = dialogueMap.get(walletAddress);
    if (!rootHash) return res.status(404).json({ message: 'No dialogue history found.' });

    // Download JSON via direct SDK (temp file then return JSON)
    await initializeOGSdkOnce();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '0g-dialogue-'));
    const tempFile = path.join(tempDir, 'dialogue.json');
    const err = await ogIndexer.download(rootHash, tempFile, true);
    if (err) throw new Error(String(err));
    const content = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    try { fs.unlinkSync(tempFile); fs.rmdirSync(tempDir); } catch {}
    return res.json(content);
  } catch (e) {
    console.error('Error getting dialogue:', e?.message || e);
    return res.status(500).json({ message: 'Failed to retrieve dialogue history.' });
  }
});

app.post('/dialogue/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { newDialogue } = req.body || {};
    if (!newDialogue) return res.status(400).json({ message: "Missing 'newDialogue' in request body." });

    // Fetch existing history if any
    let existing = null;
    try {
      const rootHash = (await loadDialogueMap(), dialogueMap.get(walletAddress));
      if (rootHash) {
        await initializeOGSdkOnce();
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '0g-dialogue-'));
        const tempFile = path.join(tempDir, 'dialogue.json');
        const err = await ogIndexer.download(rootHash, tempFile, true);
        if (!err) existing = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
        try { fs.unlinkSync(tempFile); fs.rmdirSync(tempDir); } catch {}
      }
    } catch {}

    const parsed = existing && existing.dialogue_history ? existing : { dialogue_history: [] };
    const dialogueObj = typeof newDialogue === 'string' ? JSON.parse(newDialogue) : newDialogue;
    parsed.dialogue_history.push({ ...dialogueObj, timestamp: new Date().toISOString() });

    // Upload merged JSON via direct SDK
    const up = await uploadBufferDirect(Buffer.from(JSON.stringify(parsed, null, 2)), 'dialogue.json');
    const newRoot = up.rootHash;
    dialogueMap.set(walletAddress, newRoot);
    await saveDialogueMap();

    return res.status(200).json({ message: 'Dialogue saved successfully.', rootHash: newRoot });
  } catch (e) {
    console.error('Error saving dialogue:', e?.message || e);
    return res.status(500).json({ message: 'Failed to save dialogue.' });
  }
});

app.post('/dialogue/history/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const fullHistory = req.body;
    if (!fullHistory || !fullHistory.dialogue_history) {
      return res.status(400).json({ message: "Missing 'dialogue_history' object in request body." });
    }

    const up = await uploadBufferDirect(Buffer.from(JSON.stringify(fullHistory, null, 2)), 'dialogue.json');
    const newRoot = up.rootHash;
    dialogueMap.set(walletAddress, newRoot);
    await saveDialogueMap();

    return res.status(200).json({ message: 'Full dialogue history saved successfully.', rootHash: newRoot });
  } catch (e) {
    console.error('Error saving full history:', e?.message || e);
    return res.status(500).json({ message: 'Failed to save full dialogue history.' });
  }
});
/**
 * UPLOAD ENDPOINT - Enhanced with Professional Architecture
 */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
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

      // STEP 1: COMPRESSION FIRST - Ultra-aggressive compression
      console.log(`🗜️ Starting compression process...`);
      let outputBuffer = file.buffer;
      let outName = file.originalname;
      let outType = file.mimetype;
      let compressionRatio = 1.0;
      let compressionType = 'none';
      
      try {
        // Image compression removed for Render compatibility
        // Using original file without WebP conversion
        
        // STEP 2: GZIP COMPRESSION - For all files
        if (outputBuffer.length > 1024) {
          console.log(`🗜️ Applying Gzip compression...`);
          const { gzip } = await import('zlib');
          const { promisify } = await import('util');
          const gzipAsync = promisify(gzip);
          
          try {
            const gzipped = await gzipAsync(outputBuffer, { 
              level: 9,
              memLevel: 9,
              strategy: (await import('zlib')).constants.Z_HUFFMAN_ONLY
            });
            if (gzipped.length < outputBuffer.length) {
              const beforeGzip = outputBuffer.length;
              outputBuffer = gzipped;
              outName = outName + '.gz';
              outType = 'application/gzip';
              const gzipRatio = gzipped.length / beforeGzip;
              console.log(`✅ Gzip compression: ${beforeGzip}B → ${gzipped.length}B (${Math.round((1 - gzipRatio) * 100)}% reduction)`);
            }
          } catch (gzipError) {
            console.warn('Gzip compression failed:', gzipError.message);
          }
        }
        
        console.log(`🎯 Final compression result: ${file.size}B → ${outputBuffer.length}B (${Math.round((1 - outputBuffer.length/file.size) * 100)}% total reduction)`);
        
      } catch (e) {
        console.warn('Compression failed, using original:', e?.message || e);
      }

      // Direct SDK upload
      console.log(`🚀 Uploading via 0G SDK...`);
      const { rootHash } = await uploadBufferDirect(outputBuffer, outName);
      console.log(`✅ Direct upload successful: ${rootHash}`);
      
      // Cache the file content hash for future reuse
      tempCache.set(fileContentHash, {
        rootHash,
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

      // Track file in database using professional architecture
      try {
        await dataService.trackOGStorageFile({
          rootHash,
          fileName: outName,
          fileType: outType,
          originalSize: file.size,
          compressedSize: outputBuffer.length,
          compressionRatio: compressionRatio,
          compressionType: compressionType,
          metadata: {
            originalName: file.originalname,
            originalType: file.mimetype,
            compressionApplied: compressionType !== 'none'
          }
        });
      } catch (dbError) {
        console.warn("⚠️ Database tracking failed, but continuing:", dbError.message);
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

      console.log(`📤 Direct JSON upload via 0G SDK`);
      const { rootHash } = await uploadBufferDirect(Buffer.from(JSON.stringify(data)), 'metadata.json');
      
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
    res.status(500).json({ error: err.message || "Upload failed" });
  }
});

// ---------------------------------
// Direct SDK image upload (coin image, etc.)
// POST /upload-image-direct (multipart 'file')
// Returns: { success, rootHash, txHash }
// ---------------------------------
app.post('/upload-image-direct', upload.single('file'), async (req, res) => {
  try {
    await initializeOGSdkOnce();
    if (!ogIndexer || !ogSigner) {
      return res.status(503).json({ success: false, error: 'Direct SDK upload not configured' });
    }
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'No file provided' });

    // Write temp file
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '0g-upload-'));
    const tempFile = path.join(tempDir, file.originalname || `upload-${Date.now()}`);
    fs.writeFileSync(tempFile, file.buffer);

    try {
      const zgFile = await ZgFile.fromFilePath(tempFile);
      const [tree, treeErr] = await zgFile.merkleTree();
      if (treeErr) throw new Error(`Merkle tree failed: ${treeErr}`);
      const [tx, uploadErr] = await ogIndexer.upload(zgFile, ogProvider.connection.url || '', ogSigner);
      if (uploadErr) throw new Error(String(uploadErr));
      const rootHash = tree.rootHash();
      await zgFile.close();
      try { fs.unlinkSync(tempFile); fs.rmdirSync(tempDir); } catch {}
      return res.json({ success: true, rootHash, txHash: tx.hash || tx });
    } catch (e) {
      try { fs.unlinkSync(tempFile); fs.rmdirSync(tempDir); } catch {}
      throw e;
    }
  } catch (e) {
    console.error('Direct SDK upload error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Upload failed' });
  }
});

/**
 * DOWNLOAD ENDPOINT
 */
app.get("/download/:rootHash", async (req, res) => {
  try {
    const { rootHash } = req.params;
    if (!rootHash || rootHash.length !== 66 || !rootHash.startsWith('0x')) {
      return res.status(400).json({ error: "Invalid root hash format" });
    }
    console.log(`📥 Downloading file: ${rootHash}`);
    await dataService.updateFileAccess(rootHash);
    await downloadRootToStream(rootHash, res);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "Download failed" });
  }
});

/**
 * CREATE COIN ENDPOINT - Enhanced with Professional Architecture
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
    let outputBuffer = null;
    let imageFileSize = 0;
    
    // Upload image to 0G Storage if provided
    if (imageFile) {
      console.log(`📤 Received coin image: ${imageFile.originalname} (${imageFile.size} bytes)`);
      
      // Use the same compression logic as the upload endpoint
      outputBuffer = imageFile.buffer;
      imageFileSize = imageFile.size;
      let outName = imageFile.originalname;
      let outType = imageFile.mimetype;
      
      // WebP compression removed for Render compatibility
      // Using original image without compression
      
      // Upload via 0G SDK
      const up = await uploadBufferDirect(outputBuffer, outName);
      imageRootHash = up.rootHash;
      
      console.log(`✅ Coin image uploaded: ${imageRootHash}`);
    } else if (imageRootHashFromBody) {
      imageRootHash = imageRootHashFromBody;
      console.log(`📎 Using provided image hash: ${imageRootHash}`);
    }

    // Create coin data object
    const coinData = {
      id: `${symbol.toLowerCase()}_${Date.now()}`,
      name,
      symbol,
      supply,
      decimals: 18,
      description,
      creator: creator.toLowerCase(),
      imageHash: imageRootHash,
      imageUrl: imageRootHash ? `/download/${imageRootHash}` : null,
      metadataHash: null,
      metadataUrl: null,
      imageCompressionRatio: imageFile && imageFileSize > 0 ? (outputBuffer.length / imageFileSize) : null,
      imageOriginalSize: imageFileSize,
      imageCompressedSize: outputBuffer ? outputBuffer.length : null,
      tokenAddress: tokenAddress || null,
      curveAddress: curveAddress || null,
      txHash: txHash || `local-${Date.now()}`,
      blockNumber: null,
      gasUsed: null,
      gasPrice: null,
      telegramUrl: telegramUrl || null,
      xUrl: xUrl || null,
      discordUrl: discordUrl || null,
      websiteUrl: websiteUrl || null,
      marketCap: 0,
      price: 0,
      volume24h: 0,
      change24h: 0,
      holders: 0,
      totalTransactions: 0,
      liquidity: 0
    };

    // Save coin using professional data service
    await dataService.upsertCoin(coinData);

    console.log(`✅ Coin created successfully: ${name} (${symbol})`);

    res.json({
      success: true,
      coin: coinData
    });

  } catch (error) {
    console.error("Create coin error:", error);
    res.status(500).json({ error: error.message || "Failed to create coin" });
  }
});

/**
 * GET COINS ENDPOINT - Enhanced with Caching
 */
app.get("/coins", async (req, res) => {
  try {
    const { limit = 50, offset = 0, sortBy = 'marketCap', order = 'DESC' } = req.query;
    
    // Get coins using professional data service with caching
    const coins = await dataService.getCoins(
      parseInt(limit), 
      parseInt(offset), 
      sortBy, 
      order
    );

    // Add cache-busting headers to prevent frontend caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      coins,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: coins.length
      },
      timestamp: new Date().toISOString() // Add timestamp to help with cache busting
    });

  } catch (error) {
    console.error("Get coins error:", error);
    res.status(500).json({ error: "Failed to get coins" });
  }
});

/**
 * GET COIN BY ID ENDPOINT - Enhanced with Caching
 */
app.get("/coins/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get coin using professional data service with caching
    const coin = await dataService.getCoin(id);

    if (!coin) {
      return res.status(404).json({ error: "Coin not found" });
    }

    res.json({
      success: true,
      coin
    });

  } catch (error) {
    console.error("Get coin error:", error);
    res.status(500).json({ error: "Failed to get coin" });
  }
});

/**
 * USER PROFILE ENDPOINTS - Enhanced with Professional Architecture
 */

// 0G Storage functions for profile persistence with fallback
async function saveProfileToOGStorage(walletAddress, profileData) {
  try {
    console.log(`💾 Saving profile to 0G Storage for ${walletAddress}`);
    
    const profileKey = `profile_${walletAddress.toLowerCase()}.json`;
    
    const formData = new FormData();
    formData.append('file', Buffer.from(JSON.stringify(profileData)), { 
      filename: profileKey, 
      contentType: 'application/json' 
    });
    
    const response = await postToOGStorage(`${OG_STORAGE_API}/upload`, formData, formData.getHeaders());
    const rootHash = response.data.rootHash;
    
    console.log(`✅ Profile saved to 0G Storage: ${rootHash}`);
    
    // Store the mapping in database for quick retrieval
    await dataService.updateUserProfile(walletAddress, { profileHash: rootHash });
    
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
    
    const profilesDir = path.join(process.cwd(), 'data', 'profiles');
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
    }
    
    const profileFile = path.join(profilesDir, `${walletAddress.toLowerCase()}.json`);
    fs.writeFileSync(profileFile, JSON.stringify(profileData, null, 2));
    
    console.log(`✅ Profile saved to local file: ${profileFile}`);
    
    await dataService.updateUserProfile(walletAddress, { profileHash: `local:${profileFile}` });
    
    return `local:${profileFile}`;
  } catch (error) {
    console.error('Failed to save profile to local file:', error);
    throw error;
  }
}

async function getProfileFromOGStorage(walletAddress) {
  try {
    console.log(`📥 Loading profile for ${walletAddress}`);
    
    // Get profile from database using professional data service
    const profileRow = await dataService.getUserProfile(walletAddress);
    
    if (!profileRow) {
      console.log(`📭 No profile found for ${walletAddress}`);
      return null;
    }
    
    const profileHash = profileRow.profileHash;
    
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
    
    // If it's a 500 error with "Wrong path" or "file does not exist", the hash is corrupted
    if (error.response && error.response.status === 500 && 
        error.response.data && error.response.data.error && 
        (error.response.data.error.includes('Wrong path') || 
         error.response.data.error.includes('does not exist'))) {
      console.log(`🗑️ Detected corrupted profile hash: ${profileHash}`);
      return null; // This will trigger the fallback to create a new profile
    }
    
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

// Load profile from database (primary storage)
async function getProfileFromDatabase(walletAddress) {
  try {
    const profileRow = await dataService.getUserProfile(walletAddress);
    
    if (!profileRow) {
      return null;
    }
    
    // Check if we have profileData (new hybrid approach)
    if (profileRow.profileData) {
      const profileData = JSON.parse(profileRow.profileData);
      console.log(`✅ Profile loaded from database for ${walletAddress}`);
      return profileData;
    }
    
    // Fallback to old approach (profileHash)
    if (profileRow.profileHash) {
      console.log(`🔄 Falling back to 0G Storage for ${walletAddress}`);
      return await getProfileFromOGStorageHash(profileRow.profileHash);
    }
    
    return null;
  } catch (error) {
    console.error('Failed to load profile from database:', error);
    return null;
  }
}

// Save profile to database (primary storage)
async function saveProfileToDatabase(walletAddress, profileData) {
  try {
    await dataService.updateUserProfile(walletAddress, profileData);
    console.log(`✅ Profile saved to database for ${walletAddress}`);
  } catch (error) {
    console.error('Failed to save profile to database:', error);
    throw error;
  }
}

// Save profile to 0G Storage in background (proof of history)
async function saveProfileToOGStorageBackground(walletAddress, profileData) {
  // Run in background without blocking
  setImmediate(async () => {
    try {
      await saveProfileToOGStorage(walletAddress, profileData);
      console.log(`✅ Profile backed up to 0G Storage for ${walletAddress}`);
    } catch (error) {
      console.warn(`⚠️ Failed to backup profile to 0G Storage for ${walletAddress}:`, error.message);
      // Don't throw - this is just a backup
    }
  });
}

// Get user profile
app.get("/profile/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    console.log(`📥 Loading profile for ${walletAddress} (database first)`);

    // Try to get profile from database first (fast and reliable)
    let profile = await getProfileFromDatabase(walletAddress);
    
    if (!profile) {
      console.log(`📭 No profile found in database for ${walletAddress}, creating new one`);
      
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
      
      // Save new profile to database
      await saveProfileToDatabase(walletAddress, profile);
      
      // Optionally save to 0G Storage in background (for proof of history)
      saveProfileToOGStorageBackground(walletAddress, profile);
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
    const profileData = req.body;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    // Get existing profile from database or create new one
    let existingProfile = await getProfileFromDatabase(walletAddress);
    
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
      ...profileData,
      walletAddress: walletAddress.toLowerCase(), // Ensure lowercase
      updatedAt: new Date().toISOString(),
      // Preserve existing data if not provided
      tokensCreated: profileData.tokensCreated || existingProfile.tokensCreated,
      tradingStats: profileData.tradingStats || existingProfile.tradingStats,
      preferences: {
        ...existingProfile.preferences,
        ...profileData.preferences
      }
    };
    
    // Save updated profile to database (primary storage)
    try {
      await saveProfileToDatabase(walletAddress, updatedProfile);
      console.log(`✅ Profile updated and saved to database for ${walletAddress}:`, {
        username: updatedProfile.username,
        bio: updatedProfile.bio
      });
      
      // Backup to 0G Storage in background (proof of history)
      saveProfileToOGStorageBackground(walletAddress, updatedProfile);
    } catch (saveError) {
      console.error('Failed to save updated profile to database:', saveError);
      return res.status(500).json({ error: "Failed to save profile to database" });
    }

    res.json({ success: true, profile: updatedProfile });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Add created token to user profile
app.post("/profile/:walletAddress/tokens", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { tokenAddress, tokenName, tokenSymbol, curveAddress, txHash, imageUrl, description } = req.body;
    
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    // Get existing profile
    let profile = await getProfileFromOGStorage(walletAddress);
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Add token to created tokens list
    const newToken = {
      tokenAddress,
      tokenName,
      tokenSymbol,
      curveAddress,
      createdAt: new Date().toISOString(),
      txHash,
      imageUrl,
      description
    };

    profile.tokensCreated.push(newToken);
    profile.updatedAt = new Date().toISOString();

    // Save updated profile
    await saveProfileToOGStorage(walletAddress, profile);

    res.json({ success: true, profile });
  } catch (error) {
    console.error("Add token to profile error:", error);
    res.status(500).json({ error: "Failed to add token to profile" });
  }
});

// Helper function to compress file
async function compressFile(file) {
  console.log(`🗜️ Starting compression process for avatar...`);
  let outputBuffer = file.buffer;
  let outName = file.originalname;
  let outType = file.mimetype;
  let compressionRatio = 1.0;
  let compressionType = 'none';
  
  try {
    // WebP compression removed for Render compatibility
    // Using original image without compression

    // STEP 2: GZIP COMPRESSION - For all files
    if (outputBuffer.length > 1024) {
      console.log(`🗜️ Applying Gzip compression...`);
      const { gzip } = await import('zlib');
      const { promisify } = await import('util');
      const gzipAsync = promisify(gzip);
      
      try {
        const beforeGzip = outputBuffer.length;
        const gzipped = await gzipAsync(outputBuffer);
        
        const { constants } = await import('zlib');
        if (gzipped.length < outputBuffer.length) {
          outputBuffer = gzipped;
          outName = outName + '.gz';
          outType = 'application/gzip';
          const gzipRatio = gzipped.length / beforeGzip;
          console.log(`✅ Gzip compression: ${beforeGzip}B → ${gzipped.length}B (${Math.round((1 - gzipRatio) * 100)}% reduction)`);
        }
      } catch (gzipError) {
        console.warn('Gzip compression failed:', gzipError.message);
      }
    }
    
    console.log(`🎯 Final compression result: ${file.size}B → ${outputBuffer.length}B (${Math.round((1 - outputBuffer.length/file.size) * 100)}% total reduction)`);
    
  } catch (e) {
    console.warn('Compression failed, using original file:', e?.message || e);
  }

      return {
    outputBuffer,
    outName,
    outType,
    compressionRatio,
    compressionType
  };
}

// Helper function to upload file to 0G Storage
async function uploadFileToOGStorage(file) {
  try {
    // Compress the file
    const { outputBuffer, outName, outType, compressionRatio, compressionType } = await compressFile(file);
    
    // Upload to 0G Storage
      console.log(`🚀 Uploading avatar via 0G SDK...`);
      const up = await uploadBufferDirect(outputBuffer, outName);
      const rootHash = up.rootHash;
    
    console.log(`✅ Avatar upload successful: ${rootHash}`);
    
    return {
      success: true,
      url: `/download/${rootHash}`,
      rootHash: rootHash,
      compression: {
        originalSize: file.size,
        compressedSize: outputBuffer.length,
        ratio: compressionRatio,
        compressionType: compressionType
      }
    };
  } catch (error) {
    console.error("❌ Avatar upload to 0G Storage failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Upload user avatar
app.post("/profile/:walletAddress/avatar", upload.single('avatar'), async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ 
        success: false,
        error: "Invalid wallet address" 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: "No avatar file provided" 
      });
    }

    console.log(`📤 Avatar upload attempt for ${walletAddress}: ${req.file.originalname} (${req.file.size} bytes)`);

    // Upload to 0G Storage
    const uploadResult = await uploadFileToOGStorage(req.file);
    
    if (uploadResult.success) {
      // Update profile with new avatar URL
      const profile = await getProfileFromDatabase(walletAddress);
      if (profile) {
        profile.avatarUrl = uploadResult.url;
        profile.updatedAt = new Date().toISOString();
        await saveProfileToDatabase(walletAddress, profile);
        console.log(`✅ Avatar updated in profile for ${walletAddress}`);
        
        // Backup to 0G Storage in background
        saveProfileToOGStorageBackground(walletAddress, profile);
      }
    
    res.json({
        success: true,
        avatarUrl: uploadResult.url,
        message: "Avatar uploaded successfully",
        compression: uploadResult.compression
      });
    } else {
      console.error(`❌ Avatar upload failed for ${walletAddress}:`, uploadResult.error);
      res.status(500).json({
        success: false,
        error: uploadResult.error || "Failed to upload avatar to 0G Storage"
      });
    }
  } catch (error) {
    console.error("❌ Avatar upload error:", error);
    res.status(500).json({ 
      success: false,
      error: `Avatar upload failed: ${error.message}` 
    });
  }
});

// Update user trading stats
app.put("/profile/:walletAddress/stats", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { totalTrades, totalVolume, tokensHeld, lastTradeAt } = req.body;
    
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    // Get existing profile
    let profile = await getProfileFromOGStorage(walletAddress);
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Update trading stats
    profile.tradingStats = {
      ...profile.tradingStats,
      totalTrades: totalTrades || profile.tradingStats.totalTrades,
      totalVolume: totalVolume || profile.tradingStats.totalVolume,
      tokensHeld: tokensHeld || profile.tradingStats.tokensHeld,
      lastTradeAt: lastTradeAt || profile.tradingStats.lastTradeAt
    };
    profile.updatedAt = new Date().toISOString();

    // Save updated profile
    await saveProfileToOGStorage(walletAddress, profile);

    res.json({ success: true, profile });
  } catch (error) {
    console.error("Update trading stats error:", error);
    res.status(500).json({ error: "Failed to update trading stats" });
  }
});

/**
 * MARKET DATA ENDPOINTS - Enhanced with Caching
 */
app.get("/market/stats", async (req, res) => {
  try {
    const stats = await dataService.getMarketStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error("Get market stats error:", error);
    res.status(500).json({ error: "Failed to get market stats" });
  }
});

/**
 * TRADING HISTORY ENDPOINTS
 */
app.get("/trading/history/:userAddress", async (req, res) => {
  try {
    const { userAddress } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const history = await dataService.getUserTradingHistory(
      userAddress, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.json({ success: true, history });
  } catch (error) {
    console.error("Get trading history error:", error);
    res.status(500).json({ error: "Failed to get trading history" });
  }
});

app.get("/trading/coin/:coinId", async (req, res) => {
  try {
    const { coinId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const history = await dataService.getCoinTradingHistory(
      coinId, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.json({ success: true, history });
  } catch (error) {
    console.error("Get coin trading history error:", error);
    res.status(500).json({ error: "Failed to get coin trading history" });
  }
});

/**
 * CACHE MANAGEMENT ENDPOINTS
 */
app.get("/cache/stats", async (req, res) => {
  try {
    const stats = await cacheService.getCacheStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error("Get cache stats error:", error);
    res.status(500).json({ error: "Failed to get cache stats" });
  }
});

app.post("/cache/clear", async (req, res) => {
  try {
    const cleared = await cacheService.clearAllCache();
    res.json({ success: cleared, message: "Cache cleared successfully" });
  } catch (error) {
    console.error("Clear cache error:", error);
    res.status(500).json({ error: "Failed to clear cache" });
  }
});

app.post('/resolvePair', async (req, res) => {
  try {
    const { txHash, creator, factory } = req.body || {}
    if (!txHash || !creator || !factory) {
      return res.status(400).json({ success: false, error: 'txHash, creator, factory are required' })
    }

    const rpcUrl = process.env.RPC_URL || process.env.OG_TESTNET_RPC || 'https://evmrpc-testnet.0g.ai'
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    // Fetch receipt for block number hint
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) {
      return res.status(404).json({ success: false, error: 'Transaction receipt not found' })
    }

    const iface = new ethers.Interface(NEW_FACTORY_EVENT_ABI)
    const topic0 = iface.getEvent('PairCreated').topicHash

    const fromBlock = Math.max(0, (receipt.blockNumber || 0) - 20)
    const toBlock = (receipt.blockNumber || 0) + 10

    const logs = await provider.getLogs({
      fromBlock,
      toBlock,
      address: factory,
      topics: [topic0]
    })

    let tokenAddr = null
    let curveAddr = null

    for (const log of logs) {
      try {
        const parsed = iface.parseLog(log)
        if (parsed.name === 'PairCreated' && String(parsed.args[2]).toLowerCase() === String(creator).toLowerCase()) {
          tokenAddr = parsed.args[0]
          curveAddr = parsed.args[1]
          break
        }
      } catch {}
    }

    // If not found, fallback to wider range
    if (!tokenAddr || !curveAddr) {
      const current = await provider.getBlockNumber()
      const widerFrom = Math.max(0, current - 10000)
      const wider = await provider.getLogs({ fromBlock: widerFrom, toBlock: current, address: factory, topics: [topic0] })
      for (const log of wider.reverse()) {
        try {
          const parsed = iface.parseLog(log)
          if (parsed.name === 'PairCreated' && String(parsed.args[2]).toLowerCase() === String(creator).toLowerCase()) {
            tokenAddr = parsed.args[0]
            curveAddr = parsed.args[1]
            break
          }
        } catch {}
      }
    }

    if (!tokenAddr || !curveAddr) {
      return res.status(404).json({ success: false, error: 'PairCreated not found for creator in queried range' })
    }

    // Persist to DB if we have a coin row with this tx or creator+symbol
    try {
      await dataService.initialize()
      const db = await databaseManager.getConnection()
      // Update the most recent coin by this creator with empty curveAddress
      await db.run(
        `UPDATE coins SET tokenAddress = COALESCE(tokenAddress, ?), curveAddress = ?, updatedAt = ?
         WHERE creator = ? AND (curveAddress IS NULL OR curveAddress = '')
         ORDER BY createdAt DESC LIMIT 1`,
        [tokenAddr, curveAddr, Date.now(), String(creator).toLowerCase()]
      )
    } catch (e) {
      console.warn('DB update skipped:', e?.message || e)
    }

    return res.json({ success: true, tokenAddress: tokenAddr, curveAddress: curveAddr, txHash })
  } catch (e) {
    console.error('resolvePair error:', e)
    return res.status(500).json({ success: false, error: e?.message || 'resolvePair failed' })
  }
})

/**
 * START SERVER
 */
const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // Initialize professional database architecture
    await initializeDatabase();
    
    // Start the server
app.listen(PORT, () => {
      console.log(`🚀 Professional 0G Storage Integration Server running on http://localhost:${PORT}`);
  console.log(`📤 Upload endpoint: POST /upload`);
  console.log(`📥 Download endpoint: GET /download/:rootHash`);
  console.log(`🪙 Create coin: POST /createCoin`);
  console.log(`🗣️ Dialogue endpoints: GET/POST /dialogue/:walletAddress, POST /dialogue/history/:walletAddress`);
  console.log(`🖼️ Direct SDK image upload: POST /upload-image-direct`);
  console.log(`🔎 Resolve new pair: POST /resolvePair`);
      console.log(`👤 Profile endpoints: GET/PUT /profile/:walletAddress`);
      console.log(`📊 Market data: GET /market/stats`);
  console.log(`💚 Health check: GET /health`);
  console.log(`🔗 0G Storage API: ${OG_STORAGE_API}`);
      console.log(`⚡ Redis caching: Enabled with fallback`);
      console.log(`🗄️ SQLite database: Optimized with connection pooling`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server gracefully...');
  await dataService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server gracefully...');
  await dataService.close();
  process.exit(0);
});

// Start the server
startServer();
