const http = require('http');

const endpoints = [
  '/robots.txt',
  '/sitemap.xml',
  '/api/feeds/google-shopping.xml',
  '/api/cms/homepage',
  '/api/zones',
  '/api/audit-logs/health'
];

async function testAll() {
  for (const ep of endpoints) {
    await new Promise((resolve) => {
      http.get('http://localhost:3000' + ep, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`[PASS] ${ep} -> Status: ${res.statusCode}, Length: ${data.length}, Type: ${res.headers['content-type']}`);
          resolve();
        });
      }).on('error', (err) => {
        console.log(`[FAIL] ${ep} -> ${err.message}`);
        resolve();
      });
    });
  }
}

testAll();
