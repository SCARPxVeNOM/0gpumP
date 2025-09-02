import express from 'express';
import multer from 'multer';
import { ZgFile, Indexer } from '@0glabs/0g-ts-sdk';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

// File compression function (simplified for Render compatibility)
async function compressFile(filePath: string, originalName: string): Promise<{ compressedPath: string; originalSize: number; compressedSize: number; compressionRatio: number }> {
  const originalBuffer = fs.readFileSync(filePath);
  const originalSize = originalBuffer.length;
  
  let compressedBuffer = originalBuffer;
  let compressedPath = filePath;
  
  // For all files, apply gzip compression (no sharp dependency)
  try {
    const gzipped = await gzipAsync(compressedBuffer, { 
      level: 9,           // Maximum compression
      memLevel: 9,        // Maximum memory usage for compression
      strategy: 3         // Z_HUFFMAN_ONLY strategy for better compression
    });
    
    if (gzipped.length < compressedBuffer.length) {
      const gzipPath = compressedPath + '.gz';
      fs.writeFileSync(gzipPath, gzipped);
      console.log(`🗜️ Gzip compressed: ${compressedBuffer.length}B → ${gzipped.length}B (${Math.round((1 - gzipped.length/compressedBuffer.length) * 100)}% reduction)`);
      return {
        compressedPath: gzipPath,
        originalSize,
        compressedSize: gzipped.length,
        compressionRatio: gzipped.length / originalSize
      };
    }
  } catch (e) {
    console.warn('Gzip compression failed:', e);
  }
  
  return {
    compressedPath,
    originalSize,
    compressedSize: compressedBuffer.length,
    compressionRatio: compressedBuffer.length / originalSize
  };
}

// Constants - hardcoded for development
const RPC_URL = 'https://evmrpc-testnet.0g.ai/';
const INDEXER_RPC = 'https://indexer-storage-testnet-turbo.0g.ai';
const PRIVATE_KEY = '0x8c6f10acb86aeab293bd60bcf7d0e69f70643f8d219b81b6665885844abc3a9c';

// Gas configuration for 0G Storage - MUCH HIGHER for better performance
const GAS_PRICE = process.env.GAS_PRICE ? BigInt(process.env.GAS_PRICE) : BigInt('500000000'); // 500M wei (500 gwei) default
const MAX_GAS_LIMIT = process.env.MAX_GAS_LIMIT ? parseInt(process.env.MAX_GAS_LIMIT) : 20000000; // 20M gas default

console.log(`⚡ Gas Configuration: Price=${GAS_PRICE.toString()} wei (${Number(GAS_PRICE) / 1e9} gwei), Limit=${MAX_GAS_LIMIT}`);

// Initialize provider, signer and indexer
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const indexer = new Indexer(INDEXER_RPC);

app.use(express.json());

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '0G Storage API',
      version: '1.0.0',
      description: 'API documentation for 0G Storage service',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/index.ts'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Simple health endpoint for render/docker checks
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Upload a file
 *     description: Upload a file to 0G Storage
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rootHash:
 *                   type: string
 *                 transactionHash:
 *                   type: string
 *       400:
 *         description: No file uploaded
 *       500:
 *         description: Server error
 */
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Check file size limit (1MB max to allow larger files)
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
  if (req.file.size > MAX_FILE_SIZE) {
    return res.status(400).json({ 
      error: `File too large: ${(req.file.size / 1024).toFixed(1)}KB. Maximum size is ${MAX_FILE_SIZE / 1024}KB.` 
    });
  }

  try {
    console.log(`📁 Processing file: ${req.file.originalname} (${req.file.size} bytes)`);
    
    // Step 1: Compress the file to reduce gas costs
    const compression = await compressFile(req.file.path, req.file.originalname);
    console.log(`📊 Compression ratio: ${Math.round(compression.compressionRatio * 100)}% (${compression.originalSize}B → ${compression.compressedSize}B)`);
    
    // Step 2: Create ZgFile from compressed file
    const zgFile = await ZgFile.fromFilePath(compression.compressedPath);
    const [tree, treeErr] = await zgFile.merkleTree();
    
    if (treeErr !== null) {
      throw new Error(`Error generating Merkle tree: ${treeErr}`);
    }

    // Step 3: Upload compressed file with retry logic
    console.log(`📤 Uploading compressed file to 0G Storage...`);
    
    let tx = null;
    let uploadErr = null;
    
    // Try upload with retry logic
    try {
      [tx, uploadErr] = await indexer.upload(zgFile, RPC_URL, signer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`⚠️ First upload attempt failed: ${errorMessage}`);
      
      // If first attempt fails, try one more time
      try {
        console.log(`🔄 Retrying upload...`);
        [tx, uploadErr] = await indexer.upload(zgFile, RPC_URL, signer);
      } catch (retryError) {
        const retryErrorMessage = retryError instanceof Error ? retryError.message : String(retryError);
        throw new Error(`Upload failed after retry: ${retryErrorMessage}`);
      }
    }
    
    // Some nodes return an error when data already exists. Treat as success.
    if (uploadErr !== null) {
      const msg = String(uploadErr);
      if (msg.toLowerCase().includes('already exists')) {
        console.log(`✅ File already exists on network: ${tree?.rootHash()}`);
        await zgFile.close();
        return res.json({
          rootHash: tree?.rootHash() ?? '',
          transactionHash: null,
          note: 'Data already existed on network',
          compression: {
            originalSize: compression.originalSize,
            compressedSize: compression.compressedSize,
            ratio: compression.compressionRatio
          }
        });
      }
      
             // If fee too low or network error, retry with different strategy
       if (msg.toLowerCase().includes('fee too low') || 
           msg.toLowerCase().includes('gas price too low') ||
           msg.toLowerCase().includes('too many data writing')) {
         console.log(`⚠️ Network error detected: ${msg}, retrying upload...`);
         
         // Wait a bit before retry
         await new Promise(resolve => setTimeout(resolve, 5000));
         
         const [retryTx, retryErr] = await indexer.upload(zgFile, RPC_URL, signer);
         
         if (retryErr !== null) {
           throw new Error(`Upload error on retry: ${retryErr}`);
         }
         
         console.log(`✅ Upload successful on retry: ${tree?.rootHash()}`);
         await zgFile.close();
         
         return res.json({
           rootHash: tree?.rootHash() ?? '',
           transactionHash: retryTx,
           compression: {
             originalSize: compression.originalSize,
             compressedSize: compression.compressedSize,
             ratio: compression.compressionRatio
           }
         });
       }
      
      throw new Error(`Upload error: ${uploadErr}`);
    }
    
    console.log(`✅ Upload successful: ${tree?.rootHash()}`);

    await zgFile.close();

    res.json({
      rootHash: tree?.rootHash() ?? '',
      transactionHash: tx,
      compression: {
        originalSize: compression.originalSize,
        compressedSize: compression.compressedSize,
        ratio: compression.compressionRatio
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * @swagger
 * /download/{rootHash}:
 *   get:
 *     summary: Download a file
 *     description: Download a file from 0G Storage using its root hash
 *     parameters:
 *       - in: path
 *         name: rootHash
 *         required: true
 *         schema:
 *           type: string
 *         description: The root hash of the file to download
 *     responses:
 *       200:
 *         description: File downloaded successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Server error
 */
app.get('/download/:rootHash', async (req, res) => {
  const { rootHash } = req.params;
  const downloadsDir = path.join(process.cwd(), 'downloads');
  try {
    // Ensure downloads directory exists
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const outputPath = path.join(downloadsDir, rootHash);

    const err = await indexer.download(rootHash, outputPath, true);
    if (err !== null) {
      throw new Error(`Download error from indexer: ${err}`);
    }

    res.download(outputPath, (err) => {
      if (err) {
        console.error('Download send error:', err);
        res.status(500).json({ error: 'Failed to send file' });
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});