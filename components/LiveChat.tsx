'use client'

import React, { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

const CHAT_URL = process.env.NEXT_PUBLIC_CHAT_URL || 'https://0g-pump-backend.onrender.com'

export default function LiveChat() {
  const [messages, setMessages] = useState<string[]>([])
  const [input, setInput] = useState('')
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io(CHAT_URL, { transports: ['websocket'] })
    socketRef.current = socket
    socket.on('connect', () => {})
    socket.on('chat message', (msg: string) => setMessages(prev => [...prev, msg]))
    return () => {
      socket.disconnect()
    }
  }, [])

  const sendMessage = () => {
    if (!input.trim()) return
    socketRef.current?.emit('chat message', input.trim())
    setInput('')
  }

  return (
    <div className="p-2 border rounded-lg bg-[hsl(var(--card))]">
      <div className="h-80 overflow-y-auto bg-black/5 p-2 rounded">
        {messages.map((msg, i) => (
          <div key={i} className="mb-1 text-sm">{msg}</div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <input
          className="border p-2 flex-1 rounded"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say something..."
        />
        <button onClick={sendMessage} className="px-3 py-2 bg-yellow-500 text-black rounded font-medium">
          Send
        </button>
      </div>
    </div>
  )
}


