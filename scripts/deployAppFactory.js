require('dotenv').config();
const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Deploying App Factory (Factory.sol: MemeToken + BondingCurve)...');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', await deployer.getAddress());
  console.log('Balance:', ethers.formatEther(await deployer.provider.getBalance(await deployer.getAddress())));

  const treasury = process.env.FACTORY_TREASURY || await deployer.getAddress();
  const defaultFeeBps = parseInt(process.env.FACTORY_FEE_BPS || '500', 10); // 5%

  console.log('Treasury:', treasury);
  console.log('Default Fee (bps):', defaultFeeBps);

  console.log('\n📦 Deploying Factory...');
  const Factory = await ethers.getContractFactory('Factory');
  const factory = await Factory.deploy(treasury, defaultFeeBps);
  await factory.waitForDeployment();
  console.log('Factory:', await factory.getAddress());

  const deployment = {
    network: '0g-galileo-testnet',
    address: await factory.getAddress(),
    treasury,
    defaultFeeBps,
    deployer: await deployer.getAddress(),
    deployedAt: new Date().toISOString()
  };

  if (!fs.existsSync('deployments')) fs.mkdirSync('deployments');
  const outFile = path.join('deployments', 'app-factory-0g-galileo-testnet.json');
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
  console.log('💾 Saved', outFile);

  // Also update lib/trading-config.ts if present
  try {
    const configTs = `// Auto-updated by deployAppFactory.js\nexport const TRADING_CONFIG = {\n  FACTORY_ADDRESS: '${await factory.getAddress()}',\n  ROUTER_ADDRESS: '${process.env.ROUTER_ADDRESS || ''}',\n  WETH_ADDRESS: '${process.env.WETH_ADDRESS || ''}',\n  AUTO_TRADING_FACTORY_ADDRESS: '',\n  NETWORK: '0g-galileo-testnet',\n  RPC_URL: 'https://evmrpc-testnet.0g.ai',\n  CHAIN_ID: 16602\n};\n`;
    fs.writeFileSync(path.join('lib', 'trading-config.ts'), configTs);
    console.log('🎨 Updated lib/trading-config.ts');
  } catch (e) {
    console.warn('Could not update lib/trading-config.ts:', e.message);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


