require('dotenv').config();

console.log('Environment variables in hardhat context:');
console.log('PRIVATE_KEY:', process.env.PRIVATE_KEY ? 'Set (' + process.env.PRIVATE_KEY.substring(0, 10) + '...)' : 'Not set');
console.log('OG_CHAIN_RPC:', process.env.OG_CHAIN_RPC);
console.log('FACTORY_ADDRESS:', process.env.FACTORY_ADDRESS);
