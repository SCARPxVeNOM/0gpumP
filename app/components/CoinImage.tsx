'use client'
import { useEffect, useMemo, useState } from 'react'
import { CoinData } from '../../lib/0gStorageSDK'

interface CoinImageProps {
  coin: CoinData & { imageHash?: string; imageRootHash?: string; imageUrl?: string }
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function CoinImage({ coin, size = 'md', className = '' }: CoinImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-16 h-16'
  }

  const backendBase = useMemo(() => {
    const envUrl = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) as string | undefined
    if (envUrl && typeof envUrl === 'string') return envUrl
    return 'http://localhost:4000'
  }, [])

  useEffect(() => {
    // Preferred: explicit URL
    if (coin.imageUrl && (coin.imageUrl.startsWith('http') || coin.imageUrl.startsWith('/'))) {
      // Route through Next proxy if it's a root-hash URL pointing to backend
      if (coin.imageUrl.startsWith('http')) {
        // If imageUrl already absolute, keep it; otherwise rely on proxy path below
        setImageSrc(coin.imageUrl)
      } else {
        setImageSrc(coin.imageUrl.startsWith('/') ? `${backendBase}${coin.imageUrl}` : coin.imageUrl)
      }
      return
    }

    // Fallback: root hash present
    const root = (coin as any).imageRootHash || (coin as any).imageHash
    if (typeof root === 'string' && root.length > 0) {
      // Use proxy path to avoid mixed content/CORS
      setImageSrc(`/api/image/${root}`)
      return
    }

    setImageSrc(null)
  }, [coin.imageUrl, (coin as any).imageHash, (coin as any).imageRootHash, backendBase])

  if (imageSrc) {
    return (
      <div className={`${sizeClasses[size]} rounded-2xl border-2 border-purple-500/50 overflow-hidden shadow-lg ${className}`}>
        <img src={imageSrc} alt={coin.name} className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div className={`${sizeClasses[size]} rounded-2xl border-2 border-purple-500/50 bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center ${className}`}>
      <span className={`font-bold text-purple-400 ${
        size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : 'text-2xl'
      }`}>
        {coin.symbol?.charAt(0)?.toUpperCase() || '?'}
      </span>
    </div>
  )
}
