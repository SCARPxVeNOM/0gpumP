'use client'

import React, { useEffect, useState } from 'react'

export default function AiSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [sugRes, topRes] = await Promise.all([
          fetch('/ai-suggestions').then(r => r.json()).catch(() => ({ suggestions: [] })),
          fetch('/trending-topics').then(r => r.json()).catch(() => ({ topics: [] }))
        ])
        setSuggestions(sugRes?.suggestions || [])
        setTopics(topRes?.topics || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="p-6">Loading AI suggestions...</div>
    )
  }

  return (
    <div className="p-6">
      <div className="bg-yellow-100 border-4 border-black rounded-2xl p-4 shadow-[6px_6px_0_#000]">
        <h2 className="text-2xl font-extrabold mb-4">🤖 AI Token Suggestions</h2>
        <div className="grid gap-3">
          {suggestions.map((s: any, i: number) => (
            <div key={i} className="p-3 rounded-md bg-white border-2 border-black">
              <div className="font-bold text-lg">{s.name}</div>
              {s.reason && <div className="text-sm">{s.reason}</div>}
              {s.risk_level && <div className="text-xs text-gray-700">Risk: {s.risk_level}</div>}
            </div>
          ))}
          {suggestions.length === 0 && (
            <div className="text-sm">No suggestions available yet.</div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-white border-4 border-black rounded-2xl p-4 shadow-[6px_6px_0_#000]">
        <h3 className="text-xl font-extrabold mb-3">🔥 Trending Topics to Create Coins</h3>
        <div className="flex flex-wrap gap-2">
          {topics.map((t, i) => (
            <span key={i} className="px-2 py-1 rounded-full border-2 border-black bg-yellow-50 text-sm">{t}</span>
          ))}
          {topics.length === 0 && (
            <div className="text-sm">No topics available yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}


