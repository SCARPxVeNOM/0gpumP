'use client'

import React, { useEffect, useState } from 'react'

export default function AiSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const backendBase = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'
        const [sugRes, topRes] = await Promise.all([
          fetch(`${backendBase}/ai-suggestions`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ suggestions: [] })),
          fetch(`${backendBase}/trending-topics`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ topics: [] }))
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

      {/* FAQ Section */}
      <div className="mt-6 bg-slate-50 border-4 border-black rounded-2xl p-4 shadow-[6px_6px_0_#000]">
        <h3 className="text-xl font-extrabold mb-4">❓ Platform FAQs</h3>
        <div className="space-y-3">
          <details className="border-2 border-black rounded-lg bg-white p-3">
            <summary className="font-bold cursor-pointer">What chain and gas token does OG Pump use?</summary>
            <p className="mt-2 text-sm">We run on the 0G Galileo testnet. Transactions use OG as gas. Set your wallet RPC to https://evmrpc-testnet.0g.ai.</p>
          </details>
          <details className="border-2 border-black rounded-lg bg-white p-3">
            <summary className="font-bold cursor-pointer">How much gas does creating a token cost?</summary>
            <p className="mt-2 text-sm">Typical token creation is a few hundred thousand gas. Expect cents on testnet. Trading calls add standard swap costs.</p>
          </details>
          <details className="border-2 border-black rounded-lg bg-white p-3">
            <summary className="font-bold cursor-pointer">Where is token media stored?</summary>
            <p className="mt-2 text-sm">Images/metadata are uploaded to 0G Storage via the official SDK. We also cache uploads for instant serving.</p>
          </details>
          <details className="border-2 border-black rounded-lg bg-white p-3">
            <summary className="font-bold cursor-pointer">How does liquidity work?</summary>
            <p className="mt-2 text-sm">New tokens are paired with a bonding curve contract. Prices are algorithmically set by reserves; buys add OG, sells remove OG.</p>
          </details>
          <details className="border-2 border-black rounded-lg bg-white p-3">
            <summary className="font-bold cursor-pointer">Why do I see “no trading enabled” sometimes?</summary>
            <p className="mt-2 text-sm">If the PairCreated event is delayed, our backend resolves it and updates the DB. Refresh in ~30s or use the Resolve Pair tool.</p>
          </details>
          <details className="border-2 border-black rounded-lg bg-white p-3">
            <summary className="font-bold cursor-pointer">What models power AI suggestions?</summary>
            <p className="mt-2 text-sm">0G Compute providers (e.g., deepseek-r1-70b). If a node is unavailable, we show heuristic suggestions and a static topic list.</p>
          </details>
          <details className="border-2 border-black rounded-lg bg-white p-3">
            <summary className="font-bold cursor-pointer">How is my data cached?</summary>
            <p className="mt-2 text-sm">Server-side in-memory caching (5 min TTL) for suggestions/topics; coins are stored in SQLite with a small cache layer.</p>
          </details>
          <details className="border-2 border-black rounded-lg bg-white p-3">
            <summary className="font-bold cursor-pointer">Where can I report issues?</summary>
            <p className="mt-2 text-sm">Use the Support section or open an issue on the GitHub repo. Include the token symbol/tx hash and a screenshot.</p>
          </details>
        </div>
      </div>
    </div>
  )
}


