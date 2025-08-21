// Script to restore a previously created coin
// Run this with: node scripts/restore-coin.js

const fs = require('fs').promises
const path = require('path')

const STORAGE_FILE = path.join(process.cwd(), 'data', 'coins.json')

async function restoreCoin() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(STORAGE_FILE)
    try {
      await fs.access(dataDir)
    } catch {
      await fs.mkdir(dataDir, { recursive: true })
    }

    // Sample coin data (you can modify this)
    const sampleCoin = {
      id: "wow-1703123456789",
      name: "DOGEWOW",
      symbol: "WOW",
      supply: "1000000",
      imageHash: "0x1234...5678",
      tokenAddress: "0xSampleTokenAddress",
      txHash: "0xSampleTransactionHash",
      creator: "0xYourWalletAddress",
      createdAt: Date.now(),
      description: "DOGEWOW (WOW) - A memecoin created on 0G Chain"
    }

    // Load existing coins or create new array
    let existingCoins = []
    try {
      const data = await fs.readFile(STORAGE_FILE, 'utf-8')
      existingCoins = JSON.parse(data)
    } catch (error) {
      console.log('No existing coins found, starting fresh')
    }

    // Add the sample coin
    const updatedCoins = [sampleCoin, ...existingCoins]
    
    // Save to storage
    await fs.writeFile(STORAGE_FILE, JSON.stringify(updatedCoins, null, 2))
    
    console.log('✅ Coin restored successfully!')
    console.log('📊 Total coins in storage:', updatedCoins.length)
    console.log('🪙 Restored coin:', sampleCoin.name)
    console.log('📁 Storage file:', STORAGE_FILE)
    
  } catch (error) {
    console.error('❌ Failed to restore coin:', error)
  }
}

restoreCoin()










