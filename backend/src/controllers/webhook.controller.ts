import { Request, Response, NextFunction } from 'express';
import {
  verifyWhatsAppSubscription,
  verifyWhatsAppSignature,
  processWhatsAppWebhookPayload,
} from '../services/whatsappWebhook.service';

/**
 * GET /api/webhooks/whatsapp
 * Meta WhatsApp Cloud API Webhook Verification Endpoint.
 * Validates hub.mode, hub.verify_token and returns hub.challenge to confirm subscription.
 */
export function handleWhatsAppVerification(req: Request, res: Response): void {
  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;

  const result = verifyWhatsAppSubscription(mode, token, challenge);

  if (result.isValid && result.challenge) {
    // Meta requires the challenge string to be returned directly as plain text with 200 OK
    res.status(200).send(result.challenge);
    return;
  }

  res.status(result.statusCode).send(result.errorMessage || 'Forbidden');
}

/**
 * POST /api/webhooks/whatsapp
 * Meta WhatsApp Cloud API Event Notification Endpoint.
 * Validates X-Hub-Signature-256 using Meta App Secret and raw body buffer.
 * Acknowledges valid webhooks promptly with 200 OK and processes events safely.
 */
export async function handleWhatsAppWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined;

    // Use preserved raw body buffer; fallback to buffer of stringified body if rawBody is absent
    const rawBody =
      req.rawBody ||
      (Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body || {}), 'utf-8'));

    // 1. Verify HMAC-SHA256 signature
    const sigResult = verifyWhatsAppSignature(signatureHeader, rawBody);
    if (!sigResult.isValid) {
      res.status(sigResult.statusCode).json({
        success: false,
        message: sigResult.errorMessage,
      });
      return;
    }

    // 2. Acknowledge promptly to Meta (prevents webhook timeout and retries)
    res.status(200).json({ success: true, message: 'EVENT_RECEIVED' });

    // 3. Process events safely in background
    processWhatsAppWebhookPayload(req.body).catch((err) => {
      console.error('[WhatsApp Webhook] Background processing error:', err.message);
    });
  } catch (error) {
    next(error);
  }
}
