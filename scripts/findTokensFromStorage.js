const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function findTokensFromStorage() {
  console.log("🔍 Finding tokens from 0G Storage...\n");

  try {
    // Check if backend is running
    console.log("1️⃣ Checking backend server...");
    try {
      const healthResponse = await axios.get('http://localhost:4000/health');
      console.log("✅ Backend server is running");
    } catch (error) {
      console.log("❌ Backend server not running. Please start it with: npm run dev:backend");
      return;
    }

    // Check if 0G Storage is running
    console.log("\n2️⃣ Checking 0G Storage...");
    try {
      const storageResponse = await axios.get('http://localhost:3000/api-docs');
      console.log("✅ 0G Storage is running");
    } catch (error) {
      console.log("❌ 0G Storage not running. Please start it with: npm run dev:kit");
      return;
    }

    // Check cache directory for stored files
    console.log("\n3️⃣ Checking cache for stored files...");
    const cacheDir = path.join(__dirname, '../cache');
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      console.log(`📁 Found ${jsonFiles.length} cached files`);
      
      // Look for metadata files
      const metadataFiles = [];
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(cacheDir, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          // Check if this looks like coin metadata
          if (content.type === 'coin-metadata' || 
              (content.name && content.symbol && content.creator)) {
            metadataFiles.push({
              file,
              content,
              hash: file.replace('.json', '')
            });
          }
        } catch (error) {
          // Skip files that can't be parsed
        }
      }
      
      if (metadataFiles.length > 0) {
        console.log(`\n🎯 Found ${metadataFiles.length} potential coin metadata files:`);
        metadataFiles.forEach((metadata, index) => {
          console.log(`\n   ${index + 1}. ${metadata.content.name} (${metadata.content.symbol})`);
          console.log(`      Creator: ${metadata.content.creator}`);
          console.log(`      Hash: ${metadata.hash}`);
          console.log(`      Created: ${metadata.content.createdAt}`);
          if (metadata.content.imageRootHash) {
            console.log(`      Image: ${metadata.content.imageRootHash}`);
          }
        });
        
        // Check if any of these have been deployed as tokens
        console.log("\n4️⃣ Checking for deployed token contracts...");
        const walletAddress = "0x2dC274ABC0df37647CEd9212e751524708a68996";
        
        for (const metadata of metadataFiles) {
          console.log(`\n   Checking ${metadata.content.symbol}...`);
          
          // Try to find the token contract address
          // This would require scanning blockchain or checking deployment records
          console.log(`   💡 To find the actual token address for ${metadata.content.symbol}:`);
          console.log(`      1. Go to https://chainscan-galileo.0g.ai`);
          console.log(`      2. Search for your wallet: ${walletAddress}`);
          console.log(`      3. Look for 'Contract Creation' transactions`);
          console.log(`      4. Find the transaction that created ${metadata.content.symbol}`);
        }
        
      } else {
        console.log("   No coin metadata found in cache");
      }
    } else {
      console.log("   Cache directory not found");
    }

    // Check if there are any deployment records
    console.log("\n5️⃣ Checking deployment records...");
    const deploymentFiles = [
      'deployment-config.json',
      'deployments/ogtoken-0g-testnet.json'
    ];
    
    for (const file of deploymentFiles) {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          console.log(`📄 Found deployment file: ${file}`);
          console.log(`   Content:`, JSON.stringify(content, null, 2));
        } catch (error) {
          console.log(`   Error reading ${file}: ${error.message}`);
        }
      }
    }

    console.log("\n💡 Next Steps:");
    console.log("1. If you found metadata files above, you need to find their token addresses");
    console.log("2. Update data/coins.json with the real token addresses");
    console.log("3. Run: npm run setup:from-storage to enable trading");
    console.log("4. Or manually add token addresses to the automated setup script");

  } catch (error) {
    console.error("❌ Error finding tokens:", error.message);
  }
}

findTokensFromStorage();
