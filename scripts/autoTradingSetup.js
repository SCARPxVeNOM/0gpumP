const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
  console.log("🚀 Setting up Automatic Trading for New Tokens...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy or get existing DEX contracts
  let factoryAddress, routerAddress, wethAddress;
  
  try {
    // Try to use existing addresses
    factoryAddress = "0x0Bd71a034D5602014206B965677E83C6484561F2";
    routerAddress = "0x61fa1e78d101Ff616db00fE9e296C3E292393c63";
    wethAddress = "0x9Ba2C58C733119d896256DA85b2EAdfFE74A657F";
    
    console.log("Using existing DEX addresses:");
    console.log("Factory:", factoryAddress);
    console.log("Router:", routerAddress);
    console.log("WETH:", wethAddress);
    
    // Verify contracts exist
    const factory = await ethers.getContractAt("UniswapV2Factory", factoryAddress);
    const router = await ethers.getContractAt("UniswapV2Router02", routerAddress);
    const weth = await ethers.getContractAt("WETH9", wethAddress);
    
    console.log("✅ DEX contracts verified!");
    
  } catch (error) {
    console.log("❌ DEX contracts not found. Deploying new ones...");
    
    // Deploy WETH
    console.log("\n📦 Deploying WETH...");
    const WETH = await ethers.getContractFactory("WETH9");
    const weth = await WETH.deploy();
    await weth.deployed();
    wethAddress = weth.address;
    console.log("WETH deployed to:", wethAddress);

    // Deploy Factory
    console.log("\n🏭 Deploying Factory...");
    const Factory = await ethers.getContractFactory("UniswapV2Factory");
    const factory = await Factory.deploy(deployer.address);
    await factory.deployed();
    factoryAddress = factory.address;
    console.log("Factory deployed to:", factoryAddress);

    // Deploy Router
    console.log("\n🔄 Deploying Router...");
    const Router = await ethers.getContractFactory("UniswapV2Router02");
    const router = await Router.deploy(factoryAddress, wethAddress);
    await router.deployed();
    routerAddress = router.address;
    console.log("Router deployed to:", routerAddress);
  }

  // Deploy AutoTradingFactory - this will automatically create pools for new tokens
  console.log("\n🏗️ Deploying AutoTradingFactory...");
  const AutoTradingFactory = await ethers.getContractFactory("AutoTradingFactory");
  const autoTradingFactory = await AutoTradingFactory.deploy(
    factoryAddress,
    routerAddress,
    wethAddress,
    deployer.address // fee recipient
  );
  await autoTradingFactory.deployed();
  console.log("✅ AutoTradingFactory deployed to:", autoTradingFactory.address);

  // Deploy a test token to demonstrate auto-trading
  console.log("\n🪙 Deploying Test Token with Auto-Trading...");
  const TestToken = await ethers.getContractFactory("OGToken");
  const testToken = await TestToken.deploy("Auto Trading Test", "AUTO", ethers.utils.parseEther("1000000"));
  await testToken.deployed();
  console.log("Test Token deployed to:", testToken.address);

  // Enable auto-trading for this token
  console.log("Enabling auto-trading...");
  const enableTx = await autoTradingFactory.enableTradingForToken(
    testToken.address,
    ethers.utils.parseEther("100000"), // 100k tokens
    ethers.utils.parseEther("1"),     // 1 0G
    { value: ethers.utils.parseEther("1") }
  );
  await enableTx.wait();
  console.log("✅ Auto-trading enabled for test token!");

  console.log("\n🎉 Automatic Trading Setup Complete!");
  console.log("==================================");
  console.log("Contract Addresses:");
  console.log("Factory:", factoryAddress);
  console.log("Router:", routerAddress);
  console.log("WETH:", wethAddress);
  console.log("AutoTradingFactory:", autoTradingFactory.address);
  console.log("Test Token:", testToken.address);
  console.log("==================================");
  console.log("\n💡 How to use:");
  console.log("1. Call autoTradingFactory.enableTradingForToken() for any new token");
  console.log("2. It automatically creates pair + adds liquidity");
  console.log("3. Token becomes instantly tradable!");
  
  console.log("\n📝 Update your frontend with these addresses:");
  console.log(`FACTORY_ADDRESS = '${factoryAddress}'`);
  console.log(`ROUTER_ADDRESS = '${routerAddress}'`);
  console.log(`WETH_ADDRESS = '${wethAddress}'`);
  console.log(`AUTO_TRADING_FACTORY = '${autoTradingFactory.address}'`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
