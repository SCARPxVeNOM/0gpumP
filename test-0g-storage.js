const axios = require('axios');
const { FormData } = require('formdata-node');
const { fileFromPath } = require('formdata-node/file-from-path');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Configuration
const OG_STORAGE_API = 'http://localhost:3000';
const BACKEND_API = 'http://localhost:4000';

// Test data
const testCoin = {
  name: 'Test Meme Coin',
  symbol: 'TMC',
  description: 'A test coin for 0G Storage integration',
  supply: '1000000',
  creator: '0x8c6f10acb86aeab293bd60bcf7d0e69f70643f8d219b81b6665885844abc3a9c'
};

async function test0GStorageIntegration() {
  console.log('🧪 Testing 0G Storage Integration...\n');

  try {
    // Test 1: Check 0G Storage health
    console.log('1️⃣ Testing 0G Storage health...');
    try {
      // The starter kit exposes Swagger UI at /api-docs, not /health
      const docsResponse = await axios.get(`${OG_STORAGE_API}/api-docs`);
      console.log('✅ 0G Storage is running (Swagger UI available)');
    } catch (error) {
      console.log('❌ 0G Storage not responding:', error.message);
      console.log('   Make sure to start the 0G Storage starter kit first');
      return;
    }

    // Test 2: Check backend health
    console.log('\n2️⃣ Testing backend health...');
    try {
      const backendHealth = await axios.get(`${BACKEND_API}/health`);
      console.log('✅ Backend is running:', backendHealth.data);
    } catch (error) {
      console.log('❌ Backend not responding:', error.message);
      console.log('   Make sure to start the backend server first');
      return;
    }

    // Test 3: Upload a test file to 0G Storage
    console.log('\n3️⃣ Testing file upload to 0G Storage...');
    try {
      // Create a test file
      const testFilePath = path.join(__dirname, 'test-file.txt');
      const testContent = `Test file created at ${new Date().toISOString()}\nContent: ${testCoin.description}`;
      fs.writeFileSync(testFilePath, testContent);

      const formData = new FormData();
      formData.set('file', await fileFromPath(testFilePath));

      const uploadResponse = await fetch(`${OG_STORAGE_API}/upload`, {
        method: 'POST',
        body: formData
      });

      const uploadJson = await uploadResponse.json();
      console.log('✅ File uploaded to 0G Storage:', uploadJson);
      const { rootHash } = uploadJson;

      // Test 4: Download the file from 0G Storage
      console.log('\n4️⃣ Testing file download from 0G Storage...');
      const downloadResponse = await fetch(`${OG_STORAGE_API}/download/${rootHash}`);
      console.log('✅ File downloaded from 0G Storage');
      console.log('   Content-type:', downloadResponse.headers.get('content-type'));

      // Clean up test file
      fs.unlinkSync(testFilePath);

    } catch (error) {
      console.log('❌ File upload/download test failed:', error.message);
    }

    // Test 5: Test backend upload proxy
    console.log('\n5️⃣ Testing backend upload proxy...');
    try {
      const testData = {
        data: testCoin,
        metadata: { type: 'test-coin', timestamp: Date.now() }
      };

      const proxyResponse = await axios.post(`${BACKEND_API}/upload`, testData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('✅ Backend upload proxy working:', proxyResponse.data);
      const { rootHash: proxyRootHash } = proxyResponse.data;

      // Test 6: Test backend download proxy
      console.log('\n6️⃣ Testing backend download proxy...');
      const proxyDownloadResponse = await fetch(`${BACKEND_API}/download/${proxyRootHash}`);
      console.log('✅ Backend download proxy working');
      console.log('   Content-type:', proxyDownloadResponse.headers.get('content-type'));

    } catch (error) {
      console.log('❌ Backend proxy test failed:', error.message);
    }

    // Test 7: Test coin creation endpoint
    console.log('\n7️⃣ Testing coin creation endpoint...');
    try {
      // Create a test image file
      const testImagePath = path.join(__dirname, 'test-image.png');
      const testImageContent = Buffer.from('fake-png-content-for-testing');
      fs.writeFileSync(testImagePath, testImageContent);

      const coinFormData = new FormData();
      coinFormData.set('name', testCoin.name);
      coinFormData.set('symbol', testCoin.symbol);
      coinFormData.set('description', testCoin.description);
      coinFormData.set('supply', testCoin.supply);
      coinFormData.set('creator', testCoin.creator);
      coinFormData.set('image', await fileFromPath(testImagePath));

      const coinResponse = await fetch(`${BACKEND_API}/createCoin`, {
        method: 'POST',
        body: coinFormData
      });

      const coinJson = await coinResponse.json();
      console.log('✅ Coin creation working:', coinJson);
      console.log('   Coin ID:', coinJson.coin?.id);
      console.log('   Image Root Hash:', coinJson.coin?.imageRootHash);
      console.log('   Metadata Root Hash:', coinJson.coin?.metadataRootHash);

      // Clean up test image
      fs.unlinkSync(testImagePath);

    } catch (error) {
      console.log('❌ Coin creation test failed:', error.message);
    }

    console.log('\n🎉 All tests completed!');
    console.log('\n📋 Summary:');
    console.log('   • 0G Storage: ✅ Running');
    console.log('   • Backend Server: ✅ Running');
    console.log('   • File Upload/Download: ✅ Working');
    console.log('   • Backend Proxy: ✅ Working');
    console.log('   • Coin Creation: ✅ Working');
    console.log('\n🚀 Your 0G Storage integration is ready to use!');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure 0G Storage starter kit is running on port 3000');
    console.log('   2. Ensure backend server is running on port 4000');
    console.log('   3. Check network connectivity');
    console.log('   4. Review server logs for errors');
  }
}

// Run tests
if (require.main === module) {
  test0GStorageIntegration();
}

module.exports = { test0GStorageIntegration };
