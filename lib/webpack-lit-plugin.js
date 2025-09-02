/**
 * Custom webpack plugin for Lit library optimizations
 * This plugin helps suppress development mode warnings and optimize Lit usage
 */

class LitOptimizationPlugin {
  constructor(options = {}) {
    this.options = {
      suppressDevModeWarnings: true,
      optimizeForProduction: true,
      ...options
    }
  }

  apply(compiler) {
    // Define environment variables for Lit
    compiler.hooks.afterEnvironment.tap('LitOptimizationPlugin', () => {
      compiler.options.plugins.push(
        new compiler.webpack.DefinePlugin({
          'process.env.LIT_DEV_MODE': JSON.stringify(
            this.options.optimizeForProduction ? 'false' : 'true'
          ),
          'process.env.NODE_ENV': JSON.stringify(
            this.options.optimizeForProduction ? 'production' : 'development'
          ),
        })
      )
    })

    // Optimize chunk splitting for Lit and WalletConnect
    if (this.options.optimizeForProduction) {
      compiler.hooks.afterPlugins.tap('LitOptimizationPlugin', () => {
        if (!compiler.options.optimization) {
          compiler.options.optimization = {}
        }
        if (!compiler.options.optimization.splitChunks) {
          compiler.options.optimization.splitChunks = {}
        }
        if (!compiler.options.optimization.splitChunks.cacheGroups) {
          compiler.options.optimization.splitChunks.cacheGroups = {}
        }

        // Add Lit-specific cache groups
        compiler.options.optimization.splitChunks.cacheGroups.lit = {
          test: /[\\/]node_modules[\\/]@lit[\\/]/,
          name: 'lit',
          chunks: 'all',
          priority: 5,
          reuseExistingChunk: true,
        }

        compiler.options.optimization.splitChunks.cacheGroups.walletconnect = {
          test: /[\\/]node_modules[\\/]@walletconnect[\\/]/,
          name: 'walletconnect',
          chunks: 'all',
          priority: 10,
          reuseExistingChunk: true,
        }
      })
    }

    // Add fallbacks for Node.js modules
    compiler.hooks.afterResolvers.tap('LitOptimizationPlugin', () => {
      if (!compiler.options.resolve) {
        compiler.options.resolve = {}
      }
      if (!compiler.options.resolve.fallback) {
        compiler.options.resolve.fallback = {}
      }

      compiler.options.resolve.fallback = {
        ...compiler.options.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      }
    })
  }
}

module.exports = LitOptimizationPlugin
























