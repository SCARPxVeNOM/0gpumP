require('dotenv').config();

console.log('Environment variables:');
console.log('PRIVATE_KEY:', process.env.PRIVATE_KEY ? 'Set' : 'Not set');
console.log('OG_RPC:', process.env.OG_RPC);
console.log('FACTORY_ADDRESS:', process.env.FACTORY_ADDRESS);
