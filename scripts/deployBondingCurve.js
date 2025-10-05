const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying Bonding Curve contracts...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);

  // Deploy TokenFactory first
  console.log("🏭 Deploying TokenFactory...");
  const TokenFactory = await ethers.getContractFactory("TokenFactory");
  
  // Set fee recipient (can be deployer for now)
  const feeRecipient = deployer.address;
  const tokenFactory = await TokenFactory.deploy(feeRecipient);
  await tokenFactory.deployed();
  
  console.log("✅ TokenFactory deployed to:", tokenFactory.address);

  // Deploy a sample bonding curve to test
  console.log("📈 Deploying sample BondingCurveAMM...");
  const BondingCurveAMM = await ethers.getContractFactory("BondingCurveAMM");
  
  // Sample curve parameters
  const name = "Sample Token";
  const symbol = "SMPL";
  const basePrice = ethers.utils.parseEther("0.001"); // 0.001 0G
  const stepSize = ethers.utils.parseEther("0.000001"); // 0.000001 0G per step
  const stepQty = 1000; // 1000 tokens per step
  const curveCap = 1000000; // 1M total tokens
  const feeBps = 500; // 5% fee
  
  const sampleCurve = await BondingCurveAMM.deploy(
    name,
    symbol,
    basePrice,
    stepSize,
    stepQty,
    curveCap,
    feeBps,
    feeRecipient
  );
  await sampleCurve.deployed();
  
  console.log("✅ Sample BondingCurveAMM deployed to:", sampleCurve.address);
  console.log("✅ Sample token deployed to:", sampleCurve.token());

  // Save deployment info
  const deploymentInfo = {
    network: "0g-galileo-testnet",
    deployer: deployer.address,
    contracts: {
      TokenFactory: {
        address: tokenFactory.address,
        feeRecipient: feeRecipient
      },
      SampleBondingCurve: {
        address: sampleCurve.address,
        token: sampleCurve.token(),
        name: name,
        symbol: symbol,
        basePrice: ethers.utils.formatEther(basePrice),
        stepSize: ethers.utils.formatEther(stepSize),
        stepQty: stepQty,
        curveCap: curveCap,
        feeBps: feeBps
      }
    },
    timestamp: new Date().toISOString()
  };

  // Write deployment info to file
  const fs = require("fs");
  fs.writeFileSync(
    "bonding-curve-deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("📄 Deployment info saved to bonding-curve-deployment.json");

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  
  try {
    // Check TokenFactory
    const factoryOwner = await tokenFactory.owner();
    console.log("✅ TokenFactory owner:", factoryOwner);
    
    // Check sample curve
    const curveOwner = await sampleCurve.owner();
    const curveToken = await sampleCurve.token();
    const curveBasePrice = await sampleCurve.basePrice();
    
    console.log("✅ Sample curve owner:", curveOwner);
    console.log("✅ Sample curve token:", curveToken);
    console.log("✅ Sample curve base price:", ethers.utils.formatEther(curveBasePrice), "0G");
    
    console.log("\n🎉 All contracts deployed successfully!");
    console.log("\n📋 Next steps:");
    console.log("1. Update your frontend with TokenFactory address:", tokenFactory.address);
    console.log("2. Test token creation with createToken() function");
    console.log("3. Test trading on the sample curve");
    console.log("4. Deploy more curves for different tokens");
    
  } catch (error) {
    console.error("❌ Verification failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
