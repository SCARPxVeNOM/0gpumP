import { useAccount, useWalletClient } from 'wagmi'
import { useMemo } from 'react'
import { BrowserProvider } from 'ethers'

export const useEthersSigner = () => {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  return useMemo(() => {
    if (!walletClient || !address) return undefined
    
    const provider = new BrowserProvider(walletClient)
    return provider.getSigner()
  }, [walletClient, address])
}
