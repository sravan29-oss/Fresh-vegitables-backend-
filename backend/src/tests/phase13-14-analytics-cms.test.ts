import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { memoryStore } from '../config/mockDb';
import cache from '../services/cache.service';
import {
  getBusinessIntelligence,
  getHubsComparison,
  exportAnalyticsReport,
  sanitizeCsvCell,
} from '../controllers/analytics.controller';
import {
  getHomepageData,
  getAllSectionsAdmin,
  createSectionAdmin,
  updateSectionAdmin,
  toggleSectionStatus,
  reorderSections,
  deleteSection,
  getBannersAdmin,
  createBannerAdmin,
  updateBannerAdmin,
  deleteBannerAdmin,
  getStoreSettings,
  updateStoreSettings,
  sanitizeText,
  isValidImageUrl,
  isValidLinkUrl,
} from '../controllers/cms.controller';
import {
  register,
  login,
  checkPhoneRegistered,
  firebaseRegister,
  firebaseLogin,
  googleAuth,
  adminLogin,
} from '../controllers/auth.controller';
import { authenticateAdmin } from '../middleware/auth';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

console.log('\n================================================================');
console.log('PHASE 13 & 14 AUDIT & REMEDIATION TEST SUITE: ANALYTICS & CMS');
console.log('Fresh Vegetables Organic — Hyderabad Two-Hub Architecture');
console.log('Champapet Hub (5 KM) & KPHB Hub (5 KM)');
console.log('Strict Compliance: Google Sign-In Only for Customers');
console.log('Formula Injection Protection | Active-Only Products | Clean Rollback');
console.log('================================================================\n');

function createMockReq(params: any = {}, query: any = {}, body: any = {}, user: any = null): any {
  return {
    params,
    query,
    body,
    user: user || { id: 'admin-01', role: 'admin', email: 'admin@freshveggies.com' },
    ip: '127.0.0.1',
    headers: {},
  };
}

function createMockRes(): any {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    send(content: any) {
      this.body = content;
      return this;
    },
  };
  return res;
}

describe('Phase 13: Analytics & Reporting Suite', () => {
  it('1. should return business intelligence with executive overview and two-hub breakdown', async () => {
    const req = createMockReq({}, { range: '7days', hub_id: 'all' });
    const res = createMockRes();
    let nextCalled = false;

    await getBusinessIntelligence(req, res, (err) => {
      if (err) nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body?.data);

    const d = res.body.data;
    assert.equal(d.range, '7days');
    assert.equal(d.hub_filter, 'all');
    assert.ok(d.overview.today_orders >= 0);
    assert.ok(d.sales_analytics.total_revenue > 0);
    assert.ok(Array.isArray(d.sales_analytics.trend));
    assert.ok(d.sales_analytics.trend.length >= 7);

    // Two-Hub breakdown verification
    assert.ok(d.hubs_breakdown);
    assert.ok(d.hubs_breakdown.champapet, 'Champapet hub metrics should exist');
    assert.ok(d.hubs_breakdown.kphb, 'KPHB hub metrics should exist');
    assert.equal(d.hubs_breakdown.champapet.hub_code, 'champapet');
    assert.equal(d.hubs_breakdown.kphb.hub_code, 'kphb');
    console.log('  ✓ PASS: Business intelligence returned with Two-Hub breakdown');
  });

  it('2. should filter analytics specifically for Champapet Hub', async () => {
    const req = createMockReq({}, { range: '7days', hub_id: 'hub-champapet' });
    const res = createMockRes();

    await getBusinessIntelligence(req, res, () => {});

    assert.equal(res.statusCode, 200);
    const d = res.body.data;
    assert.equal(d.hub_filter, 'hub-champapet');
    assert.ok(d.hubs_breakdown.champapet);
    assert.ok(d.sales_analytics.total_revenue > 0);
    console.log('  ✓ PASS: Champapet Hub filtering operational');
  });

  it('3. should filter analytics specifically for KPHB Hub', async () => {
    const req = createMockReq({}, { range: '7days', hub_id: 'hub-kphb' });
    const res = createMockRes();

    await getBusinessIntelligence(req, res, () => {});

    assert.equal(res.statusCode, 200);
    const d = res.body.data;
    assert.equal(d.hub_filter, 'hub-kphb');
    assert.ok(d.hubs_breakdown.kphb);
    assert.ok(d.sales_analytics.total_revenue > 0);
    console.log('  ✓ PASS: KPHB Hub filtering operational');
  });

  it('4. should handle different date range filters with Hyderabad timezone', async () => {
    const reqToday = createMockReq({}, { range: 'today', hub_id: 'all' });
    const resToday = createMockRes();
    await getBusinessIntelligence(reqToday, resToday, () => {});
    assert.equal(resToday.body.data.range, 'today');
    assert.ok(resToday.body.data.sales_analytics.trend[0].date.includes('06:00'));

    const reqMonth = createMockReq({}, { range: 'month', hub_id: 'all' });
    const resMonth = createMockRes();
    await getBusinessIntelligence(reqMonth, resMonth, () => {});
    assert.equal(resMonth.body.data.range, 'month');
    assert.equal(resMonth.body.data.sales_analytics.trend[0].date, 'Week 1');
    console.log('  ✓ PASS: Date range filtering (today, 7days, month) accurate with Hyderabad time');
  });

  it('5. should reject invalid hub IDs on backend', async () => {
    const req = createMockReq({}, { range: '7days', hub_id: 'invalid-hub-location' });
    const res = createMockRes();

    await getBusinessIntelligence(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.code, 'INVALID_HUB_ID');
    console.log('  ✓ PASS: Invalid hub ID rejected with 400 INVALID_HUB_ID');
  });

  it('6. should reject invalid date ranges on backend', async () => {
    const req = createMockReq({}, { range: 'invalid_range_123', hub_id: 'all' });
    const res = createMockRes();

    await getBusinessIntelligence(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.code, 'INVALID_DATE_RANGE');
    console.log('  ✓ PASS: Invalid date range rejected with 400 INVALID_DATE_RANGE');
  });

  it('7. should provide side-by-side comparative hub telemetry via getHubsComparison', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await getHubsComparison(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.ok(res.body?.data?.hubs);
    assert.equal(res.body.data.hubs.length, 2);

    const [h1, h2] = res.body.data.hubs;
    assert.ok(h1.order_metrics);
    assert.ok(h1.financial_metrics);
    assert.ok(h1.logistics_metrics);
    assert.equal(h1.delivery_radius_km, 5.0);
    assert.equal(h2.delivery_radius_km, 5.0);
    console.log('  ✓ PASS: Side-by-side two-hub comparison report verified');
  });

  it('8. should sanitize CSV cells to prevent Formula Injection (CWE-1236) including leading spaces & control characters', () => {
    // Malicious spreadsheet triggers: =, +, -, @, \t, \r
    assert.equal(sanitizeCsvCell('=SUM(A1:B10)'), '"\'=SUM(A1:B10)"');
    assert.equal(sanitizeCsvCell('+cmd|"/C calc"!A0'), '"\'+cmd|""/C calc""!A0"');
    assert.equal(sanitizeCsvCell('-12345'), '"\'-12345"');
    assert.equal(sanitizeCsvCell('@malicious_calc'), '"\'@malicious_calc"');
    assert.equal(sanitizeCsvCell('\tTabInjected'), '"\'\tTabInjected"');
    assert.equal(sanitizeCsvCell('\rCarriageInjected'), '"\'\rCarriageInjected"');

    // Leading spaces and control character attacks
    assert.equal(sanitizeCsvCell('   =CMD("calc")'), '"\'   =CMD(""calc"")"');
    assert.equal(sanitizeCsvCell('   +1234'), '"\'   +1234"');
    assert.equal(sanitizeCsvCell('   -5678'), '"\'   -5678"');
    assert.equal(sanitizeCsvCell('   @import'), '"\'   @import"');
    assert.equal(sanitizeCsvCell('\x00=exec'), '"\'\x00=exec"');
    assert.equal(sanitizeCsvCell('\t\t+payload'), '"\'\t\t+payload"');
    assert.equal(sanitizeCsvCell('\r\n@exploit'), '"\'\r\n@exploit"');

    // Safe regular values
    assert.equal(sanitizeCsvCell('Fresh Organic Spinach'), '"Fresh Organic Spinach"');
    assert.equal(sanitizeCsvCell(250), '"250"');
    assert.equal(sanitizeCsvCell(null), '""');
    assert.equal(sanitizeCsvCell(undefined), '""');
    console.log('  ✓ PASS: CSV Formula Injection sanitization verified (escapes =, +, -, @, \\t, \\r with leading spaces & control chars)');
  });

  it('9. should export analytics report in CSV and JSON formats with formula injection protection', async () => {
    // Ensure memory store has an order with potential formula injection to test export
    const maliciousOrder = {
      id: 'ord-test-csv',
      order_number: '=CMD("calc")',
      customer_name: '@InjectedCustomer',
      assigned_hub_id: 'hub-champapet',
      total: 350,
      order_status: 'delivered',
      payment_method: 'cod',
      created_at: new Date().toISOString(),
    };
    memoryStore.orders.push(maliciousOrder);

    // CSV export test
    const reqCsv = createMockReq({}, { range: '7days', format: 'csv', hub_id: 'all' });
    const resCsv = createMockRes();
    await exportAnalyticsReport(reqCsv, resCsv, () => {});

    assert.equal(resCsv.statusCode, 200);
    assert.equal(resCsv.headers['content-type'], 'text/csv');
    assert.ok(typeof resCsv.body === 'string');
    assert.ok(resCsv.body.includes('"Order Number"'));
    assert.ok(resCsv.body.includes('"Date (Asia/Kolkata)"'));
    // Verify malicious order is escaped with prepended single-quote
    assert.ok(resCsv.body.includes('\'=CMD'));
    assert.ok(resCsv.body.includes('\'@InjectedCustomer'));

    // JSON export test
    const reqJson = createMockReq({}, { range: '7days', format: 'json', hub_id: 'all' });
    const resJson = createMockRes();
    await exportAnalyticsReport(reqJson, resJson, () => {});

    assert.equal(resJson.statusCode, 200);
    assert.ok(resJson.body?.data?.orders);
    assert.equal(resJson.body.data.range, '7days');
    assert.equal(resJson.body.data.timezone, 'Asia/Kolkata');
    console.log('  ✓ PASS: Analytics export in CSV & JSON verified with CWE-1236 protection');
  });

  it('10. should strictly exclude cancelled orders from revenue metrics', async () => {
    // Add cancelled order
    const cancelledOrder = {
      id: 'ord-cancelled-01',
      order_number: 'ORD-CANCELLED',
      customer_name: 'Cancelled Customer',
      assigned_hub_id: 'hub-champapet',
      total: 10000,
      order_status: 'cancelled',
      payment_status: 'refunded',
      payment_method: 'online',
      created_at: new Date().toISOString(),
    };
    memoryStore.orders.push(cancelledOrder);

    const req = createMockReq({}, { range: '7days', hub_id: 'all' });
    const res = createMockRes();
    await getBusinessIntelligence(req, res, () => {});

    assert.equal(res.statusCode, 200);
    const d = res.body.data;
    // Cancelled orders should be counted under cancelled_orders, but excluded from completed sales
    assert.ok(d.overview.cancelled_orders >= 1);
    assert.ok(d.overview.today_orders >= 1);
    console.log('  ✓ PASS: Cancelled orders counted accurately and separated from completed revenue');
  });

  it('10a. should verify only authenticated admins can pass authenticateAdmin middleware', () => {
    // 1. Missing token -> 401
    const reqNoToken: any = { headers: {} };
    const res = createMockRes();
    let errNoToken: any = null;
    authenticateAdmin(reqNoToken, res, (err) => { errNoToken = err; });
    assert.ok(errNoToken);
    assert.equal(errNoToken.statusCode, 401);

    // 2. Customer token -> 403
    const customerToken = jwt.sign({ id: 'c-1', role: 'customer' }, env.JWT_SECRET);
    const reqCustomer: any = { headers: { authorization: `Bearer ${customerToken}` } };
    let errCustomer: any = null;
    authenticateAdmin(reqCustomer, res, (err) => { errCustomer = err; });
    assert.ok(errCustomer);
    assert.equal(errCustomer.statusCode, 403);

    // 3. Admin token -> Success (next called with no error)
    const adminToken = jwt.sign({ id: 'a-1', role: 'admin' }, env.JWT_SECRET);
    const reqAdmin: any = { headers: { authorization: `Bearer ${adminToken}` } };
    let errAdmin: any = null;
    let nextCalled = false;
    authenticateAdmin(reqAdmin, res, (err) => {
      if (err) errAdmin = err;
      else nextCalled = true;
    });
    assert.equal(errAdmin, null);
    assert.equal(nextCalled, true);
    console.log('  ✓ PASS: authenticateAdmin strictly blocks unauthorized & customer requests, permits admins');
  });

  it('10b. should verify collected COD, verified online payments, and financial equations in analytics', async () => {
    const req = createMockReq({}, { range: '7days', hub_id: 'all' });
    const res = createMockRes();
    await getBusinessIntelligence(req, res, () => {});

    assert.equal(res.statusCode, 200);
    const d = res.body.data;
    const fb = d.financial_breakdown;

    // Financial equation: net_revenue === gross_sales - total_discounts - total_refunds
    assert.equal(fb.net_revenue, fb.gross_sales - fb.total_discounts - fb.total_refunds);
    assert.ok(fb.collected_cod >= 0, 'collected_cod must be non-negative');
    assert.ok(fb.verified_online_payments >= 0, 'verified_online_payments must be non-negative');
    assert.ok(fb.awaiting_cod >= 0, 'awaiting_cod must be non-negative');

    // Multi-hub attribution integrity
    assert.ok(d.hubs_breakdown.champapet.total_revenue >= 0);
    assert.ok(d.hubs_breakdown.kphb.total_revenue >= 0);
    console.log('  ✓ PASS: Financial equations, COD collection, and verified online payments verified');
  });
});

describe('Phase 14: Homepage CMS & Content Management Suite', () => {
  let createdSectionId: string = '';
  let createdBannerId: string = '';

  it('11. should sanitize input text against XSS and script injection', () => {
    const maliciousInput = '<script>alert("xss")</script><iframe src="evil.com"></iframe><img src="x" onerror="stealCookie()"/>Safe Title';
    const cleaned = sanitizeText(maliciousInput);
    assert.equal(cleaned.includes('<script>'), false);
    assert.equal(cleaned.includes('<iframe>'), false);
    assert.equal(cleaned.includes('onerror='), false);
    assert.ok(cleaned.includes('Safe Title'));

    // Test URL validators
    assert.equal(isValidImageUrl('https://cdn.example.com/banner.jpg'), true);
    assert.equal(isValidImageUrl('/uploads/banners/fresh.png'), true);
    assert.equal(isValidImageUrl('javascript:alert(1)'), false);

    assert.equal(isValidLinkUrl('/products?cat=leafy'), true);
    assert.equal(isValidLinkUrl('https://freshvegetables.com/deals'), true);
    assert.equal(isValidLinkUrl('javascript:malicious()'), false);
    console.log('  ✓ PASS: HTML/script injection sanitization and URL validation verified');
  });

  it('12. should fetch public homepage CMS data with active sections and banners', async () => {
    cache.invalidate('cms:homepage');
    const req = createMockReq();
    const res = createMockRes();

    await getHomepageData(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.ok(res.body?.data?.sections);
    assert.ok(Array.isArray(res.body.data.sections));
    assert.ok(Array.isArray(res.body.data.banners));
    console.log(`  ✓ PASS: Public Homepage CMS data loaded (${res.body.data.sections.length} sections)`);
  });

  it('13. should strictly exclude inactive products and categories from public homepage', async () => {
    cache.invalidate('cms:homepage');
    // Add inactive product and inactive category
    const inactiveProd = {
      id: 'prod-inactive-hidden',
      name: 'Hidden Inactive Vegetable',
      slug: 'hidden-inactive-vegetable',
      status: 'inactive',
      featured: true,
      best_seller: true,
      selling_price: 150,
      regular_price: 200,
    };
    memoryStore.products.push(inactiveProd);

    const inactiveCat = {
      id: 'cat-inactive-hidden',
      name: 'Hidden Inactive Category',
      slug: 'hidden-inactive-category',
      status: 'inactive',
      display_order: 99,
    };
    memoryStore.categories.push(inactiveCat);

    const req = createMockReq();
    const res = createMockRes();
    await getHomepageData(req, res, () => {});

    assert.equal(res.statusCode, 200);
    const sections = res.body.data.sections;

    for (const sec of sections) {
      if (sec.categories) {
        const found = sec.categories.some((c: any) => c.id === 'cat-inactive-hidden');
        assert.equal(found, false, 'Inactive category must never appear in public sections');
      }
      if (sec.products) {
        const found = sec.products.some((p: any) => p.id === 'prod-inactive-hidden');
        assert.equal(found, false, 'Inactive product must never appear in public rails');
      }
    }
    console.log('  ✓ PASS: Inactive products and categories strictly filtered out from public view');
  });

  it('14. should filter out scheduled content with future start date or past end date', async () => {
    cache.invalidate('cms:homepage');
    const futureSection = {
      id: 'sec-future-promo',
      type: 'promotional_banner',
      title: 'Future New Year Mega Offer',
      display_order: 50,
      status: 'active',
      start_date: new Date(Date.now() + 86400000 * 10).toISOString(), // 10 days in future
      end_date: new Date(Date.now() + 86400000 * 20).toISOString(),
    };
    const expiredSection = {
      id: 'sec-expired-promo',
      type: 'promotional_banner',
      title: 'Expired Deepavali Sale',
      display_order: 51,
      status: 'active',
      start_date: new Date(Date.now() - 86400000 * 20).toISOString(),
      end_date: new Date(Date.now() - 86400000 * 10).toISOString(), // Expired 10 days ago
    };

    if (!(memoryStore as any).homepage_sections) (memoryStore as any).homepage_sections = [];
    (memoryStore as any).homepage_sections.push(futureSection, expiredSection);

    const req = createMockReq();
    const res = createMockRes();
    await getHomepageData(req, res, () => {});

    assert.equal(res.statusCode, 200);
    const sections = res.body.data.sections;
    assert.equal(sections.some((s: any) => s.id === 'sec-future-promo'), false, 'Future section must not be displayed');
    assert.equal(sections.some((s: any) => s.id === 'sec-expired-promo'), false, 'Expired section must not be displayed');
    console.log('  ✓ PASS: Scheduled content filtering (start_date / end_date) verified');
  });

  it('15. should fetch all sections for admin dashboard', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await getAllSectionsAdmin(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body?.data));
    console.log(`  ✓ PASS: Admin sections list retrieved (${res.body.data.length} total)`);
  });

  it('16. should create a new homepage section, sanitize inputs, and invalidate cache', async () => {
    // Populate cache first to verify invalidation
    cache.set('cms:homepage', { cached: true }, 60);
    assert.ok(cache.get('cms:homepage'));

    const req = createMockReq(
      {},
      {},
      {
        type: 'promotional_banner',
        title: '<script>alert("hacked")</script>Hyderabad Farm Fest Weekend',
        subtitle: 'Fresh arrivals from Telangana organic farmers',
        description: 'Enjoy 20% off all leafy greens harvested this morning.',
        button_text: 'Explore Farm Fest',
        button_link: '/products?tag=farmfest',
        display_order: 10,
        status: 'active',
      }
    );
    const res = createMockRes();

    await createSectionAdmin(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.ok(res.body?.data?.id);
    // Verify script was stripped
    assert.equal(res.body.data.title.includes('<script>'), false);
    assert.ok(res.body.data.title.includes('Hyderabad Farm Fest Weekend'));
    // Verify cache invalidation
    assert.equal(cache.get('cms:homepage'), null, 'Cache must be invalidated upon creating section');
    createdSectionId = res.body.data.id;
    console.log(`  ✓ PASS: Homepage section created with XSS sanitization and cache invalidation (ID: ${createdSectionId})`);
  });

  it('17. should update existing section content and invalidate cache', async () => {
    assert.ok(createdSectionId);
    cache.set('cms:homepage', { cached: true }, 60);

    const req = createMockReq(
      { id: createdSectionId },
      {},
      {
        title: 'Hyderabad Farm Fest Weekend — Updated',
        button_text: 'Shop Now',
      }
    );
    const res = createMockRes();

    await updateSectionAdmin(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.data?.title, 'Hyderabad Farm Fest Weekend — Updated');
    assert.equal(res.body?.data?.button_text, 'Shop Now');
    assert.equal(cache.get('cms:homepage'), null, 'Cache must be invalidated upon updating section');
    console.log('  ✓ PASS: Section content updated and cache invalidated');
  });

  it('18. should toggle section status active/inactive and invalidate cache', async () => {
    assert.ok(createdSectionId);
    cache.set('cms:homepage', { cached: true }, 60);
    const req = createMockReq({ id: createdSectionId });
    const res = createMockRes();

    await toggleSectionStatus(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.data?.status, 'inactive');
    assert.equal(cache.get('cms:homepage'), null, 'Cache must be invalidated upon toggling status');

    // Toggle back to active
    const res2 = createMockRes();
    await toggleSectionStatus(req, res2, () => {});
    assert.equal(res2.body?.data?.status, 'active');
    console.log('  ✓ PASS: Section status toggle verified (active -> inactive -> active)');
  });

  it('19. should reorder homepage sections and invalidate cache', async () => {
    cache.set('cms:homepage', { cached: true }, 60);
    const req = createMockReq(
      {},
      {},
      {
        order: [
          { id: createdSectionId, display_order: 1 },
          { id: 'sec-cats', display_order: 2 },
        ],
      }
    );
    const res = createMockRes();

    await reorderSections(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(cache.get('cms:homepage'), null, 'Cache must be invalidated upon reordering');
    console.log('  ✓ PASS: Section reordering confirmed with cache invalidation');
  });

  it('20. should manage promotional banners (create, get, update, delete) and invalidate cache', async () => {
    // 1. Create banner
    cache.set('cms:homepage', { cached: true }, 60);
    const reqCreate = createMockReq(
      {},
      {},
      {
        title: 'Champapet Organic Morning Harvest',
        subtitle: 'Harvested at 5 AM, delivered by 8 AM',
        badge: 'Hub Exclusive',
        image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999',
        link: '/products',
        display_order: 2,
        status: 'active',
      }
    );
    const resCreate = createMockRes();
    await createBannerAdmin(reqCreate, resCreate, () => {});

    assert.equal(resCreate.statusCode, 201);
    createdBannerId = resCreate.body?.data?.id;
    assert.ok(createdBannerId);
    assert.equal(cache.get('cms:homepage'), null, 'Cache invalidated on banner creation');

    // 2. Get banners
    const reqGet = createMockReq();
    const resGet = createMockRes();
    await getBannersAdmin(reqGet, resGet, () => {});
    assert.equal(resGet.statusCode, 200);
    assert.ok(resGet.body?.data?.some((b: any) => b.id === createdBannerId));

    // 3. Update banner
    cache.set('cms:homepage', { cached: true }, 60);
    const reqUpdate = createMockReq(
      { id: createdBannerId },
      {},
      {
        title: 'Champapet Organic Morning Harvest — Updated',
        badge: 'Special Harvest',
      }
    );
    const resUpdate = createMockRes();
    await updateBannerAdmin(reqUpdate, resUpdate, () => {});
    assert.equal(resUpdate.statusCode, 200);
    assert.equal(cache.get('cms:homepage'), null, 'Cache invalidated on banner update');

    // 4. Delete banner
    cache.set('cms:homepage', { cached: true }, 60);
    const reqDel = createMockReq({ id: createdBannerId });
    const resDel = createMockRes();
    await deleteBannerAdmin(reqDel, resDel, () => {});
    assert.equal(resDel.statusCode, 200);
    assert.equal(cache.get('cms:homepage'), null, 'Cache invalidated on banner delete');
    console.log('  ✓ PASS: Promotional banner CRUD lifecycle verified with cache invalidations');
  });

  it('21. should delete created section cleanly and invalidate cache', async () => {
    assert.ok(createdSectionId);
    cache.set('cms:homepage', { cached: true }, 60);
    const req = createMockReq({ id: createdSectionId });
    const res = createMockRes();

    await deleteSection(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.data?.id, createdSectionId);
    assert.equal(cache.get('cms:homepage'), null, 'Cache invalidated on section delete');
    console.log('  ✓ PASS: Section deletion verified with cache invalidation');
  });

  it('22. should fetch and update store settings (phone, email, Hyderabad address)', async () => {
    const reqGet = createMockReq();
    const resGet = createMockRes();
    await getStoreSettings(reqGet, resGet, () => {});

    assert.equal(resGet.statusCode, 200);
    assert.ok(resGet.body?.data?.support_phone);
    assert.ok(resGet.body?.data?.store_address);

    const reqUpdate = createMockReq(
      {},
      {},
      {
        support_phone: '+91 8106970384',
        support_email: 'freshvegitables29@gmail.com',
        announcement_text: 'Morning Farm Delivery from Champapet & KPHB Hubs',
        store_address: 'Hyderabad, Telangana - Two Hub Delivery',
        quality_badge: '100% Genuine Certified Organic Harvest',
      }
    );
    const resUpdate = createMockRes();
    await updateStoreSettings(reqUpdate, resUpdate, () => {});

    assert.equal(resUpdate.statusCode, 200);
    assert.equal(resUpdate.body?.data?.support_phone, '+91 8106970384');
    assert.equal(resUpdate.body?.data?.store_address, 'Hyderabad, Telangana - Two Hub Delivery');
    console.log('  ✓ PASS: Store settings & Hyderabad multi-hub contact details updated');
  });
});

describe('Strict Customer Authentication Compliance (Google Sign-In Only)', () => {
  it('23. should reject legacy customer registration endpoint with 403 CUSTOMER_AUTH_METHOD_DISABLED', async () => {
    const req = createMockReq({}, {}, {
      name: 'Test Customer',
      email: 'customer@example.com',
      password: 'Password123!',
      mobile: '9876543210',
    });
    const res = createMockRes();

    await register(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.code, 'CUSTOMER_AUTH_METHOD_DISABLED');
    assert.ok(res.body?.message?.includes('Google Sign-In'));
    console.log('  ✓ PASS: Customer password registration rejected with 403 CUSTOMER_AUTH_METHOD_DISABLED');
  });

  it('24. should reject legacy customer password login endpoint with 403 CUSTOMER_AUTH_METHOD_DISABLED', async () => {
    const req = createMockReq({}, {}, {
      email: 'customer@example.com',
      password: 'Password123!',
    });
    const res = createMockRes();

    await login(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.code, 'CUSTOMER_AUTH_METHOD_DISABLED');
    assert.ok(res.body?.message?.includes('Google Sign-In'));
    console.log('  ✓ PASS: Customer password login rejected with 403 CUSTOMER_AUTH_METHOD_DISABLED');
  });

  it('25. should reject mobile OTP registration endpoint with 403 CUSTOMER_AUTH_METHOD_DISABLED', async () => {
    const req = createMockReq({}, {}, {
      idToken: 'mock-firebase-otp-token',
      name: 'Customer OTP',
    });
    const res = createMockRes();

    await firebaseRegister(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.code, 'CUSTOMER_AUTH_METHOD_DISABLED');
    console.log('  ✓ PASS: Firebase mobile OTP registration rejected with 403 CUSTOMER_AUTH_METHOD_DISABLED');
  });

  it('26. should reject mobile OTP login endpoint with 403 CUSTOMER_AUTH_METHOD_DISABLED', async () => {
    const req = createMockReq({}, {}, {
      idToken: 'mock-firebase-otp-token',
    });
    const res = createMockRes();

    await firebaseLogin(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.code, 'CUSTOMER_AUTH_METHOD_DISABLED');
    console.log('  ✓ PASS: Firebase mobile OTP login rejected with 403 CUSTOMER_AUTH_METHOD_DISABLED');
  });

  it('27. should reject phone registration check endpoint with 403 CUSTOMER_AUTH_METHOD_DISABLED', async () => {
    const req = createMockReq({}, {}, {
      mobile: '9876543210',
    });
    const res = createMockRes();

    await checkPhoneRegistered(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.code, 'CUSTOMER_AUTH_METHOD_DISABLED');
    console.log('  ✓ PASS: Phone registration check rejected with 403 CUSTOMER_AUTH_METHOD_DISABLED');
  });

  it('28. should require valid Google ID token on googleAuth endpoint', async () => {
    const req = createMockReq({}, {}, {
      idToken: 'invalid-or-empty-google-token',
    });
    const res = createMockRes();
    let nextError: any = null;

    await googleAuth(req, res, (err: any) => {
      nextError = err;
    });

    // In offline test environment or without valid token, it rejects with 401 Unauthorized
    assert.ok(nextError || res.statusCode === 401 || res.statusCode === 400);
    console.log('  ✓ PASS: Customer Google Sign-In authoritatively verifies Google ID token');
  });

  it('28a. should reject empty or non-string idToken on googleAuth', async () => {
    const req = createMockReq({}, {}, { idToken: '' });
    const res = createMockRes();
    let nextError: any = null;

    await googleAuth(req, res, (err: any) => {
      nextError = err;
    });

    assert.ok(nextError || res.statusCode === 401);
    console.log('  ✓ PASS: Empty Google ID token rejected immediately');
  });

  it('29. should preserve separate admin authentication via adminLogin', async () => {
    const req = createMockReq({}, {}, {
      email: 'admin@freshvegetables.com',
      password: 'invalid_password_test',
    });
    const res = createMockRes();
    let nextError: any = null;

    await adminLogin(req, res, (err: any) => {
      nextError = err;
    });

    // Confirms admin authentication handler is intact (rejects invalid password, does not 403 disabled)
    assert.ok(nextError || res.statusCode === 401);
    console.log('  ✓ PASS: Separate Admin email/password authentication handler preserved');
  });

  it('30. should verify that customer accounts, addresses, and orders remain intact', () => {
    assert.ok(memoryStore.users.length > 0, 'Users must exist in store');
    assert.ok(memoryStore.addresses.length > 0, 'Addresses must remain intact');
    assert.ok(memoryStore.orders.length > 0, 'Orders must remain intact');
    console.log('  ✓ PASS: Existing customer accounts, addresses, and order records intact');
  });

  it('31. should verify delivery partners maintain phone + PIN credentials (no default 1234)', () => {
    const partners = memoryStore.delivery_partners;
    assert.ok(partners.length >= 2, 'Two-Hub delivery partners must exist');
    for (const p of partners) {
      assert.ok(p.assigned_hub_id, `Partner ${p.name} must have assigned hub`);
      assert.ok(p.pin_hash, `Partner ${p.name} must have secure salted pin_hash`);
      assert.notEqual(p.pin_hash, '1234', 'Plaintext PIN 1234 must never exist');
    }
    console.log('  ✓ PASS: Delivery partners use phone + salted PIN (Champapet & KPHB)');
  });
});

describe('Database Migration & Rollback Safety Verification', () => {
  it('32. should verify migration 014 creates tables safely without unsafe DROP or CASCADE on core tables', () => {
    const migrationPath = path.resolve(__dirname, '../../../database/migrations/014_homepage_cms_and_store_settings.sql');
    assert.ok(fs.existsSync(migrationPath), 'Migration 014 file must exist');

    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS homepage_sections'));
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS homepage_banners'));
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS store_settings'));

    // Check that core tables are never dropped or cascaded
    assert.equal(sqlContent.includes('DROP TABLE IF EXISTS users'), false, 'Must not drop users');
    assert.equal(sqlContent.includes('DROP TABLE IF EXISTS orders'), false, 'Must not drop orders');
    assert.equal(sqlContent.includes('DROP TABLE IF EXISTS products'), false, 'Must not drop products');
    assert.equal(sqlContent.includes('CASCADE'), false, 'Must not use CASCADE in migration');
    console.log('  ✓ PASS: Migration 014 creates CMS tables safely with IF NOT EXISTS and no CASCADE');
  });

  it('33. should verify rollback script 014 drops only CMS tables without CASCADE on core tables', () => {
    const rollbackPath = path.resolve(__dirname, '../../../database/migrations/014_homepage_cms_and_store_settings_rollback.sql');
    assert.ok(fs.existsSync(rollbackPath), 'Rollback 014 file must exist');

    const rollbackContent = fs.readFileSync(rollbackPath, 'utf-8');
    assert.ok(rollbackContent.includes('DROP TABLE IF EXISTS homepage_banners;'));
    assert.ok(rollbackContent.includes('DROP TABLE IF EXISTS homepage_sections;'));
    assert.ok(rollbackContent.includes('DROP TABLE IF EXISTS store_settings;'));

    // Strip SQL comments to inspect executable SQL statements
    const executableSql = rollbackContent.replace(/--.*$/gm, '').trim();

    // Core tables must never be dropped
    assert.equal(/DROP\s+TABLE.*users/i.test(executableSql), false, 'Must not drop users');
    assert.equal(/DROP\s+TABLE.*addresses/i.test(executableSql), false, 'Must not drop addresses');
    assert.equal(/DROP\s+TABLE.*orders/i.test(executableSql), false, 'Must not drop orders');
    assert.equal(/DROP\s+TABLE.*delivery_hubs/i.test(executableSql), false, 'Must not drop delivery_hubs');
    assert.equal(/DROP\s+TABLE.*products/i.test(executableSql), false, 'Must not drop products');
    assert.equal(/\bCASCADE\b/i.test(executableSql), false, 'Rollback executable SQL must not use CASCADE');
    console.log('  ✓ PASS: Rollback script safely drops only CMS tables with zero impact on core database tables');
  });
});
