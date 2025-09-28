'use client'

import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'

const LiveStreamPlayer = dynamic(() => import('../../components/LiveStreamPlayer'), { ssr: false })
const LiveChat = dynamic(() => import('../../components/LiveChat'), { ssr: false })

export default function LivestreamsPage() {
  // Get streaming service URL from environment
  const base = process.env.NEXT_PUBLIC_LIVE_BASE_URL || 'https://0g-pump-streaming.onrender.com'
  const streamKey = 'live/coin123.m3u8'
  const streamUrl = useMemo(() => `${base}/${streamKey}`, [base])

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Live</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <LiveStreamPlayer streamUrl={streamUrl} />
        </div>
        <div className="lg:col-span-1">
          <LiveChat />
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        Stream ingest: rtmp://your-render-url/live/coin123 • Playback: {streamUrl}
      </div>
    </div>
  )
}


