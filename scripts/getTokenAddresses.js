const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Finding Your Token Addresses on 0G Testnet...");
  
  // Connect to 0G testnet
  const provider = new ethers.providers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
  
  // Your wallet address (derived from private key)
  const privateKey = "8c6f10acb86aeab293bd60bcf7d0e69f70643f8d219b81b6665885844abc3a9c";
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("Wallet address:", wallet.address);
  console.log("Balance:", ethers.utils.formatEther(await wallet.getBalance()), "0G");
  
  // Check recent transactions to find token deployments
  console.log("\n🔍 Checking recent transactions for token deployments...");
  
  try {
    // Get recent transactions
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);
    
    console.log(`Latest block: ${blockNumber}`);
    console.log(`Block timestamp: ${new Date(block.timestamp * 1000).toLocaleString()}`);
    
    // You can also check specific blocks for token creation events
    console.log("\n💡 To find your token addresses:");
    console.log("1. Go to https://chainscan-galileo.0g.ai");
    console.log("2. Search for your wallet address:", wallet.address);
    console.log("3. Look for 'Contract Creation' transactions");
    console.log("4. Copy the contract addresses");
    
    console.log("\n📝 Then update scripts/enableTrading.js with the real addresses:");
    console.log("Replace the placeholder addresses in TOKENS_TO_ENABLE array");
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
