import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

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
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}

