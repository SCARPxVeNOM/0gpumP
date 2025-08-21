'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useContractWrite } from 'wagmi'
import { parseUnits } from 'viem'
import OGImageUploader from './OGImageUploader'
import { ogStorageSDK } from '../../lib/0gStorageSDK'
import { TRADING_CONFIG } from '@/lib/trading-config'

interface TokenCreatorModalProps {
  isOpen: boolean
  onClose: () => void
  onTokenCreated?: (tokenData: any) => void
}

export default function TokenCreatorModal({ isOpen, onClose, onTokenCreated }: TokenCreatorModalProps) {
  const { isConnected, address } = useAccount()
  
  // Factory contract configuration
  const FACTORY_ADDRESS = '0x0Bd71a034D5602014206B965677E83C6484561F2' as `0x${string}`
  const OG_TOKEN_ADDRESS = '0x0A7697244d3402328c0258aa1171eee3317eCb4F' as `0x${string}`
  
  const { writeAsync, isLoading } = useContractWrite({
    address: FACTORY_ADDRESS,
    abi: [
      {
        "type": "function",
        "name": "createToken",
        "stateMutability": "nonpayable",
        "inputs": [
          { "name": "name_", "type": "string" },
          { "name": "symbol_", "type": "string" },
          { "name": "initialSupplyWei_", "type": "uint256" }
        ],
        "outputs": [{ "name": "token", "type": "address" }]
      },
      {
        "type": "event",
        "name": "TokenCreated",
        "inputs": [
          { "name": "token", "type": "address", "indexed": true },
          { "name": "owner", "type": "address", "indexed": true },
          { "name": "name", "type": "string", "indexed": false },
          { "name": "symbol", "type": "string", "indexed": false },
          { "name": "initialSupply", "type": "uint256", "indexed": false }
        ],
        "anonymous": false
      }
    ] as const,
    functionName: 'createToken',
  })

  const [name, setName] = useState('DOGEWOW')
  const [symbol, setSymbol] = useState('WOW')
  const [supply, setSupply] = useState('1_000_000')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [imageHash, setImageHash] = useState<string>('')
  const [txHash, setTxHash] = useState<string>('')
  const [description, setDescription] = useState('')
  
  // Social media URLs
  const [telegramUrl, setTelegramUrl] = useState('')
  const [xUrl, setXUrl] = useState('')
  const [discordUrl, setDiscordUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  const resetForm = () => {
    setName('DOGEWOW')
    setSymbol('WOW')
    setSupply('1_000_000')
    setSelectedImage(null)
    setIsCreating(false)
    setStatus('')
    setError(null)
    setSuccess(false)
    // Don't reset imageHash here - it needs to persist for token creation
    setTxHash('')
    setDescription('')
    
    // Reset social media URLs
    setTelegramUrl('')
    setXUrl('')
    setDiscordUrl('')
    setWebsiteUrl('')
  }

  useEffect(() => {
    if (!isOpen) {
      resetForm()
    }
  }, [isOpen])

  const handleCreate = async () => {
    setIsCreating(true)
    setError(null)
    setStatus('')
    // Don't reset imageHash here - it will be set during image upload
    setTxHash('')

    try {
      if (!FACTORY_ADDRESS) throw new Error('Missing NEXT_PUBLIC_FACTORY_ADDRESS')
      if (!address) throw new Error('Wallet not connected')

      let finalImageHash = '' // Store image hash here

      // Image should already be uploaded to 0G Storage via OGImageUploader
      if (selectedImage && imageHash) {
        finalImageHash = imageHash
        setStatus('Image ready from 0G Storage!')
      } else {
        setError('Please upload an image to 0G Storage first')
        setIsCreating(false)
        return
      }

      // Create metadata and store via backend so we get metadata root hash
      setStatus('Uploading metadata to 0G Storage...')
      const meta = {
        name,
        symbol,
        description: description || `${name} (${symbol}) - A memecoin created on 0G Chain`,
        supply: supply.replace(/_/g, ''),
        creator: address,
        imageRootHash: finalImageHash,
        createdAt: new Date().toISOString(),
        // Social links (stored in metadata as well)
        telegramUrl: telegramUrl || undefined,
        xUrl: xUrl || undefined,
        discordUrl: discordUrl || undefined,
        websiteUrl: websiteUrl || undefined
      }

      const form = new FormData()
      form.append('name', name)
      form.append('symbol', symbol)
      form.append('description', meta.description)
      form.append('supply', meta.supply)
      form.append('creator', meta.creator || '')
      form.append('imageRootHash', finalImageHash)
      // image already uploaded separately; metadata upload will still happen

      // simple retry wrapper for unstable backends
      const fetchWithRetry = async (attempts: number): Promise<Response> => {
        let lastErr: any = null
        for (let i = 0; i < attempts; i++) {
          try {
            const r = await fetch('http://localhost:4000/createCoin', { method: 'POST', body: form })
            if (r.ok) return r
            lastErr = await r.text()
          } catch (e: any) {
            lastErr = e
          }
          await new Promise(res => setTimeout(res, 500 * Math.pow(2, i)))
        }
        throw new Error(typeof lastErr === 'string' ? lastErr : (lastErr?.message || 'createCoin failed'))
      }

      const resp = await fetchWithRetry(3)
      const json = await resp.json()
      if (!resp.ok || !json.success) {
        throw new Error(json?.error || 'Failed to upload metadata to 0G')
      }

      const metadataRootHash = json.coin.metadataRootHash as string

      setStatus('Creating token on 0G Chain...')
      const wei = parseUnits(supply.replace(/_/g, ''), 18)
      const result = await writeAsync({ args: [name, symbol, wei] })

      setTxHash(result.hash)
      setStatus('Token created, waiting for confirmation...')
      const receipt = await (async () => {
        try {
          // @ts-ignore
          const { ethers } = await import('ethers')
          const provider = new ethers.providers.JsonRpcProvider('https://evmrpc-testnet.0g.ai')
          return await provider.waitForTransaction(result.hash)
        } catch {
          return null
        }
      })()

      // Try to decode TokenCreated from logs to get token address
      let deployedTokenAddress: string | null = null
      try {
        // Minimal iface for event decoding
        const { ethers } = await import('ethers')
        const iface = new ethers.utils.Interface([
          'event TokenCreated(address indexed token, address indexed owner, string name, string symbol, uint256 initialSupply)'
        ])
        const logs = (receipt?.logs || []) as any[]
        for (const l of logs) {
          try {
            const parsed = iface.parseLog(l)
            if (parsed?.name === 'TokenCreated') {
              deployedTokenAddress = parsed.args?.token
              break
            }
          } catch {}
        }
      } catch {}

      setStatus('Updating metadata on-chain...')
      setSuccess(true)

      try {
        // Minimal ABI for updateMetadata
        const updateAbi = [{
          type: 'function',
          name: 'updateMetadata',
          stateMutability: 'nonpayable',
          inputs: [
            { name: '_description', type: 'string' },
            { name: '_metadataRootHash', type: 'bytes32' },
            { name: '_imageRootHash', type: 'bytes32' }
          ],
          outputs: []
        }] as const
        const { ethers } = await import('ethers')
        // @ts-ignore
        const web3Provider = new ethers.providers.Web3Provider((window as any).ethereum)
        const signer = web3Provider.getSigner()
        const targetAddress = (deployedTokenAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`
        if (deployedTokenAddress) {
          const token = new ethers.Contract(targetAddress, updateAbi, signer)
          const tx = await token.updateMetadata(meta.description, metadataRootHash, finalImageHash)
          await tx.wait()
        } else {
          console.warn('Token address not found in receipt; skipping updateMetadata')
        }
      } catch (e) {
        console.warn('updateMetadata failed:', e)
      }

      // Attempt to automatically enable trading (create pair + add liquidity)
      try {
        if (deployedTokenAddress) {
          setStatus('Approving tokens for initial liquidity...')
          const { ethers } = await import('ethers')
          // @ts-ignore
          const web3Provider = new ethers.providers.Web3Provider((window as any).ethereum)
          const signer = web3Provider.getSigner()

          const tokenAmountToSeed = ethers.utils.parseEther('100000') // 100k tokens
          const ethAmountToSeed = ethers.utils.parseEther('0.1')     // 0.1 0G

          // Approve AutoTradingFactory to pull tokens
          const erc20Abi = ['function approve(address spender, uint256 amount) public returns (bool)'] as const
          const tokenForApprove = new ethers.Contract(deployedTokenAddress as `0x${string}`, erc20Abi, signer)
          await (await tokenForApprove.approve(TRADING_CONFIG.AUTO_TRADING_FACTORY_ADDRESS, tokenAmountToSeed)).wait()

          setStatus('Creating liquidity pool and adding initial liquidity...')
          const factoryAbi = ['function enableTradingForToken(address token,uint256 tokenAmount,uint256 ethAmount) external payable returns (address pair)'] as const
          const atf = new ethers.Contract(TRADING_CONFIG.AUTO_TRADING_FACTORY_ADDRESS as `0x${string}`, factoryAbi, signer)
          const txEnable = await atf.enableTradingForToken(
            deployedTokenAddress,
            tokenAmountToSeed,
            ethAmountToSeed,
            { value: ethAmountToSeed }
          )
          await txEnable.wait()
          setStatus('Trading enabled! Pair created and liquidity added.')
        }
      } catch (e) {
        console.warn('Auto-trading enable failed (skipping):', e)
      }

      const tokenData = {
        name,
        symbol,
        supply: supply.replace(/_/g, ''),
        imageHash: finalImageHash,
        tokenAddress: deployedTokenAddress || undefined,
        txHash: result.hash,
        description: meta.description,
        metadataRootHash,
        // Bubble social links up to parent so they can be saved in the DB
        telegramUrl: telegramUrl || undefined,
        xUrl: xUrl || undefined,
        discordUrl: discordUrl || undefined,
        websiteUrl: websiteUrl || undefined
      }

      if (onTokenCreated) onTokenCreated(tokenData)

      // Don't close the modal - let user see the results and potentially create more tokens
      // The modal will stay open showing the success message and transaction details
      
    } catch (err: any) { 
      setError(err.message ?? String(err))
      setStatus('')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="bg-slate-800/90 backdrop-blur-xl border-slate-700/50 shadow-2xl">
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    Create New Token
                  </CardTitle>
                                                        <Button
                     variant="secondary"
                     onClick={onClose}
                     className="text-slate-400 hover:text-white"
                   >
                     <X className="w-5 h-5" />
                   </Button>
                </div>
                                 <div className="flex items-center justify-between">
                   <p className="text-slate-400 text-sm">
                     Create your own memecoin on 0G Chain with custom images stored on 0G Storage
                   </p>
                   <ConnectButton />
                 </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left column - Token details */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-300 mb-2 block">
                        Token Name
                      </label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="PEPEMAX"
                        className="bg-slate-700/60 border-slate-600/50 focus:border-purple-500/50"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-300 mb-2 block">
                        Symbol
                      </label>
                      <Input
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        placeholder="PEPE"
                        className="bg-slate-700/60 border-slate-600/50 focus:border-purple-500/50"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-300 mb-2 block">
                        Initial Supply
                      </label>
                      <Input
                        value={supply}
                        onChange={(e) => setSupply(e.target.value)}
                        placeholder="1_000_000"
                        className="bg-slate-700/60 border-slate-600/50 focus:border-purple-500/50"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Use underscores for readability (e.g., 1_000_000)
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-300 mb-2 block">
                        Description
                      </label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your memecoin..."
                        className="bg-slate-700/60 border-slate-600/50 focus:border-purple-500/50"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Tell people what your coin is about
                      </p>
                    </div>

                    {/* Social Media URLs */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-slate-300">Social Media (Optional)</h4>
                      
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Telegram</label>
                        <Input
                          value={telegramUrl}
                          onChange={(e) => setTelegramUrl(e.target.value)}
                          placeholder="https://t.me/yourgroup"
                          className="bg-slate-700/60 border-slate-600/50 focus:border-purple-500/50 text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">X (Twitter)</label>
                        <Input
                          value={xUrl}
                          onChange={(e) => setXUrl(e.target.value)}
                          placeholder="https://x.com/yourhandle"
                          className="bg-slate-700/60 border-slate-600/50 focus:border-purple-500/50 text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Discord</label>
                        <Input
                          value={discordUrl}
                          onChange={(e) => setDiscordUrl(e.target.value)}
                          placeholder="https://discord.gg/invitecode"
                          className="bg-slate-700/60 border-slate-600/50 focus:border-purple-500/50 text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Website</label>
                        <Input
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          placeholder="https://yourwebsite.com"
                          className="bg-slate-700/60 border-slate-600/50 focus:border-purple-500/50 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right column - Image upload */}
                  <div className="space-y-4">
                                         <div>
                       <label className="text-sm font-medium text-slate-300 mb-2 block">
                         Token Icon <span className="text-red-400">*</span>
                       </label>
                       <p className="text-xs text-slate-500 mb-3">
                         Upload an image to 0G Storage (required)
                       </p>
                       <OGImageUploader
                         onImageUploaded={(cid, file) => {
                           setSelectedImage(file);
                           setImageHash(cid);
                         }}
                       />
                     </div>

                    {selectedImage && (
                      <div className="bg-slate-700/40 rounded-lg p-3 text-xs text-slate-300">
                        <div className="font-medium mb-2">Image will be stored on:</div>
                        <div className="space-y-1">
                          <div>• 0G Storage Network</div>
                          <div>• Decentralized & Immutable</div>
                          <div>• Merkle tree verification</div>
                          <div>• Censorship resistant</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status messages */}
                {status && (
                  <div className="flex items-center gap-3 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-blue-400" />
                    <span className="text-sm text-blue-300">{status}</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-sm text-red-300">{error}</span>
                  </div>
                )}

                                 {success && (
                   <div className="space-y-3">
                     <div className="flex items-center gap-3 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                       <CheckCircle className="w-5 h-5 text-green-400" />
                       <span className="text-sm text-green-300">Token created successfully!</span>
                     </div>
                     {txHash && (
                       <div className="text-sm">
                         <span className="text-slate-400">Transaction: </span>
                                                   <a 
                            target="_blank" 
                            rel="noreferrer" 
                            className="underline text-blue-400 hover:text-blue-300" 
                            href={`https://chainscan-galileo.0g.ai/tx/${txHash}`}
                          >
                           {txHash}
                         </a>
                       </div>
                     )}
                     {imageHash && (
                       <div className="text-sm">
                         <span className="text-slate-400">Image stored on 0G Storage: </span>
                         <span className="font-mono text-blue-400">{imageHash}</span>
                       </div>
                     )}
                     
                     {/* Social Media URLs Added */}
                     {(telegramUrl || xUrl || discordUrl || websiteUrl) && (
                       <div className="text-sm">
                         <span className="text-slate-400">Social Media Added: </span>
                         <div className="flex flex-wrap gap-2 mt-1">
                           {telegramUrl && (
                             <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                               <span className="text-xs">📱 Telegram</span>
                             </Badge>
                           )}
                           {xUrl && (
                             <Badge className="bg-black/20 text-slate-300 border-slate-500/30">
                               <span className="text-xs">🐦 X (Twitter)</span>
                             </Badge>
                           )}
                           {discordUrl && (
                             <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                               <span className="text-xs">🎮 Discord</span>
                             </Badge>
                           )}
                           {websiteUrl && (
                             <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                               <span className="text-xs">🌐 Website</span>
                             </Badge>
                           )}
                         </div>
                       </div>
                     )}
                   </div>
                 )}

                                 {/* Action buttons */}
                 <div className="flex gap-3 pt-4">
                   {!success ? (
                     <>
                       <Button
                         onClick={handleCreate}
                         disabled={isCreating || !name || !symbol || !supply || !isConnected || !selectedImage}
                         className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold"
                       >
                         {!isConnected ? (
                           <>
                             <Plus className="w-4 h-4 mr-2" />
                             Connect Wallet First
                           </>
                         ) : !selectedImage ? (
                           <>
                             <Upload className="w-4 h-4 mr-2" />
                             Select Image First
                           </>
                         ) : isCreating ? (
                           <>
                             <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                             Creating Token...
                           </>
                         ) : (
                           <>
                             <Plus className="w-4 h-4 mr-2" />
                             Create Token
                           </>
                         )}
                       </Button>

                                                <Button
                           variant="secondary"
                           onClick={onClose}
                           disabled={isCreating}
                           className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50"
                         >
                           Cancel
                         </Button>
                     </>
                   ) : (
                     <>
                       <Button
                         onClick={() => {
                           resetForm()
                           setSuccess(false)
                         }}
                         className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold"
                       >
                         <Plus className="w-4 h-4 mr-2" />
                         Create Another Token
                       </Button>

                                                <Button
                           variant="secondary"
                           onClick={onClose}
                           className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50"
                         >
                           Close
                         </Button>
                     </>
                   )}
                 </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
