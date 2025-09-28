const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
  console.log("🤖 Starting Automated Setup for 0G Pump Platform...");
  console.log("This will deploy everything needed for automatic trading\n");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString(), "0G");

  // Check if we have enough balance
  const balance = await deployer.getBalance();
  const minBalance = ethers.utils.parseEther("1"); // Need at least 1 0G for deployment
  
  if (balance.lt(minBalance)) {
    console.log("❌ Insufficient balance. Need at least 1 0G for deployment.");
    console.log("💡 Get testnet tokens from: https://faucet.0g.ai");
    process.exit(1);
  }
  
  console.log("✅ Sufficient balance for deployment");

  const deploymentResults = {
    factory: null,
    router: null,
    weth: null,
    autoTradingFactory: null,
    existingTokens: []
  };

  try {
    // Step 1: Deploy or verify DEX contracts
    console.log("\n🏭 Step 1: Setting up DEX Infrastructure...");
    
    let factoryAddress, routerAddress, wethAddress;
    
    // Try to use existing addresses first
    try {
      factoryAddress = "0x0Bd71a034D5602014206B965677E83C6484561F2";
      routerAddress = "0x61fa1e78d101Ff616db00fE9e296C3E292393c63";
      wethAddress = "0x9Ba2C58C733119d896256DA85b2EAdfFE74A657F";
      
      // Verify contracts exist
      const factory = await ethers.getContractAt("UniswapV2Factory", factoryAddress);
      const router = await ethers.getContractAt("UniswapV2Router02", routerAddress);
      const weth = await ethers.getContractAt("WETH9", wethAddress);
      
      console.log("✅ Using existing DEX contracts:");
      console.log("   Factory:", factoryAddress);
      console.log("   Router:", routerAddress);
      console.log("   WETH:", wethAddress);
      
      deploymentResults.factory = factoryAddress;
      deploymentResults.router = routerAddress;
      deploymentResults.weth = wethAddress;
      
    } catch (error) {
      console.log("❌ Existing DEX contracts not found. Deploying new ones...");
      
      // Deploy WETH
      console.log("📦 Deploying WETH...");
      const WETH = await ethers.getContractFactory("WETH9");
      const weth = await WETH.deploy();
      await weth.deployed();
      wethAddress = weth.address;
      console.log("   WETH deployed:", wethAddress);

      // Deploy Factory
      console.log("🏭 Deploying Factory...");
      const Factory = await ethers.getContractFactory("UniswapV2Factory");
      const factory = await Factory.deploy(deployer.address);
      await factory.deployed();
      factoryAddress = factory.address;
      console.log("   Factory deployed:", factoryAddress);

      // Deploy Router
      console.log("🔄 Deploying Router...");
      const Router = await ethers.getContractFactory("UniswapV2Router02");
      const router = await Router.deploy(factoryAddress, wethAddress);
      await router.deployed();
      routerAddress = router.address;
      console.log("   Router deployed:", routerAddress);
      
      deploymentResults.factory = factoryAddress;
      deploymentResults.router = routerAddress;
      deploymentResults.weth = wethAddress;
    }

    // Step 2: Deploy AutoTradingFactory
    console.log("\n🏗️ Step 2: Deploying AutoTradingFactory...");
    
    const AutoTradingFactory = await ethers.getContractFactory("AutoTradingFactory");
    const autoTradingFactory = await AutoTradingFactory.deploy(
      factoryAddress,
      routerAddress,
      wethAddress,
      deployer.address // fee recipient
    );
    await autoTradingFactory.deployed();
    
    deploymentResults.autoTradingFactory = autoTradingFactory.address;
    console.log("✅ AutoTradingFactory deployed:", autoTradingFactory.address);

    // Step 3: Find and enable trading for existing tokens
    console.log("\n🔍 Step 3: Finding existing tokens...");
    
    // Get recent transactions to find token deployments
    const provider = new ethers.providers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
    const currentBlock = await provider.getBlockNumber();
    
    // Look for token deployments in recent blocks
    const foundTokens = [];
    
    for (let i = 0; i < 100; i++) { // Check last 100 blocks
      try {
        const block = await provider.getBlock(currentBlock - i);
        if (block && block.transactions.length > 0) {
          for (const txHash of block.transactions) {
            try {
              const tx = await provider.getTransaction(txHash);
              if (tx && tx.to === null && tx.from.toLowerCase() === deployer.address.toLowerCase()) {
                // This is a contract creation transaction
                const receipt = await provider.getTransactionReceipt(txHash);
                if (receipt && receipt.contractAddress) {
                  // Try to verify it's an OGToken
                  try {
                    const token = new ethers.Contract(receipt.contractAddress, [
                      'function name() view returns (string)',
                      'function symbol() view returns (string)'
                    ], provider);
                    
                    const name = await token.name();
                    const symbol = await token.symbol();
                    
                    foundTokens.push({
                      address: receipt.contractAddress,
                      name,
                      symbol,
                      txHash
                    });
                    
                    console.log(`   Found token: ${name} (${symbol}) at ${receipt.contractAddress}`);
                  } catch (e) {
                    // Not an OGToken, skip
                  }
                }
              }
            } catch (e) {
              // Skip failed transactions
            }
          }
        }
      } catch (e) {
        // Skip failed blocks
      }
    }

    if (foundTokens.length > 0) {
      console.log(`\n🎯 Step 4: Enabling trading for ${foundTokens.length} existing tokens...`);
      
      for (const token of foundTokens) {
        try {
          console.log(`\n   Enabling trading for ${token.name} (${token.symbol})...`);
          
          // Check if trading is already enabled
          const [hasTrading] = await autoTradingFactory.hasTradingEnabled(token.address);
          
          if (hasTrading) {
            console.log(`   ✅ Trading already enabled for ${token.symbol}`);
            continue;
          }
          
          // Get token contract
          const tokenContract = await ethers.getContractAt("OGToken", token.address);
          
          // Check token balance
          const tokenBalance = await tokenContract.balanceOf(deployer.address);
          const requiredAmount = ethers.utils.parseEther("1000000"); // 1M tokens
          
          if (tokenBalance.lt(requiredAmount)) {
            console.log(`   ⚠️ Insufficient token balance for ${token.symbol}. Skipping.`);
            continue;
          }
          
          // Approve tokens
          await tokenContract.approve(autoTradingFactory.address, requiredAmount);
          
          // Enable trading
          const enableTx = await autoTradingFactory.enableTradingForToken(
            token.address,
            requiredAmount,
            ethers.utils.parseEther("10"), // 10 0G
            { value: ethers.utils.parseEther("10") }
          );
          
          await enableTx.wait();
          console.log(`   ✅ Trading enabled for ${token.symbol}!`);
          
          deploymentResults.existingTokens.push({
            ...token,
            tradingEnabled: true
          });
          
        } catch (error) {
          console.log(`   ❌ Failed to enable trading for ${token.symbol}: ${error.message}`);
          deploymentResults.existingTokens.push({
            ...token,
            tradingEnabled: false,
            error: error.message
          });
        }
      }
    } else {
      console.log("   No existing tokens found.");
    }

    // Step 5: Create configuration file
    console.log("\n📝 Step 5: Creating configuration...");
    
    const config = {
      factoryAddress,
      routerAddress,
      wethAddress,
      autoTradingFactoryAddress: autoTradingFactory.address,
      deployerAddress: deployer.address,
      network: "0g-galileo-testnet",
      rpcUrl: "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      deploymentTime: new Date().toISOString()
    };
    
    // Save config to file
    const fs = require('fs');
    fs.writeFileSync('deployment-config.json', JSON.stringify(config, null, 2));
    console.log("✅ Configuration saved to deployment-config.json");

    // Step 6: Generate frontend configuration
    console.log("\n🎨 Step 6: Generating frontend configuration...");
    
    const frontendConfig = `
// Auto-generated configuration for frontend
export const TRADING_CONFIG = {
  FACTORY_ADDRESS: '${factoryAddress}',
  ROUTER_ADDRESS: '${routerAddress}',
  WETH_ADDRESS: '${wethAddress}',
  AUTO_TRADING_FACTORY_ADDRESS: '${autoTradingFactory.address}',
  NETWORK: '0g-galileo-testnet',
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  CHAIN_ID: 16602
};

export const AUTO_TRADING_CONFIG = {
  factoryAddress: '${factoryAddress}',
  routerAddress: '${routerAddress}',
  wethAddress: '${wethAddress}',
  autoTradingFactoryAddress: '${autoTradingFactory.address}',
  defaultTokenAmount: '1000000',
  defaultEthAmount: '10'
};
`;
    
    fs.writeFileSync('lib/trading-config.ts', frontendConfig);
    console.log("✅ Frontend configuration saved to lib/trading-config.ts");

    // Final summary
    console.log("\n🎉 Automated Setup Complete!");
    console.log("==================================");
    console.log("Deployed Contracts:");
    console.log("Factory:", factoryAddress);
    console.log("Router:", routerAddress);
    console.log("WETH:", wethAddress);
    console.log("AutoTradingFactory:", autoTradingFactory.address);
    console.log("==================================");
    console.log("Existing Tokens Processed:", deploymentResults.existingTokens.length);
    
    if (deploymentResults.existingTokens.length > 0) {
      console.log("\nToken Status:");
      deploymentResults.existingTokens.forEach(token => {
        const status = token.tradingEnabled ? "✅ Trading Enabled" : "❌ Trading Failed";
        console.log(`  ${token.name} (${token.symbol}): ${status}`);
      });
    }
    
    console.log("\n💡 Next Steps:");
    console.log("1. Your platform is now ready for automatic trading!");
    console.log("2. New tokens will be automatically tradable");
    console.log("3. Start your frontend: npm run dev");
    console.log("4. Create tokens through your UI - they'll be instantly tradable");
    
    console.log("\n📝 Configuration Files Created:");
    console.log("- deployment-config.json");
    console.log("- lib/trading-config.ts");
    
    console.log("\n🚀 Your platform now works exactly like pump.fun!");

  } catch (error) {
    console.error("❌ Automated setup failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
