/**
 * Privacy & Security Utilities
 * Enforces zero-leakage of sensitive personal identifiable information (PII)
 * such as full phone numbers, message bodies, customer addresses, and secret tokens.
 */

/**
 * Masks a phone number preserving country code and last 4 digits only.
 * E.g. "+918106970384" -> "+91******0384"
 * E.g. "918106970384"  -> "91******0384"
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return 'N/A';
  const cleaned = String(phone).trim();
  if (cleaned.length <= 4) return '****';

  const visibleSuffix = cleaned.slice(-4);
  const prefix = cleaned.startsWith('+') ? cleaned.slice(0, 3) : cleaned.slice(0, 2);
  return `${prefix}******${visibleSuffix}`;
}

/**
 * Masks sensitive secrets or tokens (e.g. Meta app secret, verify token).
 */
export function maskSecret(secret?: string | null): string {
  if (!secret) return 'N/A';
  if (secret.length <= 6) return '******';
  return `${secret.slice(0, 3)}...${secret.slice(-3)}`;
}

/**
 * Safe logger for webhook events that guarantees:
 * - No access tokens or secrets are logged
 * - No full phone numbers are logged (masked only)
 * - No message contents or customer addresses are logged
 */
export function safeLogWebhookEvent(
  context: string,
  meta: {
    eventType: string;
    eventId?: string;
    phone?: string | null;
    status?: string;
    messageType?: string;
    isDuplicate?: boolean;
    errorCode?: number | string;
    note?: string;
  }
): void {
  const maskedPhone = meta.phone ? maskPhoneNumber(meta.phone) : undefined;
  console.log(`[WhatsApp Webhook] ${context}:`, {
    eventType: meta.eventType,
    ...(meta.eventId && { eventId: meta.eventId }),
    ...(maskedPhone && { recipient: maskedPhone }),
    ...(meta.status && { status: meta.status }),
    ...(meta.messageType && { messageType: meta.messageType }),
    ...(meta.isDuplicate && { isDuplicate: meta.isDuplicate }),
    ...(meta.errorCode && { errorCode: meta.errorCode }),
    ...(meta.note && { note: meta.note }),
    timestamp: new Date().toISOString(),
  });
}
