'use client'

import React, { useEffect, useRef } from 'react'
import Hls from 'hls.js'

export default function LiveStreamPlayer({ streamUrl }: { streamUrl: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let hls: Hls | null = null

    if (Hls.isSupported()) {
      hls = new Hls({ liveDurationInfinity: true })
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
  }, [streamUrl])

  return (
    <video ref={videoRef} controls autoPlay playsInline className="w-full aspect-video rounded-xl bg-black" />
  )
}


