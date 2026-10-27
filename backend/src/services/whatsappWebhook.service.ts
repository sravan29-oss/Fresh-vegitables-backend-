import crypto from 'crypto';
import db from '../config/database';
import { env } from '../config/env';
import { maskPhoneNumber, safeLogWebhookEvent } from '../utils/privacy';

export interface WebhookVerificationResult {
  isValid: boolean;
  statusCode: number;
  challenge?: string;
  errorMessage?: string;
}

export interface SignatureVerificationResult {
  isValid: boolean;
  statusCode: number;
  errorMessage?: string;
}

// In-memory LRU / deduplication cache for fast idempotency checks
const processedEventsCache = new Set<string>();
const MAX_CACHE_SIZE = 10000;

function rememberEvent(key: string): boolean {
  if (processedEventsCache.has(key)) {
    return true; // Already processed
  }
  if (processedEventsCache.size >= MAX_CACHE_SIZE) {
    // Clear oldest items if cache grows too large
    const firstKey = processedEventsCache.values().next().value;
    if (firstKey) processedEventsCache.delete(firstKey);
  }
  processedEventsCache.add(key);
  return false;
}

/**
 * Verify WhatsApp Webhook Subscription (GET /api/webhooks/whatsapp)
 * Validates hub.mode, hub.verify_token, and returns hub.challenge.
 */
export function verifyWhatsAppSubscription(
  mode?: string,
  verifyToken?: string,
  challenge?: string
): WebhookVerificationResult {
  if (!mode || !verifyToken || !challenge) {
    return {
      isValid: false,
      statusCode: 400,
      errorMessage: 'Missing required verification query parameters: hub.mode, hub.verify_token, hub.challenge',
    };
  }

  if (mode !== 'subscribe') {
    return {
      isValid: false,
      statusCode: 403,
      errorMessage: 'Invalid hub.mode parameter. Expected "subscribe".',
    };
  }

  const configuredToken = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!configuredToken) {
    console.warn('[WhatsApp Webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN is not configured on server.');
    return {
      isValid: false,
      statusCode: 403,
      errorMessage: 'Server webhook verification token is not configured.',
    };
  }

  // Constant-time token comparison to prevent timing side-channel attacks
  const tokenBuf = Buffer.from(verifyToken);
  const configuredBuf = Buffer.from(configuredToken);

  const tokensMatch =
    tokenBuf.length === configuredBuf.length &&
    crypto.timingSafeEqual(tokenBuf, configuredBuf);

  if (!tokensMatch) {
    return {
      isValid: false,
      statusCode: 403,
      errorMessage: 'Verification token mismatch.',
    };
  }

  return {
    isValid: true,
    statusCode: 200,
    challenge,
  };
}

/**
 * Validate Meta X-Hub-Signature-256 for POST requests.
 * Uses HMAC-SHA256 computed over the exact raw request body buffer.
 */
export function verifyWhatsAppSignature(
  signatureHeader?: string,
  rawBody?: Buffer
): SignatureVerificationResult {
  const appSecret = env.WHATSAPP_APP_SECRET;

  // If app secret is not configured, warn and reject in production; in test allow if explicitly configured
  if (!appSecret) {
    if (env.NODE_ENV === 'production') {
      return {
        isValid: false,
        statusCode: 401,
        errorMessage: 'WHATSAPP_APP_SECRET is not configured on server. Cannot verify webhook signature.',
      };
    }
    // In local development without secret configured, issue warning
    console.warn('[WhatsApp Webhook] Warning: WHATSAPP_APP_SECRET not set. Skipping signature verification in dev mode.');
    return { isValid: true, statusCode: 200 };
  }

  if (!signatureHeader) {
    return {
      isValid: false,
      statusCode: 401,
      errorMessage: 'Missing X-Hub-Signature-256 header.',
    };
  }

  if (!signatureHeader.startsWith('sha256=')) {
    return {
      isValid: false,
      statusCode: 401,
      errorMessage: 'Invalid signature algorithm. Expected sha256= prefix.',
    };
  }

  if (!rawBody || !Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    return {
      isValid: false,
      statusCode: 400,
      errorMessage: 'Raw request body is missing or empty. Unable to verify signature.',
    };
  }

  const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const sigBuf = Buffer.from(signatureHeader);
  const expBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return {
      isValid: false,
      statusCode: 401,
      errorMessage: 'X-Hub-Signature-256 signature verification failed.',
    };
  }

  return {
    isValid: true,
    statusCode: 200,
  };
}

/**
 * Process WhatsApp Webhook Events safely and idempotently.
 * Handles incoming messages and delivery status events without assuming delivery.
 */
export async function processWhatsAppWebhookPayload(payload: any): Promise<{
  received: boolean;
  messageCount: number;
  statusCount: number;
}> {
  let messageCount = 0;
  let statusCount = 0;

  if (!payload || typeof payload !== 'object') {
    return { received: false, messageCount, statusCount };
  }

  // Meta sends object: 'whatsapp_business_account'
  if (payload.object !== 'whatsapp_business_account') {
    return { received: false, messageCount, statusCount };
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const change of changes) {
      if (change.field !== 'messages') continue;
      const value = change.value;
      if (!value) continue;

      // 1. Process Incoming Messages
      if (Array.isArray(value.messages)) {
        for (const message of value.messages) {
          messageCount++;
          const messageId = message.id;
          const fromPhone = message.from;
          const messageType = message.type || 'unknown';
          const timestamp = message.timestamp;

          const eventKey = `msg:${messageId}`;
          const isDuplicate = rememberEvent(eventKey);

          if (isDuplicate) {
            safeLogWebhookEvent('Message Event (Retry/Duplicate Ignored)', {
              eventType: 'message',
              eventId: messageId,
              phone: fromPhone,
              messageType,
              isDuplicate: true,
            });
            continue;
          }

          // Persist to database for auditing and deduplication
          const maskedPhone = maskPhoneNumber(fromPhone);
          try {
            await db.query(
              `INSERT INTO whatsapp_webhook_events 
               (event_id, event_type, message_type, phone_masked, payload_metadata)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (event_id) DO NOTHING`,
              [
                eventKey,
                'message',
                messageType,
                maskedPhone,
                JSON.stringify({
                  timestamp,
                  message_id: messageId,
                }),
              ]
            );
          } catch (dbErr: any) {
            console.warn('[WhatsApp Webhook] Event persistence warning:', dbErr.message);
          }

          safeLogWebhookEvent('Message Event Processed', {
            eventType: 'message',
            eventId: messageId,
            phone: fromPhone,
            messageType,
          });
        }
      }

      // 2. Process Delivery Status Updates (sent, delivered, read, failed)
      // Note: Never assume delivery just because message dispatch API succeeded!
      if (Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          statusCount++;
          const statusId = status.id; // WAMID of the outbound message
          const deliveryStatus = status.status; // 'sent' | 'delivered' | 'read' | 'failed'
          const recipientId = status.recipient_id;
          const timestamp = status.timestamp;

          const eventKey = `status:${statusId}:${deliveryStatus}:${timestamp}`;
          const isDuplicate = rememberEvent(eventKey);

          if (isDuplicate) {
            safeLogWebhookEvent('Status Event (Retry/Duplicate Ignored)', {
              eventType: 'status',
              eventId: statusId,
              phone: recipientId,
              status: deliveryStatus,
              isDuplicate: true,
            });
            continue;
          }

          // Extract non-sensitive error code if status === 'failed'
          const errorCode =
            status.errors && status.errors.length > 0 ? status.errors[0].code : undefined;
          const errorTitle =
            status.errors && status.errors.length > 0 ? status.errors[0].title : undefined;

          const maskedPhone = maskPhoneNumber(recipientId);
          try {
            await db.query(
              `INSERT INTO whatsapp_webhook_events 
               (event_id, event_type, status, phone_masked, payload_metadata)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (event_id) DO NOTHING`,
              [
                eventKey,
                'status',
                deliveryStatus,
                maskedPhone,
                JSON.stringify({
                  message_id: statusId,
                  timestamp,
                  status: deliveryStatus,
                  ...(errorCode && { error_code: errorCode, error_title: errorTitle }),
                }),
              ]
            );
          } catch (dbErr: any) {
            console.warn('[WhatsApp Webhook] Status persistence warning:', dbErr.message);
          }

          safeLogWebhookEvent('Delivery Status Updated', {
            eventType: 'status',
            eventId: statusId,
            phone: recipientId,
            status: deliveryStatus,
            errorCode,
          });
        }
      }
    }
  }

  return {
    received: true,
    messageCount,
    statusCount,
  };
}
