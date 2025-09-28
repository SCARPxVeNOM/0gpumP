'use client'

import React, { useEffect, useRef } from 'react'

export default function LiveStreamPlayer({ streamUrl }: { streamUrl: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Simple approach - let the browser handle HLS natively
    video.src = streamUrl
    video.load()

    // Add error handling
    const handleError = (e: Event) => {
      console.error('Video error:', e)
    }

    const handleLoadStart = () => {
      console.log('Video loading started')
    }

    const handleCanPlay = () => {
      console.log('Video can play')
    }

    video.addEventListener('error', handleError)
    video.addEventListener('loadstart', handleLoadStart)
    video.addEventListener('canplay', handleCanPlay)

    return () => {
      video.removeEventListener('error', handleError)
      video.removeEventListener('loadstart', handleLoadStart)
      video.removeEventListener('canplay', handleCanPlay)
    }
  }, [streamUrl])

  return (
    <div className="w-full aspect-video rounded-xl bg-black relative">
      <video 
        ref={videoRef} 
        controls 
        autoPlay 
        playsInline 
        className="w-full h-full rounded-xl"
        style={{ minHeight: '400px' }}
      />
      <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded text-sm">
        Live Stream
      </div>
    </div>
  )
}


