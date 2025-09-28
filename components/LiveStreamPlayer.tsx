'use client'

import React, { useEffect, useRef } from 'react'

export default function LiveStreamPlayer({ streamUrl }: { streamUrl: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Dynamic import for HLS.js
    import('hls.js').then((Hls) => {
      let hls: any = null

      if (Hls.default.isSupported()) {
        hls = new Hls.default({ liveDurationInfinity: true })
        hls.loadSource(streamUrl)
        hls.attachMedia(video)
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl
      }

      return () => {
        if (hls) {
          hls.destroy()
        }
      }
    }).catch((error) => {
      console.error('Failed to load HLS.js:', error)
      // Fallback to native HLS support
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl
      }
    })
  }, [streamUrl])

  return (
    <video ref={videoRef} controls autoPlay playsInline className="w-full aspect-video rounded-xl bg-black" />
  )
}


