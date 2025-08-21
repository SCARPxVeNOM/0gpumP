'use client'
import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { getDefaultWallets, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { publicProvider } from 'wagmi/providers/public'
import '@rainbow-me/rainbowkit/styles.css'

const ogTestnet = {
  id: 16601,
  name: '0G Testnet',
  network: '0g-testnet',
  nativeCurrency: { name: 'OG', symbol: 'OG', decimals: 18 },
  rpcUrls: { 
    default: { http: ['https://evmrpc-testnet.0g.ai'] },
    public: { http: ['https://evmrpc-testnet.0g.ai'] }
  },
  blockExplorers: { 
    default: { name: 'Explorer', url: 'https://chainscan-galileo.0g.ai' } 
  },
  testnet: true,
} as const

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [ogTestnet],
  [publicProvider()]
)

const { connectors } = getDefaultWallets({
  appName: '0G Meme Token Creator',
  projectId: 'a14234612450c639dd0adcbb729ddfd8',
  chains,
})

const config = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
})

const qc = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider theme={darkTheme({ overlayBlur: 'small' })} chains={chains}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
}

