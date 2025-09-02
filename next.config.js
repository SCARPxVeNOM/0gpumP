/** @type {import('next').NextConfig} */
const LitOptimizationPlugin = require('./lib/webpack-lit-plugin')

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
  // Webpack configuration to handle Web Components and Lit library
  webpack: (config, { dev, isServer }) => {
    // Use custom Lit optimization plugin
    config.plugins.push(
      new LitOptimizationPlugin({
        suppressDevModeWarnings: true,
        optimizeForProduction: !dev,
      })
    )

    // Handle Web Components and Lit library
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }

    // Define environment variables for Lit library
    config.plugins.push(
      new (require('webpack').DefinePlugin)({
        'process.env.LIT_DEV_MODE': JSON.stringify(dev ? 'true' : 'false'),
        'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production'),
      })
    )

    // Optimize for production builds
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks.cacheGroups,
            walletconnect: {
              test: /[\\/]node_modules[\\/]@walletconnect[\\/]/,
              name: 'walletconnect',
              chunks: 'all',
              priority: 10,
            },
            lit: {
              test: /[\\/]node_modules[\\/]@lit[\\/]/,
              name: 'lit',
              chunks: 'all',
              priority: 5,
            },
          },
        },
      }
    }

    return config
  },
  // Environment variables for Lit
  env: {
    LIT_DEV_MODE: process.env.NODE_ENV === 'development' ? 'true' : 'false',
  },
}

module.exports = nextConfig

