require('dotenv').config();
const { ethers, network } = require("hardhat");

async function main() {
  console.log("🚀 Deploying OGToken with 0G Storage integration...");

  const RPC_URL = "https://evmrpc-testnet.0g.ai";
  const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is not set in .env");
  }

  // Create provider and signer explicitly (avoid relying on HH accounts)
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  // Get the contract factory connected to our signer
  const OGToken = await ethers.getContractFactory("OGToken", signer);

  // Contract constructor parameters
  const name = "0G Storage Token";
  const symbol = "0GST";
  const initialSupply = ethers.utils.parseEther("1000000"); // 1 million tokens
  const description = "A token demonstrating 0G Storage integration";
  
  // Placeholder root hashes (these will be updated after actual uploads)
  const metadataRootHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const imageRootHash = "0x0000000000000000000000000000000000000000000000000000000000000000";

  console.log(`👤 Deployer: ${signer.address}`);

  // Deploy the contract
  const ogToken = await OGToken.deploy(
    name,
    symbol,
    initialSupply,
    description,
    metadataRootHash,
    imageRootHash
  );

  await ogToken.deployed();

  console.log("✅ OGToken deployed successfully!");
  console.log(`📍 Contract Address: ${ogToken.address}`);
  console.log(`🔗 Network: ${network.name}`);

  // Verify deployment
  const deployedName = await ogToken.name();
  const deployedSymbol = await ogToken.symbol();
  const deployedSupply = await ogToken.totalSupply();
  const deployedCreator = await ogToken.creator();

  console.log("\n📊 Deployment Verification:");
  console.log(`   Name: ${deployedName}`);
  console.log(`   Symbol: ${deployedSymbol}`);
  console.log(`   Total Supply: ${ethers.utils.formatEther(deployedSupply)} tokens`);
  console.log(`   Creator: ${deployedCreator}`);

  // Save deployment info
  const fs = require("fs");
  const path = require("path");
  const deploymentPath = path.join(__dirname, "../deployments");
  
  const deploymentInfo = {
    contractName: "OGToken",
    address: ogToken.address,
    network: network.name,
    deployer: (await ethers.getSigners())[0].address,
    constructorArgs: {
      name,
      symbol,
      initialSupply: initialSupply.toString(),
      description,
      metadataRootHash,
      imageRootHash
    },
    deploymentTime: new Date().toISOString(),
    blockNumber: ogToken.deployTransaction.blockNumber
  };

  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentPath, `ogtoken-${network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`\n💾 Deployment info saved to: deployments/ogtoken-${network.name}.json`);

  // Instructions for next steps
  console.log("\n🔗 Next Steps:");
  console.log("1. Update your frontend with the contract address:", ogToken.address);
  console.log("2. Use the updateMetadata function to set real 0G Storage root hashes");
  console.log("3. Test the contract functionality on the network");
  console.log("4. Consider verifying the contract on block explorers");

  return ogToken;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
