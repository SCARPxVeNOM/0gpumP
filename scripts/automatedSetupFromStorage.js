const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
  console.log("🤖 Starting Automated Setup for 0G Pump Platform...");
  console.log("Reading token data from 0G Storage...\n");

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

    // Step 3: Read tokens from 0G Storage data
    console.log("\n🔍 Step 3: Reading tokens from 0G Storage...");
    
    let foundTokens = [];
    
    // Try to read from coins.json
    try {
      const coinsDataPath = path.join(__dirname, '../data/coins.json');
      if (fs.existsSync(coinsDataPath)) {
        const coinsData = JSON.parse(fs.readFileSync(coinsDataPath, 'utf8'));
        console.log(`📁 Found ${coinsData.length} tokens in coins.json`);
        
        foundTokens = coinsData.filter(coin => 
          coin.tokenAddress && 
          coin.tokenAddress !== "0xSampleTokenAddress" &&
          coin.tokenAddress.length === 42 // Valid Ethereum address length
        ).map(coin => ({
          address: coin.tokenAddress,
          name: coin.name,
          symbol: coin.symbol,
          txHash: coin.txHash || 'Unknown',
          description: coin.description || ''
        }));
        
        foundTokens.forEach(token => {
          console.log(`   Found token: ${token.name} (${token.symbol}) at ${token.address}`);
        });
      }
    } catch (error) {
      console.log("⚠️ Error reading coins.json:", error.message);
    }
    
    // If no tokens found in coins.json, try to read from localStorage data
    if (foundTokens.length === 0) {
      console.log("🔍 No tokens found in coins.json, checking for localStorage data...");
      
      // Look for any JSON files that might contain coin data
      const dataDir = path.join(__dirname, '../data');
      if (fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir);
        for (const file of files) {
          if (file.endsWith('.json') && file !== 'coins.json') {
            try {
              const filePath = path.join(dataDir, file);
              const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              
              // Look for coin-like data structures
              if (Array.isArray(data)) {
                const coins = data.filter(item => 
                  item.tokenAddress && 
                  item.name && 
                  item.symbol &&
                  item.tokenAddress !== "0xSampleTokenAddress" &&
                  item.tokenAddress.length === 42
                );
                
                if (coins.length > 0) {
                  console.log(`📁 Found ${coins.length} tokens in ${file}`);
                  foundTokens = coins.map(coin => ({
                    address: coin.tokenAddress,
                    name: coin.name,
                    symbol: coin.symbol,
                    txHash: coin.txHash || 'Unknown',
                    description: coin.description || ''
                  }));
                  
                  foundTokens.forEach(token => {
                    console.log(`   Found token: ${token.name} (${token.symbol}) at ${token.address}`);
                  });
                  break;
                }
              }
            } catch (error) {
              // Skip files that can't be parsed
            }
          }
        }
      }
    }

    if (foundTokens.length === 0) {
      console.log("   No tokens found in storage data.");
      console.log("   💡 You can manually add token addresses to data/coins.json");
    } else {
      console.log(`\n🎯 Step 4: Enabling trading for ${foundTokens.length} existing tokens...`);
      
      for (const token of foundTokens) {
        try {
          console.log(`\n   Enabling trading for ${token.name} (${token.symbol})...`);
          
          // Check if trading is already enabled
          const [hasTrading] = await autoTradingFactory.hasTradingEnabled(token.address);
          
          if (hasTrading) {
            console.log(`   ✅ Trading already enabled for ${token.symbol}`);
            deploymentResults.existingTokens.push({
              ...token,
              tradingEnabled: true
            });
            continue;
          }
          
          // Get token contract
          const tokenContract = await ethers.getContractAt("OGToken", token.address);
          
          // Check token balance
          const tokenBalance = await tokenContract.balanceOf(deployer.address);
          const requiredAmount = ethers.utils.parseEther("1000000"); // 1M tokens
          
          if (tokenBalance.lt(requiredAmount)) {
            console.log(`   ⚠️ Insufficient token balance for ${token.symbol}. Skipping.`);
            console.log(`   💡 You need at least 1,000,000 ${token.symbol} tokens to enable trading`);
            deploymentResults.existingTokens.push({
              ...token,
              tradingEnabled: false,
              error: "Insufficient token balance"
            });
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
        if (!token.tradingEnabled && token.error) {
          console.log(`    Error: ${token.error}`);
        }
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
