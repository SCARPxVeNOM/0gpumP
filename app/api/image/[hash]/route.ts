import { NextRequest, NextResponse } from 'next/server'

// Proxy image download through Next API to avoid mixed content/CORS
export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  try {
    const hash = params.hash
    if (!hash) return new NextResponse('Missing image hash', { status: 400 })

    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
    const url = `${backendBase}/download/${encodeURIComponent(hash)}`

    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      return new NextResponse('Image not found', { status: res.status })
    }

    // Stream the body back with content-type/length if provided
    const headers: Record<string, string> = {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
    const ct = res.headers.get('content-type')
    const cl = res.headers.get('content-length')
    if (ct) headers['Content-Type'] = ct
    if (cl) headers['Content-Length'] = cl

    const buffer = Buffer.from(await res.arrayBuffer())
    return new NextResponse(buffer, { headers })
  } catch (error) {
    console.error('Error proxying image:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
