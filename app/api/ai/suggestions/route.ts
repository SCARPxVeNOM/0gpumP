import { NextResponse } from 'next/server'

// Use isolated 0G Compute runtime with SDK 0.4.3 and ethers v6
function safeRequire(path: string) {
  try { return require(path) } catch { return null }
}

async function getSuggestionsFromCompute() {
  const runtime = safeRequire(process.cwd() + '/compute-runtime/broker.js')
  if (!runtime) throw new Error('compute runtime not available')

  // Ensure broker initialized
  await runtime.getBroker()

  // List services and choose one
  const services = await runtime.listServices()
  if (!services || services.length === 0) throw new Error('no services')
  const provider = services[0].provider

  await runtime.acknowledgeProvider(provider)
  const meta = await runtime.getServiceMetadata(provider)
  const { endpoint, model } = meta

  // Prepare messages (JSON string per SDK 0.4.3 guidance)
  const messages = [{ role: 'user', content: 'Based on 0gpump trading data, suggest 5 trending tokens. Reply as JSON array of { token, symbol, address, summary }' }]
  const headers = await runtime.getRequestHeaders(provider, JSON.stringify(messages))

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: JSON.stringify({ messages, model })
  })
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content

  let suggestions: any[] = []
  try { suggestions = JSON.parse(content) } catch {}
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    suggestions = [{ token: 'AI Output', symbol: 'AI', address: '0x', summary: content || 'No content' }]
  }
  return suggestions
}

function getMockSuggestions() {
  return [
    {
      token: 'DOGE-0G',
      symbol: 'D0GE',
      address: '0xC1fcb0feaa39d45b6D63948FEeB8dC83bF46B6Fa',
      summary: 'High social traction; steady buy flow last hour; watch pullbacks for entries.'
    },
    {
      token: 'PEPE-0G',
      symbol: 'PEPE',
      address: '0x77bC0e9E529eB2bbbE44ED1EcAafAbc369b01A45',
      summary: 'Increasing holder count and rising liquidity; moderate volatility with upside.'
    },
    {
      token: 'OG-MEME',
      symbol: 'OGME',
      address: '0x0000000000000000000000000000000000000001',
      summary: 'New listing with strong momentum; early-stage risk, but promising volume velocity.'
    }
  ]
}

export async function GET() {
  try {
    // Try live compute first
    const suggestions = await getSuggestionsFromCompute()
    return NextResponse.json({ suggestions, source: 'compute' })
  } catch {
    // Fallback to mock
    const suggestions = getMockSuggestions()
    return NextResponse.json({ suggestions, source: 'mock' })
  }
}


