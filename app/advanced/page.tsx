"use client";

import { useEffect, useMemo, useState } from "react";

export default function AdvancedPage() {
  const backendUrl = useMemo(() =>
    process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "http://localhost:4000",
  []);

  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(
    "Based on recent activity and volumes, suggest 5 trending tokens with a one-line rationale and risk note. Return JSON."
  );

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch(`${backendUrl}/ai/models`, { cache: "no-store" });
        const data = await res.json();
        if (data?.success) setModels(data.models || []);
      } catch (e: any) {
        // best-effort only
      }
    };
    fetchModels();
  }, [backendUrl]);

  const runSuggestions = async () => {
    setLoading(true);
    setError(null);
    setSuggestions(null);
    try {
      const res = await fetch(`${backendUrl}/ai/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Failed to fetch suggestions");
      setSuggestions(data.suggestions || []);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-6 py-8">
      <h1 className="text-3xl font-extrabold mb-4">AI Token Suggestions</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Powered by 0G Compute. Click "Generate" to get AI-driven token recommendations based on on-chain market stats.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 rounded-xl border-2 border-black bg-blue-50 p-4 shadow-[6px_6px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition">
          <label className="block text-sm font-semibold mb-2">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            className="w-full rounded-lg border-2 border-black p-3 outline-none"
          />
          <button
            onClick={runSuggestions}
            disabled={loading}
            className="mt-3 rounded-lg border-2 border-black bg-yellow-400 px-4 py-2 font-bold shadow-[4px_4px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate"}
          </button>
          {error && (
            <div className="mt-3 rounded-lg border-2 border-black bg-red-100 p-3 font-semibold">
              {error}
            </div>
          )}
        </div>

        <div className="rounded-xl border-2 border-black bg-white p-4 shadow-[6px_6px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition">
          <h2 className="font-bold mb-2">Available Models</h2>
          <ul className="text-sm space-y-1 max-h-56 overflow-auto pr-1">
            {models?.length ? models.map((m: any, i: number) => (
              <li key={i} className="truncate">{typeof m === 'string' ? m : m?.name || JSON.stringify(m)}</li>
            )) : <li className="text-muted-foreground">Not configured</li>}
          </ul>
          <div className="mt-3 text-xs text-muted-foreground">
            Backend: {backendUrl}
          </div>
        </div>
      </div>

      {suggestions && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {suggestions.map((s: any, idx: number) => (
            <div
              key={idx}
              className="rounded-xl border-2 border-black bg-white p-4 shadow-[6px_6px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition"
            >
              <div className="text-lg font-extrabold mb-1">{s.title || s.tokenId || `Suggestion ${idx + 1}`}</div>
              {s.summary && <p className="text-sm mb-1">{s.summary}</p>}
              {s.risk && <p className="text-xs text-amber-700">Risk: {s.risk}</p>}
              {s.tokenId && (
                <a
                  href={`/bonding-curve?token=${encodeURIComponent(s.tokenId)}`}
                  className="inline-block mt-3 rounded-lg border-2 border-black bg-blue-200 px-3 py-1 font-bold shadow-[3px_3px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                >
                  View Token
                </a>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

 


