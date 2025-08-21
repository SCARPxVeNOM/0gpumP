const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', (await deployer.getBalance()).toString());

  // Deploy BondingCurveAMM
  console.log('\nDeploying BondingCurveAMM...');
  
  const BondingCurveAMM = await ethers.getContractFactory('BondingCurveAMM');
  
  // Configuration parameters (adjust as needed)
  const name = '0G Pump Token';
  const symbol = '0GPUMP';
  const basePrice = ethers.utils.parseEther('0.0001'); // 0.0001 0G per token
  const stepSize = ethers.utils.parseEther('0.00005'); // 0.00005 0G increase per step
  const stepQty = ethers.BigNumber.from('1000'); // 1000 tokens per step
  const curveCap = ethers.BigNumber.from('100000'); // 100k total tokens on curve
  const feeBps = 200; // 2% fee
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;

  console.log('Deployment parameters:');
  console.log('- Name:', name);
  console.log('- Symbol:', symbol);
  console.log('- Base Price:', ethers.utils.formatEther(basePrice), '0G');
  console.log('- Step Size:', ethers.utils.formatEther(stepSize), '0G');
  console.log('- Step Quantity:', stepQty.toString());
  console.log('- Curve Cap:', curveCap.toString());
  console.log('- Fee (bps):', feeBps);
  console.log('- Fee Recipient:', feeRecipient);

  const bondingCurve = await BondingCurveAMM.deploy(
    name,
    symbol,
    basePrice,
    stepSize,
    stepQty,
    curveCap,
    feeBps,
    feeRecipient
  );

  await bondingCurve.deployed();

  console.log('\n✅ BondingCurveAMM deployed to:', bondingCurve.address);
  console.log('Project Token address:', await bondingCurve.token());

  // Deploy LiquidityMigrator
  console.log('\nDeploying LiquidityMigrator...');
  
  const LiquidityMigrator = await ethers.getContractFactory('LiquidityMigrator');
  
  // You'll need to deploy UniswapV2 Router first and set its address
  const routerAddress = process.env.UNISWAP_ROUTER;
  if (!routerAddress) {
    console.log('⚠️  UNISWAP_ROUTER not set in .env, skipping LiquidityMigrator deployment');
    console.log('Deploy LiquidityMigrator later with:');
    console.log(`npx hardhat run scripts/deployMigrator.js --network 0g-testnet`);
  } else {
    const migrator = await LiquidityMigrator.deploy(routerAddress);
    await migrator.deployed();
    
    console.log('✅ LiquidityMigrator deployed to:', migrator.address);
    console.log('Router address:', routerAddress);
  }

  // Output deployment summary
  console.log('\n📋 Deployment Summary:');
  console.log('========================');
  console.log('BondingCurveAMM:', bondingCurve.address);
  console.log('Project Token:', await bondingCurve.token());
  if (routerAddress) {
    console.log('LiquidityMigrator:', migrator.address);
  }
  console.log('\n🔗 Next steps:');
  console.log('1. Verify contracts on 0G block explorer');
  console.log('2. Update frontend with contract addresses');
  console.log('3. Test bonding curve functionality');
  console.log('4. Deploy UniswapV2 fork for graduation');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
