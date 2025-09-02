const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy Factory with treasury = deployer and 0.5% fee
  const Factory = await ethers.getContractFactory("Factory");
  const factory = await Factory.deploy(deployer.address, 50); // 50 bps = 0.5%
  await factory.deployed();

  console.log("Factory deployed to:", factory.address);
  console.log("Treasury:", deployer.address);
  console.log("Default fee:", "0.5%");

  // Save deployment info
  const deploymentInfo = {
    factory: factory.address,
    treasury: deployer.address,
    defaultFeeBps: 50,
    network: "0G Testnet",
    deployer: deployer.address
  };

  console.log("\nDeployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n✅ New bonding curve system deployed successfully!");
  console.log("🔗 Factory:", factory.address);
  console.log("💰 Treasury:", deployer.address);
  console.log("📊 Fee: 0.5%");
  console.log("\nNext steps:");
  console.log("1. Update your frontend with the new factory address");
  console.log("2. Test creating a token with createPair()");
  console.log("3. Users can now trade immediately after token creation!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
