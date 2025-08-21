const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Minimal ABIs
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

const ROUTER_ABI = [
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)'
];

async function main() {
  console.log('🔁 Enabling trading for existing tokens (router.addLiquidityETH)...');

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log('👤 Deployer:', signerAddress);
  console.log('💰 ETH Balance:', ethers.utils.formatEther(await signer.getBalance()));

  // DEX addresses on 0G testnet
  // Prefer the freshly deployed router if present in deployment-config.json
  let ROUTER_ADDRESS = '0x61fa1e78d101Ff616db00fE9e296C3E292393c63';
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'deployment-config.json'), 'utf8'));
    if (cfg?.routerAddress) ROUTER_ADDRESS = cfg.routerAddress;
  } catch {}
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

  // Load tokens from data/coins.json
  const coinsPath = path.join(__dirname, '../data/coins.json');
  if (!fs.existsSync(coinsPath)) {
    console.log('❌ data/coins.json not found');
    process.exit(1);
  }
  const coins = JSON.parse(fs.readFileSync(coinsPath, 'utf8'));
  const tokens = coins
    .map(c => ({ name: c.name, symbol: c.symbol, address: c.tokenAddress }))
    .filter(t => typeof t.address === 'string' && t.address?.length === 42);

  if (tokens.length === 0) {
    console.log('❌ No valid token addresses in data/coins.json');
    process.exit(1);
  }

  // Configurable amounts
  const DEFAULT_TOKEN_AMOUNT = process.env.SEED_TOKEN_AMOUNT || '100000'; // 100k tokens
  const DEFAULT_ETH_AMOUNT = process.env.SEED_ETH_AMOUNT || '0.1';       // 0.1 0G

  for (const t of tokens) {
    console.log(`\n▶️ ${t.name} (${t.symbol}) @ ${t.address}`);
    try {
      const token = new ethers.Contract(t.address, ERC20_ABI, signer);

      // Detect decimals (fallback 18)
      let decimals = 18;
      try { decimals = await token.decimals(); } catch {}

      // Balances and amounts
      const tokenBalance = await token.balanceOf(signerAddress);
      const desiredToken = ethers.utils.parseUnits(DEFAULT_TOKEN_AMOUNT, decimals);
      const desiredEth = ethers.utils.parseEther(DEFAULT_ETH_AMOUNT);

      if (tokenBalance.lt(desiredToken)) {
        console.log(`⚠️ Insufficient token balance: have ${ethers.utils.formatUnits(tokenBalance, decimals)}, need ${DEFAULT_TOKEN_AMOUNT}`);
        console.log('   Skipping this token.');
        continue;
      }

      const ethBal = await signer.getBalance();
      if (ethBal.lt(desiredEth)) {
        console.log(`⚠️ Insufficient ETH: have ${ethers.utils.formatEther(ethBal)}, need ${DEFAULT_ETH_AMOUNT}`);
        console.log('   Skipping this token.');
        continue;
      }

      console.log('📝 Approving router to spend tokens...');
      await (await token.approve(ROUTER_ADDRESS, desiredToken)).wait();

      console.log('🧪 Adding liquidity via router.addLiquidityETH...');
      const tx = await router.addLiquidityETH(
        t.address,
        desiredToken,
        0,
        0,
        signerAddress,
        Math.floor(Date.now() / 1000) + 1800,
        { value: desiredEth }
      );
      const receipt = await tx.wait();
      console.log('✅ Liquidity added. tx:', receipt.transactionHash);
    } catch (e) {
      console.log('❌ Failed for', t.symbol, '-', e.message || e);
    }
  }

  console.log('\n🎉 Done processing tokens from data/coins.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
