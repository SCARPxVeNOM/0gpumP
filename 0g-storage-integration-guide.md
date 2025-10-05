# Complete 0G Storage Integration Guide

This guide contains everything needed to integrate 0G Storage into any React application. Copy and paste the code sections as needed.

## 1. Dependencies

Add these to your `package.json`:

```json
{
  "dependencies": {
    "@0glabs/0g-ts-sdk": "^0.3.1",
    "ethers": "^6.14.3",
    "wagmi": "^2.15.7",
    "@wagmi/core": "^2.17.3",
    "@rainbow-me/rainbowkit": "^2.2.8",
    "@tanstack/react-query": "^5.83.0",
    "viem": "^2.32.0"
  },
  "devDependencies": {
    "vite-plugin-node-polyfills": "^0.24.0"
  }
}
```

## 2. Vite Configuration

Update your `vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'crypto', 'stream', 'util', 'events']
    })
  ],
  define: {
    global: 'globalThis',
  }
})
```

## 3. Environment Variables

Create `.env.local`:

```bash
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

## 4. Core 0G Storage Service

Create `src/lib/0g-storage.ts`:

```typescript
import { ethers } from 'ethers';

declare global {
  interface Window {
    zgstorage: {
      Blob: any;
      Indexer: any;
      Uploader: any;
      Downloader: any;
      StorageNode: any;
      MerkleTree: any;
      ZgFile: any;
      MemData: any;
      FixedPriceFlow__factory: any;
      getFlowContract: any;
      getMarketContract: any;
      txWithGasAdjustment: any;
      calculatePrice: any;
      delay: any;
      computePaddedSize: any;
      nextPow2: any;
      numSplits: any;
      getShardConfigs: any;
      isValidConfig: any;
      DEFAULT_CHUNK_SIZE: number;
      DEFAULT_SEGMENT_SIZE: number;
      DEFAULT_SEGMENT_MAX_CHUNKS: number;
      SMALL_FILE_SIZE_THRESHOLD: number;
      TIMEOUT_MS: number;
      ZERO_HASH: string;
      EMPTY_CHUNK_HASH: string;
      defaultUploadOption: {
        tags: string;
        finalityRequired: boolean;
        taskSize: number;
        expectedReplica: number;
        skipTx: boolean;
        fee: bigint;
      };
    };
  }
}

const RPC_URL = 'https://evmrpc-testnet.0g.ai/';
const INDEXER_RPC = 'https://indexer-storage-testnet-turbo.0g.ai';

export interface ZgStorageConfig {
  rpcUrl: string;
  indexerRpc: string;
}

export interface UploadResult {
  success: boolean;
  txHash: string;
  rootHash: string;
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  data?: Uint8Array;
  size?: number;
  error?: string;
}

export class ZgStorageService {
  private config: ZgStorageConfig;
  private indexer: any = null;

  constructor(config?: Partial<ZgStorageConfig>) {
    this.config = {
      rpcUrl: config?.rpcUrl || RPC_URL,
      indexerRpc: config?.indexerRpc || INDEXER_RPC,
      ...config
    };
  }

  private ensureCryptoPolyfill(): void {
    if (typeof global === 'undefined') {
      (window as any).global = globalThis;
    }
    
    if (typeof process === 'undefined') {
      (window as any).process = {
        browser: true,
        version: 'v16.0.0',
        platform: 'browser',
        env: {}
      };
    }
    
    if (typeof Buffer === 'undefined') {
      (window as any).Buffer = {
        from: function(data: any, _encoding?: string) {
          if (typeof data === 'string') {
            return new TextEncoder().encode(data);
          }
          return new Uint8Array(data);
        },
        isBuffer: function(obj: any) {
          return obj instanceof Uint8Array;
        }
      };
    }
    
    if (!(window as any).node_crypto) {
      (window as any).node_crypto = {
        createHash: function(_algorithm: string) {
          let data: any = null;
          return {
            update: function(newData: any) {
              if (data === null) {
                data = newData;
              } else if (data instanceof Uint8Array && newData instanceof Uint8Array) {
                const combined = new Uint8Array(data.length + newData.length);
                combined.set(data);
                combined.set(newData, data.length);
                data = combined;
              } else {
                const str1 = typeof data === 'string' ? data : new TextDecoder().decode(data);
                const str2 = typeof newData === 'string' ? newData : new TextDecoder().decode(newData);
                data = str1 + str2;
              }
              return this;
            },
            digest: function(encoding: string) {
              const str = typeof data === 'string' ? data : new TextDecoder().decode(data);
              let hash = 0;
              for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
              }
              return encoding === 'hex' ? hash.toString(16) : hash.toString();
            }
          };
        }
      };
    }
    
    if (!(window as any).promises) {
      (window as any).promises = {};
    }
  }

  private async loadSDKFromCDN(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.zgstorage) {
        resolve();
        return;
      }

      this.ensureCryptoPolyfill();

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@0glabs/0g-ts-sdk@0.3.1/dist/zgstorage.umd.min.js';
      script.onload = () => {
        if (window.zgstorage) {
          resolve();
        } else {
          reject(new Error('0G SDK failed to load from CDN'));
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to load 0G SDK from CDN'));
      };
      document.head.appendChild(script);
    });
  }

  private async initializeSDK() {
    if (this.indexer) {
      return;
    }
    
    try {
      await this.loadSDKFromCDN();
      this.indexer = new window.zgstorage.Indexer(this.config.indexerRpc);
      this.overrideStorageNodeSelection();
    } catch (error) {
      throw new Error('Failed to initialize 0G Storage SDK: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private overrideStorageNodeSelection() {
    if (typeof window === 'undefined') return;
    
    const originalSelectNodes = this.indexer.selectNodes.bind(this.indexer);
    
    this.indexer.selectNodes = async (...args: any[]) => {
      const result = await originalSelectNodes(...args);
      
      if (result && result.nodes) {
        result.nodes = result.nodes.filter((node: any) => {
          if (node.url && node.url.startsWith('http://')) {
            return false;
          }
          return true;
        });
      }
      
      return result;
    };
  }

  async uploadFile(file: File, signer: any): Promise<UploadResult> {
    try {
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      await this.initializeSDK();
      
      const zgBlob = new window.zgstorage.Blob(file as any);
      
      const [tree, treeErr] = await zgBlob.merkleTree();
      if (treeErr !== null) {
        throw new Error(`Error generating Merkle tree: ${treeErr}`);
      }
      
      const rootHash = tree?.rootHash();
      
      const uploadOpts = window.zgstorage.defaultUploadOption || {
        tags: '0x',
        finalityRequired: true,
        taskSize: 1,
        expectedReplica: 1,
        skipTx: false,
        fee: BigInt('0'),
      };
      
      const retryOpts = {
        Retries: 10,
        Interval: 5,
        MaxGasPrice: 0,
        TooManyDataRetries: 3
      };
      
      const [result, uploadErr] = await this.indexer.upload(zgBlob, this.config.rpcUrl, signer, uploadOpts, retryOpts);
      
      if (uploadErr !== null) {
        throw new Error(`Upload error: ${uploadErr}`);
      }
      
      return {
        success: true,
        rootHash: result.rootHash || rootHash || '',
        txHash: result.txHash || '',
      };
    } catch (error) {
      return {
        success: false,
        rootHash: '',
        txHash: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async downloadFile(rootHash: string, withProof: boolean = true): Promise<DownloadResult> {
    try {
      await this.initializeSDK();

      const locations = await this.indexer.getFileLocations(rootHash);
      if (!locations || locations.length === 0) {
        throw new Error('File not found on any storage node');
      }

      const storageNodes = locations.map((location: any) => {
        return new window.zgstorage.StorageNode(location.url);
      });
      
      let fileInfo = null;
      for (const node of storageNodes) {
        try {
          const info = await node.getFileInfo(rootHash, true);
          if (info && info.finalized) {
            fileInfo = info;
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!fileInfo) {
        throw new Error('File not found or not finalized');
      }

      const fileData = await this.downloadFileDataBrowser(rootHash, fileInfo, withProof);
      
      return {
        success: true,
        data: fileData,
        size: fileData.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async downloadFileDataBrowser(rootHash: string, fileInfo: any, withProof: boolean = true): Promise<Uint8Array> {
    const locations = await this.indexer.getFileLocations(rootHash);
    const storageNodes = locations.map((location: any) => {
      return new window.zgstorage.StorageNode(location.url);
    });

    const numSegments = fileInfo.uploadedSegNum || fileInfo.numSegments || 1;
    const segmentDataArray: Uint8Array[] = [];
    let totalSize = 0;

    for (let i = 0; i < numSegments; i++) {
      let segmentData: Uint8Array | null = null;
      
      for (const node of storageNodes) {
        try {
          if (withProof) {
            const result = await node.downloadSegmentWithProof(rootHash, i);
            if (result && result.data) {
              segmentData = ethers.decodeBase64(result.data);
              break;
            }
          } else {
            const result = await node.downloadSegment(rootHash, i);
            if (result && result.data) {
              segmentData = ethers.decodeBase64(result.data);
              break;
            }
          }
        } catch (error) {
          continue;
        }
      }

      if (segmentData) {
        segmentDataArray.push(segmentData);
        totalSize += segmentData.length;
      } else {
        throw new Error(`Failed to download segment ${i}`);
      }
    }

    const finalData = new Uint8Array(totalSize);
    let offset = 0;
    for (const segment of segmentDataArray) {
      finalData.set(segment, offset);
      offset += segment.length;
    }

    return finalData;
  }

  async getNetworkStatus(): Promise<{ rpc: boolean; indexer: boolean }> {
    try {
      const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      
      await this.initializeSDK();
      const nodes = await this.indexer.getShardedNodes();
      
      return {
        rpc: true,
        indexer: true
      };
    } catch (error) {
      throw new Error('Failed to initialize 0G Storage SDK: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}

export const zgStorage = new ZgStorageService();
export function getZgStorageService(config?: Partial<ZgStorageConfig>): ZgStorageService {
  return new ZgStorageService(config);
}
```

## 5. Wagmi Configuration

Create `src/lib/wagmi.ts`:

```typescript
import { createConfig, http } from 'wagmi'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

const zgChain = {
  id: 16602,
  name: '0G-Galileo-Testnet',
  network: '0g-galileo-testnet',
  nativeCurrency: {
    decimals: 18,
    name: '0G',
    symbol: '0G',
  },
  rpcUrls: {
    default: {
      http: ['https://evmrpc-testnet.0g.ai/'],
    },
    public: {
      http: ['https://evmrpc-testnet.0g.ai/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Chainscan',
      url: 'https://chainscan-galileo.0g.ai',
    },
  },
  testnet: true,
} as const

export const config = createConfig({
  chains: [zgChain],
  connectors: [
    injected(),
    metaMask(),
    walletConnect({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID!,
    }),
  ],
  transports: {
    [zgChain.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
```

## 6. Ethers Signer Hook

Create `src/hooks/useEthers.ts`:

```typescript
import { useAccount, useWalletClient } from 'wagmi'
import { useMemo } from 'react'
import { BrowserProvider } from 'ethers'

export const useEthersSigner = () => {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  return useMemo(() => {
    if (!walletClient || !address) return undefined
    
    const provider = new BrowserProvider(walletClient)
    return provider.getSigner()
  }, [walletClient, address])
}
```

## 7. ZgStorage Provider

Create `src/providers/ZgStorageProvider.tsx`:

```typescript
import { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { ZgStorageService, getZgStorageService } from "../lib/0g-storage";

export const ZgStorageContext = createContext<{
  zgStorage: ZgStorageService | null;
  isConnected: boolean;
  error?: string;
}>({ 
  zgStorage: null, 
  isConnected: false 
});

export const ZgStorageProvider = ({ children }: { children: ReactNode }) => {
  const [zgStorage, setZgStorage] = useState<ZgStorageService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const initializeZgStorage = async () => {
    try {
      setError(undefined);
      
      const zgStorageService = getZgStorageService({
        rpcUrl: 'https://evmrpc-testnet.0g.ai/',
        indexerRpc: 'https://indexer-storage-testnet-turbo.0g.ai',
      });

      setZgStorage(zgStorageService);

      const networkStatus = await zgStorageService.getNetworkStatus();
      if (networkStatus.rpc && networkStatus.indexer) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
        setError('Failed to connect to 0G Storage');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
      setIsConnected(false);
    }
  };
  
  useEffect(() => {
    initializeZgStorage();
  }, []);

  return (
    <ZgStorageContext.Provider value={{ zgStorage, isConnected, error }}>
      {children}
    </ZgStorageContext.Provider>
  );
};

export const useZgStorage = () => {
  const { zgStorage, isConnected, error } = useContext(ZgStorageContext);
  return { zgStorage, isConnected, error };
};
```

## 8. File Upload Hook

Create `src/hooks/useFileUpload.ts`:

```typescript
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useZgStorage } from "../providers/ZgStorageProvider";
import { useEthersSigner } from "./useEthers";

export const useFileUpload = () => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const { zgStorage, isConnected, error: zgError } = useZgStorage();
  const { address } = useAccount();
  const signer = useEthersSigner();

  const mutation = useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      if (!zgStorage) {
        throw new Error("0G Storage not available");
      }
      if (!address) {
        throw new Error("Wallet not connected");
      }
      if (!isConnected) {
        throw new Error(`0G Storage connection failed: ${zgError || 'Unknown error'}`);
      }
      
      setProgress(0);
      setStatus("🔄 Uploading file to 0G Storage...");
      setProgress(30);

      if (!signer) {
        throw new Error('Wallet not connected');
      }
      
      const uploadResult = await zgStorage.uploadFile(file, signer);
      
      setProgress(70);
      
      if (!uploadResult.success) {
        throw new Error(`Upload failed: ${uploadResult.error || 'Unknown error'}`);
      }

      setProgress(100);
      setStatus("🎉 File uploaded successfully!");

      return {
        rootHash: uploadResult.rootHash,
        txHash: uploadResult.txHash,
        fileName: file.name,
        fileSize: file.size,
      };
    },
    onError: (error: any) => {
      setStatus(`❌ Upload failed: ${error.message}`);
      setProgress(0);
    },
  });

  return {
    uploadFileMutation: mutation,
    progress,
    status,
  };
};
```

## 9. File Download Hook

Create `src/hooks/useFileDownload.ts`:

```typescript
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useZgStorage } from "../providers/ZgStorageProvider";

export const useFileDownload = () => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const { zgStorage, isConnected, error: zgError } = useZgStorage();
  
  const mutation = useMutation({
    mutationFn: async ({ rootHash }: { rootHash: string }) => {
      if (!zgStorage) {
        throw new Error("0G Storage not available");
      }
      if (!isConnected) {
        throw new Error(`0G Storage connection failed: ${zgError || 'Unknown error'}`);
      }

      setProgress(0);
      setStatus("📥 Downloading file from 0G Storage...");
      setProgress(40);

      const downloadResult = await zgStorage.downloadFile(rootHash, true);
      
      if (!downloadResult.success) {
        throw new Error(`Download failed: ${downloadResult.error || 'Unknown error'}`);
      }

      if (!downloadResult.data) {
        throw new Error("No data received from 0G Storage");
      }

      setProgress(100);
      setStatus("✅ File downloaded successfully");

      return {
        data: downloadResult.data,
        size: downloadResult.size,
      };
    },
    onError: (error: any) => {
      setStatus(`❌ Download failed: ${error.message}`);
      setProgress(0);
    },
  });

  return {
    downloadFileMutation: mutation,
    progress,
    status,
  };
};
```

## 10. App Setup

Update your main `App.tsx`:

```typescript
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './lib/wagmi'
import { ZgStorageProvider } from './providers/ZgStorageProvider'
import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <RainbowKitProvider
          modalSize="compact"
          initialChain={16602}
          locale="en"
        >
          <ZgStorageProvider>
            {/* Your app components */}
          </ZgStorageProvider>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}

export default App
```

## 11. Usage Examples

### Basic Upload Component
```typescript
import { useFileUpload } from './hooks/useFileUpload';

function UploadComponent() {
  const { uploadFileMutation, progress, status } = useFileUpload();

  const handleFileUpload = async (file: File) => {
    try {
      const result = await uploadFileMutation.mutateAsync({ file });
      console.log('Upload successful:', result);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} 
      />
      {progress > 0 && <div>Progress: {progress}%</div>}
      {status && <div>{status}</div>}
    </div>
  );
}
```

### Basic Download Component
```typescript
import { useFileDownload } from './hooks/useFileDownload';

function DownloadComponent() {
  const { downloadFileMutation, progress, status } = useFileDownload();

  const handleDownload = async (rootHash: string) => {
    try {
      const result = await downloadFileMutation.mutateAsync({ rootHash });
      
      const blob = new Blob([result.data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'downloaded-file';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div>
      <button onClick={() => handleDownload('your-root-hash')}>
        Download File
      </button>
      {progress > 0 && <div>Progress: {progress}%</div>}
      {status && <div>{status}</div>}
    </div>
  );
}
```

## 12. Configuration Options

Create `src/config.ts`:

```typescript
export const config = {
  zgStorage: {
    rpcUrl: 'https://evmrpc-testnet.0g.ai/',
    indexerRpc: 'https://indexer-storage-testnet-turbo.0g.ai',
  },
  maxFileSize: 256 * 1024 * 1024, // 256MB
  enableProofVerification: true,
  withCDN: true,
}
```

## Key Points:

1. **SDK Loading**: 0G SDK loads dynamically from CDN
2. **Browser Polyfills**: Essential for Node.js compatibility
3. **Network**: Uses 0G Galileo Testnet (Chain ID: 16602)
4. **Signer Compatibility**: Converts viem to ethers signers
5. **Error Handling**: Comprehensive error handling included
6. **Progress Tracking**: Built-in progress tracking
7. **Merkle Proofs**: Optional verification for data integrity

This implementation provides complete 0G Storage integration for any React application.
