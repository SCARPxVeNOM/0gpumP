/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', '0g.ai'],
  },
  // Skip type checking during build for deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  // Handle API routes properly
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ]
  },
}

module.exports = nextConfig

