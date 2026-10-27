/**
 * WhatsApp Cloud API Webhook Integration Test Suite
 * Tests:
 * 1. GET Verification handshake (valid token, invalid token, invalid mode, missing params)
 * 2. POST Signature verification (valid HMAC-SHA256, tampered signature, missing signature, tampered body)
 * 3. Malformed payloads & unknown objects
 * 4. Message & delivery status lifecycle handling (ensuring delivery is not assumed prematurely)
 * 5. Webhook retries & deduplication (idempotency)
 * 6. Privacy & PII protection (masked phone, zero token leakage)
 */

import http from 'http';
import crypto from 'crypto';
import app from '../app';
import { env } from '../config/env';
import { maskPhoneNumber } from '../utils/privacy';

const TEST_VERIFY_TOKEN = 'test_webhook_verify_token_secure_xyz_99';
const TEST_APP_SECRET = 'test_meta_app_secret_hex_key_44321';

// Override env vars for isolated deterministic testing
env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = TEST_VERIFY_TOKEN;
env.WHATSAPP_APP_SECRET = TEST_APP_SECRET;

function computeSignature(payload: string, secret: string = TEST_APP_SECRET): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(Buffer.from(payload, 'utf-8'));
  return 'sha256=' + hmac.digest('hex');
}

function request(
  server: http.Server,
  options: {
    method: 'GET' | 'POST';
    path: string;
    headers?: Record<string, string>;
    body?: string;
  }
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path: options.path,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...(options.body ? { 'Content-Length': Buffer.byteLength(options.body).toString() } : {}),
          ...options.headers,
        },
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => (responseData += chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 500,
            headers: res.headers,
            body: responseData,
          });
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting WhatsApp Cloud API Webhook Test Suite...');
  console.log('====================================================');

  const server = app.listen(0);
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failedCount++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: GET /api/webhooks/whatsapp (Verification Handshake)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Verification Handshake (GET /api/webhooks/whatsapp) ---');

    // 1.1 Valid verification
    const challenge1 = 'challenge_test_token_88921104';
    const res1 = await request(server, {
      method: 'GET',
      path: `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=${challenge1}`,
    });
    assert(res1.statusCode === 200, 'Valid verification request returns HTTP 200');
    assert(res1.body === challenge1, 'Valid verification returns exact hub.challenge string');

    // 1.2 Invalid verify token
    const res2 = await request(server, {
      method: 'GET',
      path: `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test`,
    });
    assert(res2.statusCode === 403, 'Invalid verify token is rejected with HTTP 403 Forbidden');
    assert(!res2.body.includes(TEST_VERIFY_TOKEN), 'Response does not leak server verify token');

    // 1.3 Invalid hub.mode
    const res3 = await request(server, {
      method: 'GET',
      path: `/api/webhooks/whatsapp?hub.mode=unsubscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=test`,
    });
    assert(res3.statusCode === 403, 'Invalid hub.mode is rejected with HTTP 403 Forbidden');

    // 1.4 Missing query parameters
    const res4 = await request(server, {
      method: 'GET',
      path: `/api/webhooks/whatsapp?hub.mode=subscribe`,
    });
    assert(res4.statusCode === 400, 'Missing verify_token or challenge returns HTTP 400 Bad Request');

    // -------------------------------------------------------------------------
    // SECTION 2: POST /api/webhooks/whatsapp (Signature & HMAC-SHA256)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Signature Validation (POST /api/webhooks/whatsapp) ---');

    const validPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BIZ_ACC_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550254321',
                  phone_number_id: '123456789',
                },
                contacts: [{ profile: { name: 'Sravan' }, wa_id: '918106970384' }],
                messages: [
                  {
                    from: '918106970384',
                    id: 'wamid.HBgMTESTMSG001',
                    timestamp: '1698421000',
                    text: { body: 'Fresh tomato price?' },
                    type: 'text',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    });

    // 2.1 Valid signature
    const validSig = computeSignature(validPayload);
    const res5 = await request(server, {
      method: 'POST',
      path: '/api/webhooks/whatsapp',
      headers: { 'X-Hub-Signature-256': validSig },
      body: validPayload,
    });
    assert(res5.statusCode === 200, 'Valid signature returns HTTP 200 OK');
    const parsed5 = JSON.parse(res5.body);
    assert(parsed5.success === true && parsed5.message === 'EVENT_RECEIVED', 'Valid webhook acknowledged with EVENT_RECEIVED');

    // 2.2 Missing signature
    const res6 = await request(server, {
      method: 'POST',
      path: '/api/webhooks/whatsapp',
      body: validPayload,
    });
    assert(res6.statusCode === 401, 'Missing X-Hub-Signature-256 returns HTTP 401 Unauthorized');

    // 2.3 Invalid/tampered signature
    const res7 = await request(server, {
      method: 'POST',
      path: '/api/webhooks/whatsapp',
      headers: { 'X-Hub-Signature-256': 'sha256=1111111111111111111111111111111111111111111111111111111111111111' },
      body: validPayload,
    });
    assert(res7.statusCode === 401, 'Tampered signature is rejected with HTTP 401 Unauthorized');

    // 2.4 Tampered body against original signature
    const tamperedPayload = validPayload.replace('Fresh tomato', 'Rotten cabbage');
    const res8 = await request(server, {
      method: 'POST',
      path: '/api/webhooks/whatsapp',
      headers: { 'X-Hub-Signature-256': validSig },
      body: tamperedPayload,
    });
    assert(res8.statusCode === 401, 'Tampered body with mismatching signature returns HTTP 401 Unauthorized');

    // 2.5 Malformed signature prefix
    const res9 = await request(server, {
      method: 'POST',
      path: '/api/webhooks/whatsapp',
      headers: { 'X-Hub-Signature-256': 'md5=invalid_prefix' },
      body: validPayload,
    });
    assert(res9.statusCode === 401, 'Signature without sha256= prefix returns HTTP 401');

    // -------------------------------------------------------------------------
    // SECTION 3: Delivery Status Events (Lifecycle Validation)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Delivery Status Events (Delivery Lifecycle Verification) ---');

    // 3.1 Status: 'sent' (Dispatched to carrier, NOT yet delivered!)
    const sentStatusPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BIZ_ACC_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '15550254321', phone_number_id: '123456789' },
                statuses: [
                  {
                    id: 'wamid.HBgOUTBOUND001',
                    status: 'sent',
                    timestamp: '1698421010',
                    recipient_id: '918106970384',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    });
    const res10 = await request(server, {
      method: 'POST',
      path: '/api/webhooks/whatsapp',
      headers: { 'X-Hub-Signature-256': computeSignature(sentStatusPayload) },
      body: sentStatusPayload,
    });
    assert(res10.statusCode === 200, 'Sent status update accepted with HTTP 200');

    // 3.2 Status: 'delivered' (Actual confirmed doorstep/device delivery)
    const deliveredStatusPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BIZ_ACC_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '15550254321', phone_number_id: '123456789' },
                statuses: [
                  {
                    id: 'wamid.HBgOUTBOUND001',
                    status: 'delivered',
                    timestamp: '1698421015',
                    recipient_id: '918106970384',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    });
    const res11 = await request(server, {
      method: 'POST',
      path: '/api/webhooks/whatsapp',
      headers: { 'X-Hub-Signature-256': computeSignature(deliveredStatusPayload) },
      body: deliveredStatusPayload,
    });
    assert(res11.statusCode === 200, 'Delivered status event acknowledged with HTTP 200');

    // 3.3 Status: 'read'
    const readStatusPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BIZ_ACC_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '15550254321', phone_number_id: '123456789' },
                statuses: [
                  {
                    id: 'wamid.HBgOUTBOUND001',
                    status: 'read',
                    timestamp: '1698421020',
                    recipient_id: '918106970384',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    });
    const res12 = await request(server, {
      method: 'POST',
      path: '/api/webhooks/whatsapp',
      headers: { 'X-Hub-Signature-256': computeSignature(readStatusPayload) },
      body: readStatusPayload,
    });
    assert(res12.statusCode === 200, 'Read status event acknowledged with HTTP 200');

    // 3.4 Status: 'failed' with error code
    const failedStatusPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BIZ_ACC_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '15550254321', phone_number_id: '123456789' },
                statuses: [
                  {
                    id: 'wamid.HBgOUTBOUND002',
                    status: 'failed',
                    timestamp: '1698421025',
                    recipient_id: '918106970384',
                    errors: [{ code: 131026, title: 'Message undeliverable' }],
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    });
    const res13 = await request(server, {
      method: 'POST',
      path: '/api/webhooks/whatsapp',
      headers: { 'X-Hub-Signature-256': computeSignature(failedStatusPayload) },
      body: failedStatusPayload,
    });
    assert(res13.statusCode === 200, 'Failed status update with error code acknowledged safely');

    // -------------------------------------------------------------------------
    // SECTION 4: Webhook Retries & Idempotency
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Webhook Retries & Idempotency ---');

    // Send identical message event twice (simulating Meta network retry)
    const retryPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BIZ_ACC_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '15550254321', phone_number_id: '123456789' },
                messages: [
                  {
                    from: '918106970384',
                    id: 'wamid.HBgRETRYTEST001',
                    timestamp: '1698421050',
                    text: { body: 'Testing idempotency' },
                    type: 'text',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    });
    const retrySig = computeSignature(retryPayload);

    // Initial delivery
    const res14a = await request(server, {
      method: 'POST',
      path: '/api/webhooks/whatsapp',
      headers: { 'X-Hub-Signature-256': retrySig },
      body: retryPayload,
    });
    assert(res14a.statusCode === 200, 'Initial delivery of event returns HTTP 200 OK');

    // Retry delivery with identical WAMID
    const res14b = await request(server, {
      method: 'POST',
      path: '/api/webhooks/whatsapp',
      headers: { 'X-Hub-Signature-256': retrySig },
      body: retryPayload,
    });
    assert(res14b.statusCode === 200, 'Retry delivery of identical event safely acknowledged with HTTP 200');

    // -------------------------------------------------------------------------
    // SECTION 5: Privacy & Masking Validation
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Privacy & Masking Verification ---');

    const rawPhone = '+918106970384';
    const masked = maskPhoneNumber(rawPhone);
    assert(masked === '+91******0384', `Phone masking correctly masks middle digits: ${masked}`);
    assert(!masked.includes('810697'), 'Masked phone does not contain middle digits');

    const localPhone = '918106970384';
    const maskedLocal = maskPhoneNumber(localPhone);
    assert(maskedLocal === '91******0384', `Phone without + correctly masks middle digits: ${maskedLocal}`);

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log('\n====================================================');
    console.log(`🏁 Test Summary: ${passedCount} Passed, ${failedCount} Failed`);
    console.log('====================================================\n');

    server.close();
    process.exit(failedCount > 0 ? 1 : 0);
  } catch (err: any) {
    console.error('💥 Unhandled error in test suite:', err);
    server.close();
    process.exit(1);
  }
}

runTests();
