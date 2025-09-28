'use client'

import React, { useEffect, useRef } from 'react'

export default function LiveStreamPlayer({ streamUrl }: { streamUrl: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let hls: any = null

    // Dynamic import for HLS.js
    import('hls.js').then((HlsModule) => {
      const Hls = HlsModule.default || HlsModule

      if (Hls.isSupported()) {
        hls = new Hls({ 
          liveDurationInfinity: true,
          enableWorker: false,
          lowLatencyMode: true
        })
        hls.loadSource(streamUrl)
        hls.attachMedia(video)
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data)
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('Fatal network error, trying to recover...')
                hls.startLoad()
                break
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('Fatal media error, trying to recover...')
                hls.recoverMediaError()
                break
              default:
                console.log('Fatal error, destroying HLS...')
                hls.destroy()
                break
            }
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl
      }
    }).catch((error) => {
      console.error('Failed to load HLS.js:', error)
      // Fallback to native HLS support
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl
      }
    })

    return () => {
      if (hls) {
        hls.destroy()
      }
    }
  }, [streamUrl])

  return (
    <video 
      ref={videoRef} 
      controls 
      autoPlay 
      playsInline 
      className="w-full aspect-video rounded-xl bg-black"
      style={{ minHeight: '400px' }}
    />
  )
}


