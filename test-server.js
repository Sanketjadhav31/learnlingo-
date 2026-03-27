// Quick test script to verify server endpoints
const http = require('http');

function testEndpoint(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`\n${method} ${path}`);
        console.log(`Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log('Response:', JSON.stringify(json, null, 2).slice(0, 500));
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          console.log('Response (text):', data.slice(0, 500));
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', (e) => {
      console.error(`Error: ${e.message}`);
      reject(e);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing server endpoints...\n');
  console.log('='.repeat(50));

  try {
    // Test health
    await testEndpoint('/api/health');

    // Test day endpoint
    await testEndpoint('/api/day?userId=test-user');

    // Test status
    await testEndpoint('/api/status?userId=test-user');

    console.log('\n' + '='.repeat(50));
    console.log('✓ All tests completed!');
  } catch (e) {
    console.error('\n❌ Test failed:', e.message);
  }
}

runTests();
