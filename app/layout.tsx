import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import Script from 'next/script'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '0G Pump - Memetoken Trading Platform',
  description: 'Trade memetokens and custom tokens on the 0G Chain. Fast, secure, and AI-powered trading platform.',
  keywords: 'memetokens, trading, 0G, blockchain, DeFi, AI trading',
  authors: [{ name: '0G Pump Team' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Lit runtime optimization script */}
        <Script
          id="lit-optimization"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress Lit development mode warnings
              if (typeof console !== 'undefined' && console.warn) {
                const originalWarn = console.warn;
                console.warn = function(...args) {
                  if (args[0] && typeof args[0] === 'string' && args[0].includes('Lit is in dev mode')) {
                    return;
                  }
                  originalWarn.apply(console, args);
                };
              }
              
              // Set global Lit configuration
              if (typeof window !== 'undefined') {
                window.__LIT_DEV_MODE__ = '${process.env.NODE_ENV === 'development' ? 'true' : 'false'}';
              }
            `
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}

