const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying remaining DEX contracts to 0G Testnet...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Your existing factory address
  const FACTORY_ADDRESS = "0Bd71a034D5602014206B965677E83C6484561F2";
  console.log("Using existing Factory at:", FACTORY_ADDRESS);

  // Deploy WETH (Wrapped ETH) first
  console.log("\n📦 Deploying WETH...");
  const WETH = await ethers.getContractFactory("WETH9");
  const weth = await WETH.deploy();
  await weth.deployed();
  console.log("WETH deployed to:", weth.address);

  // Deploy Router
  console.log("\n🔄 Deploying Router...");
  const Router = await ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(FACTORY_ADDRESS, weth.address);
  await router.deployed();
  console.log("Router deployed to:", router.address);

  // Deploy a test token for initial liquidity
  console.log("\n🪙 Deploying Test Token...");
  const TestToken = await ethers.getContractFactory("OGToken");
  const testToken = await TestToken.deploy("Test Token", "TEST", ethers.utils.parseEther("1000000"));
  await testToken.deployed();
  console.log("Test Token deployed to:", testToken.address);

  // Create initial pair and add liquidity
  console.log("\n💧 Creating initial pair and adding liquidity...");
  
  // Get factory contract instance
  const factory = await ethers.getContractAt("UniswapV2Factory", FACTORY_ADDRESS);
  
  // Create pair
  const createPairTx = await factory.createPair(weth.address, testToken.address);
  await createPairTx.wait();
  console.log("Pair created!");

  // Get pair address
  const pairAddress = await factory.getPair(weth.address, testToken.address);
  console.log("Pair address:", pairAddress);

  // Add initial liquidity
  const wethAmount = ethers.utils.parseEther("10"); // 10 WETH
  const tokenAmount = ethers.utils.parseEther("100000"); // 100,000 tokens

  // Approve router to spend tokens
  await testToken.approve(router.address, tokenAmount);
  await weth.approve(router.address, wethAmount);

  // Add liquidity
  const addLiquidityTx = await router.addLiquidity(
    weth.address,
    testToken.address,
    wethAmount,
    tokenAmount,
    0, // slippage is unavoidable
    0, // slippage is unavoidable
    deployer.address,
    Math.floor(Date.now() / 1000) + 1800 // 30 minutes from now
  );
  await addLiquidityTx.wait();
  console.log("Initial liquidity added!");

  console.log("\n🎉 DEX deployment complete!");
  console.log("==================================");
  console.log("Existing Factory:", FACTORY_ADDRESS);
  console.log("WETH:", weth.address);
  console.log("Router:", router.address);
  console.log("Test Token:", testToken.address);
  console.log("Initial Pair:", pairAddress);
  console.log("==================================");
  console.log("\n💡 Next steps:");
  console.log("1. Update your frontend with these contract addresses");
  console.log("2. Test trading with the test token");
  console.log("3. Deploy your own tokens and create pairs");
  
  console.log("\n📝 Update these addresses in lib/blockchainTradingService.ts:");
  console.log(`FACTORY_ADDRESS = '${FACTORY_ADDRESS}'`);
  console.log(`ROUTER_ADDRESS = '${router.address}'`);
  console.log(`WETH_ADDRESS = '${weth.address}'`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });





