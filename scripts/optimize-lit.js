#!/usr/bin/env node

/**
 * Build script to optimize Lit library usage
 * This script helps suppress development mode warnings and optimize for production
 */

const fs = require('fs')
const path = require('path')

console.log('🔧 Optimizing Lit library for production...')

// Function to update Next.js config with Lit optimizations
function updateNextConfig() {
  const configPath = path.join(process.cwd(), 'next.config.js')
  
  if (!fs.existsSync(configPath)) {
    console.log('⚠️  next.config.js not found, skipping...')
    return
  }

  let configContent = fs.readFileSync(configPath, 'utf8')
  
  // Check if Lit optimizations are already present
  if (configContent.includes('LIT_DEV_MODE')) {
    console.log('✅ Lit optimizations already present in next.config.js')
    return
  }

  // Add Lit-specific webpack optimizations
  const litOptimizations = `
  // Lit library optimizations
  if (!dev) {
    config.plugins.push(
      new (require('webpack').DefinePlugin)({
        'process.env.LIT_DEV_MODE': JSON.stringify('false'),
        'process.env.NODE_ENV': JSON.stringify('production'),
      })
    )
  }
`

  // Insert optimizations before the return statement
  if (configContent.includes('return config')) {
    configContent = configContent.replace(
      'return config',
      `${litOptimizations}\n    return config`
    )
    
    fs.writeFileSync(configPath, configContent)
    console.log('✅ Added Lit optimizations to next.config.js')
  } else {
    console.log('⚠️  Could not find return statement in webpack config')
  }
}

// Function to create environment file
function createEnvFile() {
  const envPath = path.join(process.cwd(), '.env.production')
  
  if (fs.existsSync(envPath)) {
    console.log('✅ .env.production already exists')
    return
  }

  const envContent = `# Production environment variables
NODE_ENV=production
LIT_DEV_MODE=false
NEXT_PUBLIC_LIT_DEV_MODE=false

# WalletConnect configuration
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=a14234612450c639dd0adcbb729ddfd8
`

  fs.writeFileSync(envPath, envContent)
  console.log('✅ Created .env.production file')
}

// Function to update package.json scripts
function updatePackageScripts() {
  const packagePath = path.join(process.cwd(), 'package.json')
  
  if (!fs.existsSync(packagePath)) {
    console.log('⚠️  package.json not found, skipping...')
    return
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  
  if (!packageJson.scripts) {
    packageJson.scripts = {}
  }

  // Add Lit optimization script if not present
  if (!packageJson.scripts['optimize:lit']) {
    packageJson.scripts['optimize:lit'] = 'node scripts/optimize-lit.js'
    packageJson.scripts['build:optimized'] = 'npm run optimize:lit && npm run build'
    
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))
    console.log('✅ Added Lit optimization scripts to package.json')
  } else {
    console.log('✅ Lit optimization scripts already present in package.json')
  }
}

// Main execution
try {
  updateNextConfig()
  createEnvFile()
  updatePackageScripts()
  
  console.log('🎉 Lit library optimization complete!')
  console.log('💡 Use "npm run build:optimized" for production builds with Lit optimizations')
} catch (error) {
  console.error('❌ Error during Lit optimization:', error.message)
  process.exit(1)
}
























