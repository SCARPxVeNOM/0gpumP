const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', (await deployer.getBalance()).toString());

  // Check if router address is set
  const routerAddress = process.env.UNISWAP_ROUTER;
  if (!routerAddress) {
    console.error('❌ UNISWAP_ROUTER not set in .env');
    console.log('Please set UNISWAP_ROUTER in your .env file and try again');
    process.exit(1);
  }

  console.log('Router address:', routerAddress);

  // Deploy LiquidityMigrator
  console.log('\nDeploying LiquidityMigrator...');
  
  const LiquidityMigrator = await ethers.getContractFactory('LiquidityMigrator');
  
  const migrator = await LiquidityMigrator.deploy(routerAddress);
  await migrator.deployed();
  
  console.log('✅ LiquidityMigrator deployed to:', migrator.address);
  console.log('Router address:', routerAddress);

  // Verify the deployment
  console.log('\n🔍 Verifying deployment...');
  
  try {
    const factory = await migrator.factory();
    const router = await migrator.router();
    const weth = await migrator.weth();
    
    console.log('✅ Contract verification successful:');
    console.log('- Factory:', factory);
    console.log('- Router:', router);
    console.log('- WETH:', weth);
  } catch (error) {
    console.log('⚠️  Contract verification failed:', error.message);
  }

  // Output deployment summary
  console.log('\n📋 Deployment Summary:');
  console.log('========================');
  console.log('LiquidityMigrator:', migrator.address);
  console.log('Router:', routerAddress);
  console.log('\n🔗 Next steps:');
  console.log('1. Verify contract on 0G block explorer');
  console.log('2. Update frontend with migrator address');
  console.log('3. Test migration functionality');
  console.log('4. Set migrator address in bonding curve service');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });










