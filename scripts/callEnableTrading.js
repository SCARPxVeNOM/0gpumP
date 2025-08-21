const axios = require('axios');

async function main() {
  const [, , tokenAddress, tokenAmount = '100000', ethAmount = '0.1'] = process.argv;
  if (!tokenAddress) {
    console.error('Usage: node scripts/callEnableTrading.js <tokenAddress> [tokenAmount] [ethAmount]');
    process.exit(1);
  }
  try {
    const res = await axios.post('http://localhost:4000/enableTrading', {
      tokenAddress,
      tokenAmount,
      ethAmount,
    }, { timeout: 120000 });
    console.log(JSON.stringify(res.data));
  } catch (e) {
    console.error(e.response?.data || e.message || e);
    process.exit(1);
  }
}

main();


