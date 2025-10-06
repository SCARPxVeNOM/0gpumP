'use client'
import { useState, useEffect } from 'react'
import { ethers, BrowserProvider } from 'ethers'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, usePublicClient } from 'wagmi'
import OGImageUploader from './OGImageUploader'
import { ogStorageSDK } from '../../lib/0gStorageSDK'
import { newFactoryService } from '../../lib/newFactoryService'

interface TokenCreatorModalProps {
  isOpen: boolean
  onClose: () => void
  onTokenCreated?: (tokenData: any) => void
}

export default function TokenCreatorModal({ isOpen, onClose, onTokenCreated }: TokenCreatorModalProps) {
  const { isConnected, address } = useAccount()
  const publicClient = usePublicClient()
  
  // New bonding curve factory configuration
  const FACTORY_ADDRESS = '0x560C7439E28359E2E8C0D72A52e8b5d6645766e7'
  const ROUTER_ADDRESS = '0x6738b8c52d4C695cc92D83cfE90B00e9C9F56659'
  const WETH_ADDRESS = '0xf1c1d5E1c79B693AE7b674b8254A8A62314296fB'
  
  // New bonding curve system - fixed parameters for immediate trading
  
  // Token creation state
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
  const [creationResult, setCreationResult] = useState<any>(null)
  
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
    setTxHash('')
    setDescription('')
    setCreationResult(null)
    
    // Reset social media URLs
    setTelegramUrl('')
    setXUrl('')
    setDiscordUrl('')
    setWebsiteUrl('')
    
    // New bonding curve system uses fixed parameters
  }

  useEffect(() => {
    if (!isOpen) {
      resetForm()
    }
  }, [isOpen])

  // Initialize services when modal opens
  useEffect(() => {
    if (isOpen && isConnected) {
      try {
        const eth = (typeof window !== 'undefined') ? (window as any).ethereum : undefined
        if (!eth) return
        const provider = new BrowserProvider(eth)
        // Ensure signer is available (RainbowKit already connects, but this is safe)
        provider.send('eth_requestAccounts', []).catch(() => {})
        newFactoryService.initialize(provider, FACTORY_ADDRESS)
      } catch {}
    }
  }, [isOpen, isConnected])

  const handleCreate = async () => {
    setIsCreating(true)
    setError(null)
    setStatus('')
    setTxHash('')

    try {
      if (!address) throw new Error('Wallet not connected')

      let finalImageHash = ''

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
        // Social links
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

      // Simple retry wrapper for unstable backends
      const fetchWithRetry = async (attempts: number): Promise<Response> => {
        let lastErr: any = null
        for (let i = 0; i < attempts; i++) {
          try {
            const backendBase = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'
            const r = await fetch(`${backendBase}/createCoin`, { method: 'POST', body: form })
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

      setStatus('Creating token with bonding curve on 0G Chain (this may take 30-60 seconds)...')
      
      // Create token using new bonding curve mechanism
      const result = await newFactoryService.createPair({
        name,
        symbol,
        seedTokenAmount: supply.replace(/_/g, ''),
        seedOgAmount: '0.5' // Default seed amount - can be made configurable
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to create token')
      }

      // Resolve token/curve addresses if missing (receipt logs delayed)
      let tokenAddr = result.tokenAddress
      let curveAddr = result.curveAddress
      if (!tokenAddr || !curveAddr) {
        try {
          const backendBase = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'
          const respResolve = await fetch(`${backendBase}/resolvePair`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              txHash: result.txHash,
              creator: address,
              factory: FACTORY_ADDRESS
            })
          })
          if (respResolve.ok) {
            const rj = await respResolve.json()
            tokenAddr = rj.tokenAddress || tokenAddr
            curveAddr = rj.curveAddress || curveAddr
          }
        } catch (e) {
          console.warn('resolvePair failed:', e)
        }
      }

      setCreationResult({ ...result, tokenAddress: tokenAddr, curveAddress: curveAddr })
      setTxHash(result.txHash || 'Transaction submitted')
      setStatus('✅ Token created successfully! Transaction confirmed on 0G Chain.')
      setSuccess(true)

      const tokenData = {
        name,
        symbol,
        supply: supply.replace(/_/g, ''),
        imageHash: finalImageHash,
        tokenAddress: tokenAddr || undefined,
        curveAddress: curveAddr || undefined,
        txHash: result.txHash || 'Transaction submitted',
        description: meta.description,
        metadataRootHash,
        // Social links
        telegramUrl: telegramUrl || undefined,
        xUrl: xUrl || undefined,
        discordUrl: discordUrl || undefined,
        websiteUrl: websiteUrl || undefined
      }

      if (onTokenCreated) onTokenCreated(tokenData)

      // Add token to user's profile
      try {
        if (address) {
          const backendBase = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'
          await fetch(`${backendBase}/profile/${address}/tokens`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tokenAddress: tokenAddr,
              tokenName: name,
              tokenSymbol: symbol,
              curveAddress: curveAddr,
              txHash: result.txHash,
              imageUrl: finalImageHash ? `${backendBase}/download/${finalImageHash}` : undefined,
              description: meta.description
            })
          })
        }
      } catch (profileError) {
        console.warn('Failed to add token to profile:', profileError)
        // Don't fail the entire creation process for profile errors
      }
      
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
            <Card className="bg-sky-100 text-slate-900 border-4 border-black shadow-[8px_8px_0_#000] rounded-2xl">
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-extrabold">
                    Create New Token with New Bonding Curve
                  </CardTitle>
                  <Button
                    variant="secondary"
                    onClick={onClose}
                    className="border-4 border-black bg-white text-slate-900 shadow-[4px_4px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                   <p className="text-slate-700 text-sm">
                     Create your own memecoin on 0G Chain with immediate trading via new bonding curve system
                   </p>
                   <ConnectButton />
                 </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left column - Token details */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-extrabold text-slate-900 mb-2 block">
                        Token Name
                      </label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="PEPEMAX"
                        className="bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-extrabold text-slate-900 mb-2 block">
                        Symbol
                      </label>
                      <Input
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        placeholder="PEPE"
                        className="bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-extrabold text-slate-900 mb-2 block">
                        Initial Supply
                      </label>
                      <Input
                        value={supply}
                        onChange={(e) => setSupply(e.target.value)}
                        placeholder="1_000_000"
                        className="bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black"
                      />
                      <p className="text-xs text-slate-700 mt-1">
                        Use underscores for readability (e.g., 1_000_000)
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-extrabold text-slate-900 mb-2 block">
                        Description
                      </label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your memecoin..."
                        className="bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black"
                      />
                      <p className="text-xs text-slate-700 mt-1">
                        Tell people what your coin is about
                      </p>
                    </div>

                    {/* Social Media URLs */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-extrabold text-slate-900">Social Media (Optional)</h4>
                      
                      <div>
                        <label className="text-xs text-slate-900 mb-1 block font-bold">Telegram</label>
                        <Input
                          value={telegramUrl}
                          onChange={(e) => setTelegramUrl(e.target.value)}
                          placeholder="https://t.me/yourgroup"
                          className="bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-900 mb-1 block font-bold">X (Twitter)</label>
                        <Input
                          value={xUrl}
                          onChange={(e) => setXUrl(e.target.value)}
                          placeholder="https://x.com/yourhandle"
                          className="bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-900 mb-1 block font-bold">Discord</label>
                        <Input
                          value={discordUrl}
                          onChange={(e) => setDiscordUrl(e.target.value)}
                          placeholder="https://discord.gg/invitecode"
                          className="bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-900 mb-1 block font-bold">Website</label>
                        <Input
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          placeholder="https://yourwebsite.com"
                          className="bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right column - Image upload and bonding curve settings */}
                  <div className="space-y-4">
                    <div>
                       <label className="text-sm font-extrabold text-slate-900 mb-2 block">
                         Token Icon <span className="text-red-400">*</span>
                       </label>
                       <p className="text-xs text-slate-700 mb-3">
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
                      <div className="bg-white rounded-lg p-3 text-xs text-slate-900 border-4 border-black shadow-[4px_4px_0_#000]">
                        <div className="font-medium mb-2">Image will be stored on:</div>
                        <div className="space-y-1">
                          <div>• 0G Storage Network</div>
                          <div>• Decentralized & Immutable</div>
                          <div>• Merkle tree verification</div>
                          <div>• Censorship resistant</div>
                        </div>
                      </div>
                    )}

                    {/* New Bonding Curve System */}
                    <div className="bg-white rounded-lg p-4 border-4 border-black shadow-[4px_4px_0_#000]">
                      <h4 className="text-sm font-extrabold text-slate-900 mb-3">🚀 New Bonding Curve System</h4>
                      <div className="text-xs text-slate-900 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-green-400">✅</span>
                          <span>Immediate Trading Available</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400">📊</span>
                          <span>Constant-Product AMM (x * y = k)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-purple-400">💰</span>
                          <span>Fee: 0.5% (50 bps)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400">⚡</span>
                          <span>Automatic Liquidity Seeding</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-cyan-400">🔒</span>
                          <span>Secure & Audited Contracts</span>
                        </div>
                      </div>
                      <div className="mt-3 p-2 bg-sky-100 rounded text-xs text-slate-900 border-2 border-black">
                        <div className="font-medium mb-1">How it works:</div>
                        <div>1. Create token with initial supply</div>
                        <div>2. System automatically seeds 0.5 0G liquidity</div>
                        <div>3. Trading starts immediately with bonding curve</div>
                        <div>4. Price adjusts dynamically with each trade</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status messages */}
                {status && (
                  <div className="flex items-center gap-3 p-3 bg-blue-200 border-4 border-black rounded-2xl shadow-[4px_4px_0_#000]">
                    <CheckCircle className="w-5 h-5 text-blue-700" />
                    <span className="text-sm text-slate-900">{status}</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-3 p-3 bg-red-200 border-4 border-black rounded-2xl shadow-[4px_4px_0_#000]">
                    <AlertCircle className="w-5 h-5 text-red-700" />
                    <span className="text-sm text-red-800">{error}</span>
                  </div>
                )}

                {success && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-green-300">Token created successfully with new bonding curve system!</span>
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
                    
                    {/* Token and Curve Addresses for Trading */}
                    {creationResult?.tokenAddress && creationResult?.curveAddress && (
                      <div className="text-sm space-y-2">
                        <div>
                          <span className="text-slate-400">Token Address: </span>
                          <span className="font-mono text-green-400 text-xs">{creationResult.tokenAddress}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Curve Address: </span>
                          <span className="font-mono text-blue-400 text-xs">{creationResult.curveAddress}</span>
                        </div>
                        <div className="mt-3 p-2 bg-green-500/20 border border-green-500/30 rounded text-xs text-green-300">
                          🎯 <strong>Ready for Trading!</strong> Your token now has immediate liquidity and can be traded on the bonding curve.
                        </div>
                        <div className="mt-2 p-2 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-300">
                          💡 <strong>Next Steps:</strong> Users can now buy/sell your token immediately using the bonding curve. No need to wait for liquidity!
                        </div>
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
                        className="flex-1 bg-yellow-300 text-slate-900 border-4 border-black shadow-[6px_6px_0_#000] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0_#000]"
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
                              Create Token with New Bonding Curve
                            </>
                        )}
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={isCreating}
                        className="border-4 border-black bg-white text-slate-900 shadow-[4px_4px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
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
                        className="flex-1 bg-green-400 text-slate-900 border-4 border-black shadow-[6px_6px_0_#000] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0_#000]"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Another Token
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={onClose}
                        className="border-4 border-black bg-white text-slate-900 shadow-[4px_4px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
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
