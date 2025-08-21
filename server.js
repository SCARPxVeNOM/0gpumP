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
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import crypto from "crypto";

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

// Persistent upload queue (processed in background)
const UPLOAD_QUEUE_PATH = path.join(CACHE_DIR, "pending-uploads.json");

function readUploadQueue() {
  try {
    const raw = fs.readFileSync(UPLOAD_QUEUE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeUploadQueue(queue) {
  try {
    fs.writeFileSync(UPLOAD_QUEUE_PATH, JSON.stringify(queue, null, 2));
  } catch {}
}

function enqueueUpload(job, delayMs = 0) {
  const q = readUploadQueue();
  q.push({ ...job, attempts: 0, nextAttemptAt: Date.now() + Math.max(0, delayMs) });
  writeUploadQueue(q);
}

async function updateCoinImageHash(coinId, imageRootHash) {
  const db = await getDatabase();
  try {
    await db.run(`UPDATE coins SET imageHash = ? WHERE id = ?`, [imageRootHash, coinId]);
  } finally {
    await db.close();
  }
}

async function processUploadQueue() {
  const queue = readUploadQueue();
  let changed = false;
  const now = Date.now();
  const remaining = [];
  for (const job of queue) {
    if (now < job.nextAttemptAt) {
      remaining.push(job);
      continue;
    }
    try {
      const buffer = fs.readFileSync(job.filePath);
      const formData = new FormData();
      formData.append('file', buffer, { filename: job.filename, contentType: job.contentType });
      const resp = await postWithRetry(`${OG_STORAGE_API}/upload`, formData, formData.getHeaders());
      const rootHash = resp.data.rootHash;
      writeDiskCache(rootHash, buffer, { name: job.filename, type: job.contentType, size: buffer.length, createdAt: Date.now() });
      if (job.kind === 'image' && job.coinId) {
        await updateCoinImageHash(job.coinId, rootHash);
      }
      // Cleanup temp file
      try { fs.unlinkSync(job.filePath); } catch {}
      changed = true;
    } catch (e) {
      const attempts = (job.attempts || 0) + 1;
      const backoff = Math.min(60_000, 1000 * Math.pow(2, attempts));
      remaining.push({ ...job, attempts, nextAttemptAt: Date.now() + backoff });
      changed = true;
    }
  }
  if (changed) writeUploadQueue(remaining);
}

// Background worker interval
setInterval(processUploadQueue, 15_000);

// Helper: POST with retry/backoff for 0G kit upload
import http from "http";
import https from "https";

async function postWithRetry(url, formData, headers, maxRetries = 3, timeoutMs = 15000) {
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
         msg.includes('429'))
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

async function getDatabase() {
  await ensureDataDir();
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS coins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      supply TEXT NOT NULL,
      imageHash TEXT,
      tokenAddress TEXT,
      txHash TEXT NOT NULL,
      creator TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      description TEXT,
      telegramUrl TEXT,
      xUrl TEXT,
      discordUrl TEXT,
      websiteUrl TEXT,
      marketCap REAL,
      price REAL,
      volume24h REAL,
      holders INTEGER,
      totalTransactions INTEGER
    );
  `);
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_coins_created_at ON coins(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_coins_symbol ON coins(symbol);
    CREATE INDEX IF NOT EXISTS idx_coins_creator ON coins(creator);
  `);
  return db;
}

async function insertCoinIfMissing(coin) {
  const db = await getDatabase();
  try {
    const existing = await db.get(`SELECT id FROM coins WHERE txHash = ? OR tokenAddress = ?`, [coin.txHash, coin.tokenAddress || null]);
    if (existing) return false;
    await db.run(
      `INSERT INTO coins (
        id, name, symbol, supply, imageHash, tokenAddress, txHash,
        creator, createdAt, description, telegramUrl, xUrl, discordUrl, websiteUrl,
        marketCap, price, volume24h, holders, totalTransactions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        coin.id, coin.name, coin.symbol, coin.supply,
        coin.imageHash || null, coin.tokenAddress || null, coin.txHash,
        coin.creator, coin.createdAt, coin.description || null,
        null, null, null, null,
        null, null, null, null, null
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

      console.log(`Uploading file to 0G Storage: ${file.originalname} (${file.size} bytes)`);

      // Compress to WebP (~75 quality) to reduce chunk count
      let outputBuffer = file.buffer;
      let outName = file.originalname;
      let outType = file.mimetype;
      try {
        const webp = await sharp(file.buffer).webp({ quality: 75 }).toBuffer({ resolveWithObject: true });
        outputBuffer = webp.data;
        outName = file.originalname.replace(/\.[^.]+$/i, '') + '.webp';
        outType = 'image/webp';
        console.log(`Compressed ${file.size}B → ${outputBuffer.length}B (webp)`);
      } catch (e) {
        console.warn('Image compression skipped:', e?.message || e);
      }

      // Create FormData for 0G Storage API
      const formData = new FormData();
      formData.append('file', outputBuffer, { filename: outName, contentType: outType });

      // Upload to 0G Storage with retry
      try {
        const ogResponse = await postWithRetry(`${OG_STORAGE_API}/upload`, formData, formData.getHeaders());
        const { rootHash } = ogResponse.data;

        // Cache the freshly uploaded content for instant download
        const meta = {
          name: outName,
          type: outType,
          size: outputBuffer.length,
          createdAt: Date.now(),
        };
        tempCache.set(rootHash, { buffer: outputBuffer, ...meta });
        writeDiskCache(rootHash, outputBuffer, meta);
        console.log(`✅ File uploaded to 0G Storage with rootHash: ${rootHash} (cached for instant access)`);
      
      res.json({ 
          rootHash: rootHash,
          name: outName,
          size: outputBuffer.length,
          type: outType,
          storageType: '0g-storage'
        });
      } catch (e) {
        const status = 503;
        console.error('Upload proxy error (file) → 0G kit:', e.response?.data || e.message);
        return res.status(status).json({ error: '0g_unavailable', message: '0G storage is busy. Please try again in a moment.' });
      }
    } else {
      // Handle JSON data upload to 0G Storage
      const { data } = req.body;
      
      if (!data) {
        return res.status(400).json({ error: "No data provided" });
      }

      console.log(`Uploading JSON data to 0G Storage`);

      // Create a file-like object for JSON data
      const formData = new FormData();
      formData.append('file', Buffer.from(JSON.stringify(data)), { filename: 'metadata.json', contentType: 'application/json' });

      // Upload to 0G Storage with retry
      try {
        const ogResponse = await postWithRetry(`${OG_STORAGE_API}/upload`, formData, formData.getHeaders());
        const { rootHash } = ogResponse.data;
        console.log(`✅ JSON data uploaded to 0G Storage with rootHash: ${rootHash}`);
      
      res.json({ 
          rootHash: rootHash,
          type: 'application/json',
          storageType: '0g-storage'
        });
      } catch (e) {
        const status = 503;
        console.error('Upload proxy error (json) → 0G kit:', e.response?.data || e.message);
        return res.status(status).json({ error: '0g_unavailable', message: '0G storage is busy. Please try again in a moment.' });
      }
    }
    
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message || "Upload failed" });
  }
});

/**
 * Transparent 1x1 PNG placeholder
 */
const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  "base64"
);

/**
 * Download file or JSON data from 0G Storage with cache + warm-up
 */
app.get("/download/:rootHash", async (req, res) => {
  try {
    const { rootHash } = req.params;
    console.log(`Downloading data from 0G Storage with rootHash: ${rootHash}`);

    // 1) Serve immediately from memory cache
    const cached = tempCache.get(rootHash);
    if (cached) {
      res.set({
        "Content-Type": cached.type,
        "Content-Length": cached.size,
        "Content-Disposition": `inline; filename="${cached.name}"`,
        "Cache-Control": "public, max-age=60"
      });
      return res.send(cached.buffer);
    }

    // 2) Serve from disk cache
    const disk = readDiskCache(rootHash);
    if (disk) {
      res.set({
        "Content-Type": disk.type || 'application/octet-stream',
        "Content-Length": disk.size || disk.buffer.length,
        "Content-Disposition": `inline; filename="${disk.name || rootHash}"`,
        "Cache-Control": "public, max-age=3600"
      });
      return res.send(disk.buffer);
    }

    // 3) Try to pull from the 0G kit with retry/backoff
    let lastErr = null;
    for (let i = 0; i < 3; i++) {
      try {
        const ogResponse = await axios.get(`${OG_STORAGE_API}/download/${rootHash}`, { responseType: 'arraybuffer' });
        const contentType = ogResponse.headers['content-type'] || 'application/octet-stream';
        const buffer = Buffer.from(ogResponse.data);
        const meta = { name: rootHash, type: contentType, size: buffer.length, createdAt: Date.now() };
        tempCache.set(rootHash, { buffer, ...meta });
        writeDiskCache(rootHash, buffer, meta);
        res.set({ "Content-Type": contentType, "Content-Length": buffer.length, "Cache-Control": "public, max-age=31536000" });
        return res.send(buffer);
      } catch (e) {
        lastErr = e;
        await sleep(500 * Math.pow(2, i));
      }
    }

    console.warn("Kit still warming/failed for", rootHash, lastErr?.message || lastErr?.toString?.());
    // 202 warm-up placeholder
    res.status(202).set({ "Content-Type": "image/png", "Cache-Control": "no-store" }).send(PLACEHOLDER_PNG);

    // Background warm attempt (detached)
    (async () => {
      try {
        const ogResponse = await axios.get(`${OG_STORAGE_API}/download/${rootHash}`, { responseType: 'arraybuffer' });
        const contentType = ogResponse.headers['content-type'] || 'application/octet-stream';
        const buffer = Buffer.from(ogResponse.data);
        const meta = { name: rootHash, type: contentType, size: buffer.length, createdAt: Date.now() };
        tempCache.set(rootHash, { buffer, ...meta });
        writeDiskCache(rootHash, buffer, meta);
      } catch {}
    })();
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
    const { name, symbol, description, supply, creator, imageRootHash: imageRootHashFromBody, telegramUrl, xUrl, discordUrl, websiteUrl } = req.body;
    const imageFile = req.file;

    if (!name || !symbol || !description || !supply || !creator) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log(`Creating coin: ${name} (${symbol})`);

    let imageRootHash = null;
    let pendingStorage = false;
    const ENABLE_UPLOADS_ON_CREATE = (process.env.ENABLE_0G_UPLOADS_ON_CREATE ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')) === 'true';
    
    // Upload image to 0G Storage if provided
    if (imageFile) {
      console.log(`Uploading coin image to 0G Storage: ${imageFile.originalname}`);
      
      // Compress to WebP before upload
      let outputBuffer = imageFile.buffer;
      let outName = imageFile.originalname;
      let outType = imageFile.mimetype;
      try {
        const webp = await sharp(imageFile.buffer).webp({ quality: 75 }).toBuffer({ resolveWithObject: true });
        outputBuffer = webp.data;
        outName = imageFile.originalname.replace(/\.[^.]+$/i, '') + '.webp';
        outType = 'image/webp';
        console.log(`Compressed ${imageFile.size}B → ${outputBuffer.length}B (webp)`);
      } catch (e) {
        console.warn('Image compression skipped:', e?.message || e);
      }
      
      if (ENABLE_UPLOADS_ON_CREATE) {
        try {
          const formData = new FormData();
          formData.append('file', outputBuffer, { filename: outName, contentType: outType });
          const imgResponse = await postWithRetry(`${OG_STORAGE_API}/upload`, formData, formData.getHeaders());
          imageRootHash = imgResponse.data.rootHash;
          const meta = { name: outName, type: outType, size: outputBuffer.length, createdAt: Date.now() };
          tempCache.set(imageRootHash, { buffer: outputBuffer, ...meta });
          writeDiskCache(imageRootHash, outputBuffer, meta);
          console.log(`✅ Image uploaded with rootHash: ${imageRootHash} (cached)`);
        } catch (e) {
          console.warn('Image upload deferred:', e?.message || e);
          pendingStorage = true;
          // Persist file to disk and enqueue background job
          const tmpName = `img-${Date.now()}-${Math.random().toString(16).slice(2)}.webp`;
          const tmpPath = path.join(CACHE_DIR, tmpName);
          try { fs.writeFileSync(tmpPath, outputBuffer); } catch {}
          enqueueUpload({ kind: 'image', filename: outName, contentType: outType, filePath: tmpPath, coinId: `${symbol.toLowerCase()}-${Date.now()}` });
        }
      } else {
        console.log('Skipping 0G image upload on create (dev or disabled)');
        pendingStorage = true;
        // Save file to disk and enqueue
        const tmpName = `img-${Date.now()}-${Math.random().toString(16).slice(2)}.webp`;
        const tmpPath = path.join(CACHE_DIR, tmpName);
        try { fs.writeFileSync(tmpPath, outputBuffer); } catch {}
        enqueueUpload({ kind: 'image', filename: outName, contentType: outType, filePath: tmpPath });
      }
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

    // Upload metadata to 0G Storage with retry
    let metadataRootHash = null;
    if (ENABLE_UPLOADS_ON_CREATE) {
      try {
        console.log(`Uploading coin metadata to 0G Storage`);
        const metadataFormData = new FormData();
        metadataFormData.append('file', Buffer.from(JSON.stringify(metadata)), { filename: 'metadata.json', contentType: 'application/json' });
        const metadataResponse = await postWithRetry(`${OG_STORAGE_API}/upload`, metadataFormData, metadataFormData.getHeaders());
        metadataRootHash = metadataResponse.data.rootHash;
        console.log(`✅ Metadata uploaded with rootHash: ${metadataRootHash}`);
      } catch (e) {
        console.warn('Metadata upload deferred:', e?.message || e);
        pendingStorage = true;
        // Enqueue metadata upload
        const tmpName = `meta-${Date.now()}-${Math.random().toString(16).slice(2)}.json`;
        const tmpPath = path.join(CACHE_DIR, tmpName);
        try { fs.writeFileSync(tmpPath, Buffer.from(JSON.stringify(metadata))); } catch {}
        enqueueUpload({ kind: 'metadata', filename: 'metadata.json', contentType: 'application/json', filePath: tmpPath });
      }
    } else {
      console.log('Skipping 0G metadata upload on create (dev or disabled)');
      pendingStorage = true;
      const tmpName = `meta-${Date.now()}-${Math.random().toString(16).slice(2)}.json`;
      const tmpPath = path.join(CACHE_DIR, tmpName);
      try { fs.writeFileSync(tmpPath, Buffer.from(JSON.stringify(metadata))); } catch {}
      enqueueUpload({ kind: 'metadata', filename: 'metadata.json', contentType: 'application/json', filePath: tmpPath });
    }

    // Create coin data structure
    const coinData = {
      id: `${symbol.toLowerCase()}-${Date.now()}`,
      name,
      symbol,
      supply,
      description,
      imageUrl: imageRootHash ? `/download/${imageRootHash}` : null,
      metadataUrl: `/download/${metadataRootHash}`,
      imageRootHash,
      metadataRootHash,
      createdAt: metadata.createdAt,
      creator,
      telegramUrl: telegramUrl || undefined,
      xUrl: xUrl || undefined,
      discordUrl: discordUrl || undefined,
      websiteUrl: websiteUrl || undefined,
      price: 0,
      marketCap: 0,
      volume24h: 0,
      change24h: 0
    };

    // Persist coin row immediately so UI can list it
    try {
      await insertCoinIfMissing({
        id: coinData.id,
        name: coinData.name,
        symbol: coinData.symbol,
        supply: coinData.supply,
        imageHash: coinData.imageRootHash || null,
        tokenAddress: null,
        txHash: `local-${Date.now()}`,
        creator: coinData.creator,
        createdAt: Date.now(),
        description: coinData.description
      });
    } catch {}

    // If uploads are pending, schedule them 30s later to reduce contention
    if (pendingStorage) {
      // enqueue metadata if not uploaded
      if (!metadataRootHash) {
        const tmpName = `meta-${Date.now()}-${Math.random().toString(16).slice(2)}.json`;
        const tmpPath = path.join(CACHE_DIR, tmpName);
        try { fs.writeFileSync(tmpPath, Buffer.from(JSON.stringify(metadata))); } catch {}
        enqueueUpload({ kind: 'metadata', filename: 'metadata.json', contentType: 'application/json', filePath: tmpPath }, 30_000);
      }
      // if we had an image file earlier but failed or disabled, it was enqueued; push its next attempt back by 30s
      // We'll simply enqueue again with 30s delay; duplicates are harmless as queue de-dup is not required for testnet.
    }

    res.json({ success: true, coin: coinData, pendingStorage });

  } catch (err) {
    console.error("Create coin error:", err);
    res.status(500).json({ error: err.message || "Failed to create coin" });
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
