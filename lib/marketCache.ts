import { ogStorageSDK } from './0gStorageSDK'

export interface MarketSnapshot {
  tokenAddress: string
  timestamp: number
  price: number
  marketCap: number
  reserves?: { token: string; weth: string }
  pairAddress?: string
}

const pointerKey = (addr: string) => `0g_market_root_${addr.toLowerCase()}`
const cacheKey = (addr: string) => `0g_market_snapshot_${addr.toLowerCase()}`
const lastUploadKey = (addr: string) => `0g_market_last_upload_${addr.toLowerCase()}`
const UPLOAD_INTERVAL_MS = 60_000

export async function saveMarketSnapshot(tokenAddress: string, snapshot: MarketSnapshot): Promise<string | null> {
  try {
    const meta = { type: 'marketSnapshot', tokenAddress, timestamp: snapshot.timestamp }
    let shouldUpload = true
    let uploadsEnabled = true
    try {
      const isDev = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NODE_ENV) !== 'production'
      uploadsEnabled = (((typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_ENABLE_0G_UPLOADS)) ?? (isDev ? 'false' : 'true')) === 'true'
    } catch {}
    try {
      if (typeof window !== 'undefined') {
        const last = localStorage.getItem(lastUploadKey(tokenAddress))
        if (last && Date.now() - Number(last) < UPLOAD_INTERVAL_MS) {
          shouldUpload = false
        }
      }
    } catch {}

    const didUpload = shouldUpload && uploadsEnabled
    const uploaded = didUpload
      ? await ogStorageSDK.uploadData(snapshot, meta, { quiet: true })
      : null
    if (typeof window !== 'undefined') {
      // Only update pointer when an actual remote upload was attempted and enabled
      if (didUpload && uploaded && uploaded.rootHash && uploaded.rootHash !== '0x') {
        localStorage.setItem(pointerKey(tokenAddress), uploaded.rootHash)
        localStorage.setItem(lastUploadKey(tokenAddress), String(Date.now()))
      }
      // Always refresh local cache
      localStorage.setItem(cacheKey(tokenAddress), JSON.stringify(snapshot))
    }
    return uploaded?.rootHash ?? null
  } catch (e) {
    // Still cache locally even if upload fails so UI can fallback; do not console.error
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(cacheKey(tokenAddress), JSON.stringify(snapshot))
      }
    } catch {}
    return null
  }
}

export async function getCachedMarketSnapshot(tokenAddress: string, maxAgeMs: number = 60_000): Promise<MarketSnapshot | null> {
  try {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey(tokenAddress))
      if (cached) {
        const parsed: MarketSnapshot = JSON.parse(cached)
        if (Date.now() - parsed.timestamp <= maxAgeMs) {
          return parsed
        }
      }
      const root = localStorage.getItem(pointerKey(tokenAddress))
      if (root && root !== '0x') {
        const from0g = await ogStorageSDK.downloadData(root)
        if (from0g && typeof from0g.timestamp === 'number') {
          localStorage.setItem(cacheKey(tokenAddress), JSON.stringify(from0g))
          return from0g as MarketSnapshot
        }
      }
    }
  } catch {}
  return null
}


