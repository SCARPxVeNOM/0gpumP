const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
  console.log("🚀 Enabling Trading for Your Tokens on 0G Testnet...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Your existing tokens that need trading enabled
  const TOKENS_TO_ENABLE = [
    {
      name: "SolanaMEME",
      symbol: "WOW",
      address: "0xA10e861edF32a090B7563798e3a8871087196c27"
    },
    {
      name: "DinoSaur",
      symbol: "DINO",
      address: "0x78D378F18f5d3c12596eC0eA2b1d29bd79F55148"
    },
    {
      name: "transformers", 
      symbol: "TRF",
      address: "0xe7cF53Cbc83ad319592E508fd3a79515084354BB"
    }
  ];

  // Check if DEX is already deployed
  let factoryAddress, routerAddress, wethAddress;
  
  try {
    // Try to use existing addresses from blockchainTradingService
    factoryAddress = "0x0Bd71a034D5602014206B965677E83C6484561F2";
    routerAddress = "0x61fa1e78d101Ff616db00fE9e296C3E292393c63";
    wethAddress = "0x9Ba2C58C733119d896256DA85b2EAdfFE74A657F";
    
    console.log("Using existing DEX addresses:");
    console.log("Factory:", factoryAddress);
    console.log("Router:", routerAddress);
    console.log("WETH:", wethAddress);
    
    // Verify these contracts exist
    const factory = await ethers.getContractAt("UniswapV2Factory", factoryAddress);
    const router = await ethers.getContractAt("UniswapV2Router02", routerAddress);
    const weth = await ethers.getContractAt("WETH9", wethAddress);
    
    console.log("✅ DEX contracts verified!");
    
  } catch (error) {
    console.log("❌ DEX contracts not found or invalid. Deploying new ones...");
    
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

  // Now enable trading for each token
  console.log("\n💧 Enabling Trading for Your Tokens...");
  
  for (const tokenInfo of TOKENS_TO_ENABLE) {
    try {
      console.log(`\n🎯 Enabling trading for ${tokenInfo.name} (${tokenInfo.symbol})...`);
      
      // Get token contract
      const token = await ethers.getContractAt("OGToken", tokenInfo.address);
      console.log("Token address:", tokenInfo.address);
      
      // Check if pair already exists
      const factory = await ethers.getContractAt("UniswapV2Factory", factoryAddress);
      let pairAddress = await factory.getPair(tokenInfo.address, wethAddress);
      
      if (pairAddress === ethers.constants.AddressZero) {
        console.log("Creating trading pair...");
        const createPairTx = await factory.createPair(tokenInfo.address, wethAddress);
        await createPairTx.wait();
        pairAddress = await factory.getPair(tokenInfo.address, wethAddress);
        console.log("✅ Pair created at:", pairAddress);
      } else {
        console.log("✅ Trading pair already exists at:", pairAddress);
      }
      
      // Add initial liquidity
      console.log("Adding initial liquidity...");
      const router = await ethers.getContractAt("UniswapV2Router02", routerAddress);
      
      // Calculate amounts (you can adjust these)
      const tokenAmount = ethers.utils.parseEther("1000000"); // 1M tokens
      const ethAmount = ethers.utils.parseEther("10"); // 10 0G
      
      // Approve router to spend tokens
      await token.approve(routerAddress, tokenAmount);
      console.log("✅ Token approval successful");
      
      // Add liquidity
      const addLiquidityTx = await router.addLiquidityETH(
        tokenInfo.address,
        tokenAmount,
        0, // slippage is unavoidable
        0, // slippage is unavoidable
        deployer.address,
        Math.floor(Date.now() / 1000) + 1800, // 30 minutes from now
        { value: ethAmount }
      );
      
      await addLiquidityTx.wait();
      console.log("✅ Liquidity added successfully!");
      console.log(`🎉 ${tokenInfo.symbol} is now tradable!`);
      
    } catch (error) {
      console.error(`❌ Failed to enable trading for ${tokenInfo.symbol}:`, error.message);
    }
  }
  
  console.log("\n🎉 Trading Setup Complete!");
  console.log("==================================");
  console.log("DEX Addresses:");
  console.log("Factory:", factoryAddress);
  console.log("Router:", routerAddress);
  console.log("WETH:", wethAddress);
  console.log("==================================");
  console.log("\n💡 Next steps:");
  console.log("1. Update your frontend with these addresses");
  console.log("2. Test trading with your tokens");
  console.log("3. Create new tokens - they'll be automatically tradable!");
  
  console.log("\n📝 Update these addresses in lib/blockchainTradingService.ts:");
  console.log(`FACTORY_ADDRESS = '${factoryAddress}'`);
  console.log(`ROUTER_ADDRESS = '${routerAddress}'`);
  console.log(`WETH_ADDRESS = '${wethAddress}'`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
