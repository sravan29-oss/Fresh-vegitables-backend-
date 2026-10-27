const http = require('http');

function post(url, data, token = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const bodyStr = JSON.stringify(data || {});
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers,
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function get(url, token = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    http.get({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      headers,
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    }).on('error', reject);
  });
}

function patch(url, token = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'PATCH',
      headers,
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const PORT = process.env.PORT || 5000;

async function runTests() {
  console.log(`🧪 Starting Phase 13 CMS End-to-End Verification on port ${PORT}...\n`);

  // 1. Customer Public Homepage
  const hp1 = await get(`http://localhost:${PORT}/api/cms/homepage`);
  console.log(`[1] Public Homepage: Status ${hp1.status}, Sections: ${hp1.body?.data?.sections?.length}, Banners: ${hp1.body?.data?.banners?.length}`);
  const initialCount = hp1.body?.data?.sections?.length || 0;
  const firstSection = hp1.body?.data?.sections?.[0];

  // 2. Security: Unauthorized Admin Sections Access Check
  const unauth = await get(`http://localhost:${PORT}/api/cms/sections`);
  console.log(`[2] Unauthorized Access /api/cms/sections: Status ${unauth.status} (Expected 401)`);

  // 3. Admin Login
  const loginRes = await post(`http://localhost:${PORT}/api/auth/admin/login`, {
    email: 'admin@freshveggies.com',
    password: 'admin123',
  });
  const adminToken = loginRes.body?.data?.accessToken || loginRes.body?.data?.token;
  console.log(`[3] Admin Login: Status ${loginRes.status}, Token Acquired: ${!!adminToken}`);

  // 4. Admin Sections Query
  const adminSecs = await get(`http://localhost:${PORT}/api/cms/sections`, adminToken);
  console.log(`[4] Admin Sections: Status ${adminSecs.status}, Total Found: ${adminSecs.body?.data?.length}`);

  // 5. Admin Banners Query
  const adminBnrs = await get(`http://localhost:${PORT}/api/cms/banners`, adminToken);
  console.log(`[5] Admin Banners: Status ${adminBnrs.status}, Total Found: ${adminBnrs.body?.data?.length}`);

  // 6. Disable a Section (Toggle)
  if (firstSection) {
    const toggleRes = await patch(`http://localhost:${PORT}/api/cms/sections/${firstSection.id}/toggle`, adminToken);
    console.log(`[6] Toggle Section '${firstSection.title}': Status ${toggleRes.status}, New Status: ${toggleRes.body?.data?.status}`);

    // Verify Customer Homepage omits disabled section
    const hp2 = await get(`http://localhost:${PORT}/api/cms/homepage`);
    const hasDisabled = hp2.body?.data?.sections?.some(s => s.id === firstSection.id);
    console.log(`[7] Public Homepage reflects disabled section: Omitted = ${!hasDisabled} (Sections now: ${hp2.body?.data?.sections?.length})`);

    // Toggle Back
    const toggleBack = await patch(`http://localhost:${PORT}/api/cms/sections/${firstSection.id}/toggle`, adminToken);
    console.log(`[8] Re-enable Section: Status ${toggleBack.status}, Restored Status: ${toggleBack.body?.data?.status}`);
  }

  // 9. Create a New Promotional Banner
  const createBnr = await post(`http://localhost:${PORT}/api/cms/banners`, {
    title: 'Monsoon Farm Specials',
    subtitle: 'Flat 20% OFF on all Green Leafy Veggies',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200',
    link: '/products?category=leafy-greens',
    badge: 'Seasonal Pick',
    display_order: 9,
    status: 'active',
  }, adminToken);
  console.log(`[9] Create Banner Slide: Status ${createBnr.status}, Created ID: ${createBnr.body?.data?.id}`);

  // 10. Verify Live Homepage has New Banner
  const hp3 = await get(`http://localhost:${PORT}/api/cms/homepage`);
  const bannerFound = hp3.body?.data?.banners?.some(b => b.title === 'Monsoon Farm Specials');
  console.log(`[10] Customer Homepage reflects new banner: ${bannerFound ? 'PASSED ✅' : 'FAILED ❌'}`);

  console.log('\n✨ Phase 13 CMS Test Suite Complete!');
}

runTests();
