require('dotenv').config();
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying TokenFactory...");

  // Check if we have a private key
  if (!process.env.PRIVATE_KEY) {
    console.error("❌ PRIVATE_KEY not found in environment variables");
    console.log("Please set PRIVATE_KEY in your .env file");
    process.exit(1);
  }

  // Create wallet from private key
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
  console.log("📝 Deploying contracts with account:", wallet.address);

  // Get provider from hardhat config
  const provider = new ethers.providers.JsonRpcProvider(process.env.OG_CHAIN_RPC || 'https://evmrpc-testnet.0g.ai');
  const connectedWallet = wallet.connect(provider);

  // Deploy TokenFactory
  const TokenFactory = await ethers.getContractFactory("TokenFactory", connectedWallet);
  const tokenFactory = await TokenFactory.deploy(wallet.address); // Set wallet as fee recipient

  await tokenFactory.deployed();

  console.log("✅ TokenFactory deployed to:", tokenFactory.address);
  console.log("💰 Fee recipient:", wallet.address);

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  
  const owner = await tokenFactory.owner();
  const feeRecipient = await tokenFactory.feeRecipient();
  
  console.log("👑 Owner:", owner);
  console.log("💰 Fee recipient:", feeRecipient);
  console.log("📊 All tokens count:", (await tokenFactory.allTokens()).length);

  // Save deployment info
  const deploymentInfo = {
    network: '0g-galileo-testnet',
    tokenFactory: tokenFactory.address,
    owner: owner,
    feeRecipient: feeRecipient,
    deployedAt: new Date().toISOString(),
    deployer: wallet.address
  };

  console.log("\n📋 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require('fs');
  const deploymentPath = `deployments/token-factory-0g-galileo-testnet.json`;
  
  // Ensure deployments directory exists
  if (!fs.existsSync('deployments')) {
    fs.mkdirSync('deployments');
  }
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 Deployment info saved to: ${deploymentPath}`);

  // Instructions for next steps
  console.log("\n🎯 Next Steps:");
  console.log("1. Set FACTORY_ADDRESS in your .env file:");
  console.log(`   FACTORY_ADDRESS=${tokenFactory.address}`);
  console.log("\n2. Update your frontend to use the new TokenFactory");
  console.log("\n3. Start the enhanced indexer:");
  console.log("   node server/enhanced-indexer.js");
  console.log("\n4. Test token creation:");
  console.log("   - Upload metadata to 0G Storage");
  console.log("   - Call createTokenWithDefaults() with metadata URI");

  return tokenFactory;
}

// Handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
