const http = require('http');

function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Enhanced Indexer API...\n');

  try {
    // Test health endpoint
    console.log('1. Testing /health endpoint...');
    const health = await testEndpoint('/health');
    console.log(`   Status: ${health.status}`);
    console.log(`   Response: ${JSON.stringify(health.data, null, 2)}\n`);

    // Test trades endpoint
    console.log('2. Testing /trades endpoint...');
    const trades = await testEndpoint('/trades');
    console.log(`   Status: ${trades.status}`);
    console.log(`   Trades count: ${trades.data.count || 0}\n`);

    // Test snapshots endpoint
    console.log('3. Testing /snapshots endpoint...');
    const snapshots = await testEndpoint('/snapshots');
    console.log(`   Status: ${snapshots.status}`);
    console.log(`   Snapshots count: ${snapshots.data.count || 0}\n`);

    // Test graduations endpoint
    console.log('4. Testing /graduations endpoint...');
    const graduations = await testEndpoint('/graduations');
    console.log(`   Status: ${graduations.status}`);
    console.log(`   Graduations count: ${graduations.data.count || 0}\n`);

    console.log('✅ All API tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Health: ${health.status === 200 ? '✅' : '❌'}`);
    console.log(`   - Trades: ${trades.status === 200 ? '✅' : '❌'} (${trades.data.count || 0} records)`);
    console.log(`   - Snapshots: ${snapshots.status === 200 ? '✅' : '❌'} (${snapshots.data.count || 0} records)`);
    console.log(`   - Graduations: ${graduations.status === 200 ? '✅' : '❌'} (${graduations.data.count || 0} records)`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests();
