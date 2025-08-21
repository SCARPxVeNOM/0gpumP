/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', '0g.ai'],
  },
  env: {
    OG_CHAIN_RPC: process.env.OG_CHAIN_RPC || 'https://rpc.0g.ai',
    OG_STORAGE_ENDPOINT: process.env.OG_STORAGE_ENDPOINT || 'https://storage.0g.ai',
    OG_COMPUTE_ENDPOINT: process.env.OG_COMPUTE_ENDPOINT || 'https://compute.0g.ai',
  },
}

module.exports = nextConfig

