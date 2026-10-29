import nodemailer from 'nodemailer';
import db from '../config/database';
import { env } from '../config/env';

/**
 * HTML escaper to sanitize any user-provided strings before inserting into email templates
 */
function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format timestamp in the store's configured business timezone (default: Asia/Kolkata / IST)
 */
function formatOrderDateTime(dateStr: string | Date): string {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: env.BUSINESS_TIMEZONE || 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d) + ' IST';
  } catch (err) {
    return new Date(dateStr).toLocaleString() + ' IST';
  }
}

/**
 * Format delivery address components into a clean single string
 */
function formatDeliveryAddress(snapshot: any): string {
  if (!snapshot) return 'No address provided';
  if (typeof snapshot === 'string') {
    try {
      snapshot = JSON.parse(snapshot);
    } catch {
      return snapshot;
    }
  }

  const parts = [
    snapshot.house_number ? `Flat/House: ${snapshot.house_number}` : '',
    snapshot.street,
    snapshot.landmark ? `Near: ${snapshot.landmark}` : '',
    snapshot.area,
    snapshot.city,
    snapshot.state,
    snapshot.pincode ? `Pincode: ${snapshot.pincode}` : '',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : 'Delivery address not available';
}

/**
 * Compute Google Maps navigation URL safely:
 * Coordinates preferred if valid, else encoded address, or null.
 */
function computeGoogleMapsUrl(snapshot: any): { url: string | null; isGps: boolean } {
  if (!snapshot) return { url: null, isGps: false };
  if (typeof snapshot === 'string') {
    try {
      snapshot = JSON.parse(snapshot);
    } catch {}
  }

  const lat = Number(snapshot.latitude);
  const lng = Number(snapshot.longitude);

  if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return {
      url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      isGps: true,
    };
  }

  const formatted = formatDeliveryAddress(snapshot);
  if (formatted && formatted !== 'No address provided' && formatted !== 'Delivery address not available') {
    return {
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatted)}`,
      isGps: false,
    };
  }

  return { url: null, isGps: false };
}

/**
 * 1. Send via Resend HTTPS API (Port 443 — immune to cloud firewall SMTP restrictions)
 */
async function sendViaResend(options: {
  apiKey: string;
  from?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const fromAddress = options.from || 'Fresh Vegetables <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    const data: any = await res.json();
    if (!res.ok) {
      return { success: false, error: data?.message || data?.error?.message || `Resend error HTTP ${res.status}` };
    }
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 2. Send via Brevo HTTPS API (Port 443 — 300 free emails/day)
 */
async function sendViaBrevo(options: {
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': options.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: options.fromName || 'Fresh Vegetables Orders',
          email: options.fromEmail || 'freshvegitables29@gmail.com',
        },
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: options.html,
        textContent: options.text,
      }),
    });

    const data: any = await res.json();
    if (!res.ok) {
      return { success: false, error: data?.message || `Brevo error HTTP ${res.status}` };
    }
    return { success: true, messageId: data?.messageId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 3. Send via Google Apps Script Webhook (Directly from user's Gmail over HTTPS port 443)
 */
async function sendViaGoogleRelay(options: {
  webhookUrl: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch(options.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
      redirect: 'follow',
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { text };
    }

    if (!res.ok && res.status !== 302) {
      return { success: false, error: data?.error || `Google Relay error HTTP ${res.status}` };
    }
    return { success: true, messageId: `gas_${Date.now()}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Create Nodemailer Transporter with tight 4s timeout (so Render HTTP gateway never 503s)
 */
function createTransporter(options?: { forcePort?: number; forceSecure?: boolean }) {
  const host = env.SMTP_HOST || 'smtp.gmail.com';
  const defaultPort = env.SMTP_PORT || 587;
  const port = options?.forcePort ?? defaultPort;
  const secure = options?.forceSecure ?? (port === 465);
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 4000, // 4 seconds max so Render never times out with 503!
    greetingTimeout: 4000,
    socketTimeout: 6000,
  });
}

/**
 * Unified Email Dispatcher with HTTPS API fallback
 */
async function dispatchEmail(payload: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{
  success: boolean;
  messageId?: string;
  provider: 'resend' | 'brevo' | 'gmail_relay' | 'smtp';
  error?: string;
}> {
  // 1. Try Resend API (HTTPS Port 443 — 100% immune to Render port blocking)
  if (env.RESEND_API_KEY) {
    console.log('[OrderEmailService] 🚀 Dispatching email via Resend HTTPS API...');
    const result = await sendViaResend({
      apiKey: env.RESEND_API_KEY,
      from: env.RESEND_FROM_EMAIL,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    if (result.success) {
      return { success: true, messageId: result.messageId, provider: 'resend' };
    }
    console.warn(`[OrderEmailService] Resend API failed (${result.error}), trying next provider...`);
  }

  // 2. Try Brevo API (HTTPS Port 443 — 300 free emails/day)
  if (env.BREVO_API_KEY) {
    console.log('[OrderEmailService] 🚀 Dispatching email via Brevo HTTPS API...');
    const result = await sendViaBrevo({
      apiKey: env.BREVO_API_KEY,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    if (result.success) {
      return { success: true, messageId: result.messageId, provider: 'brevo' };
    }
    console.warn(`[OrderEmailService] Brevo API failed (${result.error}), trying next provider...`);
  }

  // 3. Try Google Apps Script Relay (HTTPS Port 443 — sends from freshvegitables29@gmail.com directly)
  if (env.GMAIL_RELAY_URL) {
    console.log('[OrderEmailService] 🚀 Dispatching email via Google Apps Script Relay...');
    const result = await sendViaGoogleRelay({
      webhookUrl: env.GMAIL_RELAY_URL,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    if (result.success) {
      return { success: true, messageId: result.messageId, provider: 'gmail_relay' };
    }
    console.warn(`[OrderEmailService] Google Relay failed (${result.error}), trying next provider...`);
  }

  // 4. Try Direct SMTP (Fast 4s timeout)
  const transporter = createTransporter();
  if (!transporter) {
    return {
      success: false,
      provider: 'smtp',
      error: 'No email provider configured. On Render Free Tier, SMTP ports are blocked. Set RESEND_API_KEY, BREVO_API_KEY, or GMAIL_RELAY_URL to send over HTTPS.',
    };
  }

  try {
    const sendResult = await transporter.sendMail({
      from: `"Fresh Vegetables Orders" <${env.SMTP_USER || payload.to}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return { success: true, messageId: sendResult.messageId, provider: 'smtp' };
  } catch (smtpErr: any) {
    const isTimeout = smtpErr?.code === 'ETIMEDOUT' || smtpErr?.message?.includes('timeout');
    const msg = isTimeout
      ? 'Render Free Tier blocks outbound SMTP (ports 465/587). Please add RESEND_API_KEY, BREVO_API_KEY, or GMAIL_RELAY_URL in Render environment variables for HTTPS delivery.'
      : smtpErr.message;
    return { success: false, provider: 'smtp', error: msg };
  }
}

/**
 * Automatically send order notification email to store admin.
 * Idempotent: Skips sending if already successfully recorded in order_notifications.
 */
export async function sendNewOrderAdminEmail(orderId: string, forceRetry = false): Promise<{
  success: boolean;
  message: string;
  skipped?: boolean;
}> {
  const notificationType = 'admin_email';
  const recipient = env.ORDER_NOTIFICATION_EMAIL || 'freshvegitables29@gmail.com';

  try {
    // 1. Fetch complete order details from database
    const orderRes = await db.query(
      `SELECT o.*, u.name as customer_name, u.email as customer_email, u.mobile as customer_phone
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      console.warn(`[OrderEmailService] Order ${orderId} not found in database. Skipping email.`);
      return { success: false, message: 'Order not found' };
    }

    const order = orderRes.rows[0];

    // 2. Fetch order items
    const itemsRes = await db.query(
      `SELECT oi.*, p.images
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1
       ORDER BY oi.created_at ASC`,
      [orderId]
    );
    const items = itemsRes.rows;

    // 3. Fetch latest payment record if any
    const paymentRes = await db.query(
      `SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [orderId]
    );
    const payment = paymentRes.rows[0] || null;

    // 4. Idempotency Check via order_notifications table
    if (!forceRetry) {
      const existingNotifRes = await db.query(
        `SELECT id, status, sent_at FROM order_notifications
         WHERE order_id = $1 AND notification_type = $2`,
        [orderId, notificationType]
      );

      if (existingNotifRes.rows.length > 0) {
        const notif = existingNotifRes.rows[0];
        if (notif.status === 'sent') {
          console.log(`[OrderEmailService] Notification for order #${order.order_number} already sent at ${notif.sent_at}. Skipping duplicate.`);
          return { success: true, message: 'Already sent', skipped: true };
        }
      }
    }

    // Record / upsert pending status in outbox
    await db.query(
      `INSERT INTO order_notifications (order_id, notification_type, recipient, status, attempts, updated_at)
       VALUES ($1, $2, $3, 'pending', 1, NOW())
       ON CONFLICT (order_id, notification_type)
       DO UPDATE SET attempts = order_notifications.attempts + 1, updated_at = NOW()`,
      [orderId, notificationType, recipient]
    );

    // 5. Check if any email provider is configured
    const hasHttpProvider = Boolean(env.RESEND_API_KEY || env.BREVO_API_KEY || env.GMAIL_RELAY_URL);
    const hasSmtp = Boolean(env.SMTP_USER && env.SMTP_PASS);

    if (!hasHttpProvider && !hasSmtp) {
      const warningMsg = `No email provider configured. On Render Free Tier, SMTP ports are blocked. Please set RESEND_API_KEY, BREVO_API_KEY, or GMAIL_RELAY_URL in Render environment variables.`;
      console.warn(`[OrderEmailService] ⚠️ ${warningMsg}`);

      await db.query(
        `UPDATE order_notifications
         SET status = 'failed', error_message = $1, updated_at = NOW()
         WHERE order_id = $2 AND notification_type = $3`,
        [warningMsg, orderId, notificationType]
      );

      await db.query(
        `UPDATE orders
         SET admin_email_error = $1
         WHERE id = $2`,
        [warningMsg, orderId]
      );

      return { success: false, message: warningMsg };
    }

    // 6. Build Email Data
    const orderNumber = order.order_number || order.id.slice(0, 8).toUpperCase();
    const formattedDate = formatOrderDateTime(order.created_at);
    let addressSnapshot = order.address_snapshot;
    if (typeof addressSnapshot === 'string') {
      try { addressSnapshot = JSON.parse(addressSnapshot); } catch {}
    }

    const customerName = addressSnapshot?.full_name || order.customer_name || 'Valued Customer';
    const customerPhone = addressSnapshot?.phone || order.customer_phone || 'Not provided';
    const customerEmail = order.customer_email || 'Not provided';
    const formattedAddress = formatDeliveryAddress(addressSnapshot);
    const { url: mapsUrl, isGps } = computeGoogleMapsUrl(addressSnapshot);

    const subtotal = Number(order.subtotal || 0).toFixed(2);
    const deliveryCharge = Number(order.delivery_charge || 0).toFixed(2);
    const discount = Number(order.discount || 0).toFixed(2);
    const tax = Number(order.tax || 0).toFixed(2);
    const total = Number(order.total || 0).toFixed(2);

    const paymentMethodUpper = (order.payment_method || 'cod').toUpperCase();
    const paymentStatusUpper = (order.payment_status || 'pending').toUpperCase();
    const orderStatusUpper = (order.order_status || 'pending').toUpperCase();
    const transactionRef = payment?.gateway_payment_id || payment?.transaction_id || payment?.gateway_order_id || 'N/A';

    const frontendBaseUrl = (env.FRONTEND_URL || 'https://fresh-vegitables-frontend.vercel.app').replace(/\/$/, '');
    const adminOrderUrl = `${frontendBaseUrl}/admin/orders/${order.id}`;

    // 7. Compose Email Content
    const subject = `🛒 New Vegetable Order Received — Order #${orderNumber}`;

    // Build Product Table HTML
    const itemsTableHtml = items
      .map((item, idx) => {
        const name = escapeHtml(item.product_name_snapshot || 'Organic Produce');
        const unit = escapeHtml(item.unit_snapshot || '1 unit');
        const qty = item.quantity || 1;
        const price = Number(item.price_snapshot || 0).toFixed(2);
        const lineTotal = Number(item.total || Number(price) * qty).toFixed(2);

        const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        return `
          <tr style="background-color: ${bgColor};">
            <td style="padding: 10px 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
              ${name}
            </td>
            <td style="padding: 10px 14px; color: #475569; border-bottom: 1px solid #e2e8f0; font-size: 12px;">
              ${unit}
            </td>
            <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
              ${qty}
            </td>
            <td style="padding: 10px 14px; text-align: right; color: #334155; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
              ₹${price}
            </td>
            <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #0c831f; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
              ₹${lineTotal}
            </td>
          </tr>
        `;
      })
      .join('');

    // Responsive HTML Template
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Order #${escapeHtml(orderNumber)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;" cellspacing="0" cellpadding="0">
          
          <!-- Brand Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0c831f 0%, #0f9426 100%); padding: 24px 28px; text-align: left;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(255,255,255,0.22); color: #ffffff; padding: 4px 10px; border-radius: 20px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">
                      ⚡ Instant New Order Alert
                    </span>
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: -0.02em;">
                      Fresh Vegetables Organic
                    </h1>
                    <p style="margin: 4px 0 0; color: #e2fbe8; font-size: 13px; font-weight: 500;">
                      Order #${escapeHtml(orderNumber)} received on ${escapeHtml(formattedDate)}
                    </p>
                  </td>
                  <td align="right" valign="middle" style="font-size: 38px;">
                    🥬
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Key Metrics Highlight Strip -->
          <tr>
            <td style="background-color: #f8fafc; padding: 14px 28px; border-bottom: 1px solid #e2e8f0;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size: 12px; color: #64748b; font-weight: 600;">
                    Payment: <strong style="color: #0f172a;">${escapeHtml(paymentMethodUpper)}</strong>
                    <span style="display: inline-block; margin-left: 6px; padding: 2px 7px; border-radius: 6px; font-size: 10px; font-weight: 800; background-color: ${paymentStatusUpper === 'PAID' ? '#dcfce7' : '#fef3c7'}; color: ${paymentStatusUpper === 'PAID' ? '#166534' : '#92400e'};">
                      ${escapeHtml(paymentStatusUpper)}
                    </span>
                  </td>
                  <td align="right" style="font-size: 12px; color: #64748b; font-weight: 600;">
                    Status: 
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; background-color: #dbeafe; color: #1e40af;">
                      ${escapeHtml(orderStatusUpper)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 24px 28px;">

              <!-- Section A: Customer Details -->
              <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <h3 style="margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #0c831f; font-weight: 900;">
                      👤 Customer Information
                    </h3>
                    <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px; line-height: 1.6;">
                      <tr>
                        <td width="35%" style="color: #64748b; font-weight: 600;">Full Name:</td>
                        <td style="color: #0f172a; font-weight: 700;">${escapeHtml(customerName)}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600;">Phone Number:</td>
                        <td>
                          <a href="tel:${escapeHtml(customerPhone.replace(/[\s-]/g, ''))}" style="color: #0c831f; font-weight: 700; text-decoration: none;">
                            📞 ${escapeHtml(customerPhone)}
                          </a>
                        </td>
                      </tr>
                      ${customerEmail !== 'Not provided' ? `
                      <tr>
                        <td style="color: #64748b; font-weight: 600;">Email:</td>
                        <td style="color: #0f172a;">${escapeHtml(customerEmail)}</td>
                      </tr>` : ''}
                      ${order.notes ? `
                      <tr>
                        <td style="color: #64748b; font-weight: 600; vertical-align: top;">Instructions:</td>
                        <td style="color: #b45309; font-weight: 600; background-color: #fef3c7; padding: 4px 8px; border-radius: 6px; font-size: 12px;">
                          ${escapeHtml(order.notes)}
                        </td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Section B: Delivery Location & Google Maps -->
              <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <h3 style="margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #0c831f; font-weight: 900;">
                      📍 Delivery Address & Navigation
                    </h3>
                    <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: #1e293b; font-weight: 600;">
                      ${escapeHtml(formattedAddress)}
                    </p>

                    ${mapsUrl ? `
                    <div style="margin-top: 10px;">
                      <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #0c831f; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.02em; box-shadow: 0 2px 6px rgba(12,131,31,0.25);">
                        🗺️ Open Customer Location in Google Maps (${isGps ? 'Exact GPS' : 'Address Search'}) &rarr;
                      </a>
                    </div>
                    ` : `
                    <p style="margin: 0; font-size: 12px; color: #94a3b8; font-style: italic;">
                      Delivery location coordinates not provided.
                    </p>
                    `}
                  </td>
                </tr>
              </table>

              <!-- Section C: Ordered Produce Line Items -->
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #0c831f; font-weight: 900;">
                  🛒 Ordered Fresh Vegetables (${items.length} items)
                </h3>
                
                <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; width: 100%; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #0f172a; color: #ffffff; text-align: left;">
                      <th style="padding: 10px 14px; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em;">Product</th>
                      <th style="padding: 10px 14px; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em;">Unit</th>
                      <th style="padding: 10px 14px; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; text-align: center;">Qty</th>
                      <th style="padding: 10px 14px; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; text-align: right;">Price</th>
                      <th style="padding: 10px 14px; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; text-align: right;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsTableHtml}
                  </tbody>
                </table>
              </div>

              <!-- Section D: Order Financial Summary -->
              <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td width="50%" style="vertical-align: top; font-size: 11.5px; color: #64748b; line-height: 1.6; padding-right: 12px;">
                    <div>Transaction Ref: <strong>${escapeHtml(transactionRef)}</strong></div>
                    <div>Order ID: <code style="font-size: 10.5px; background: #e2e8f0; padding: 1px 4px; border-radius: 4px;">${escapeHtml(order.id)}</code></div>
                  </td>
                  <td width="50%" align="right">
                    <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 12.5px; line-height: 1.8;">
                      <tr>
                        <td style="color: #64748b; text-align: right; padding-right: 14px;">Subtotal:</td>
                        <td style="color: #0f172a; font-weight: 700; text-align: right; width: 80px;">₹${subtotal}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; text-align: right; padding-right: 14px;">Delivery Fee:</td>
                        <td style="color: #0f172a; font-weight: 700; text-align: right;">₹${deliveryCharge}</td>
                      </tr>
                      ${Number(discount) > 0 ? `
                      <tr>
                        <td style="color: #16a34a; text-align: right; padding-right: 14px;">Discount:</td>
                        <td style="color: #16a34a; font-weight: 700; text-align: right;">-₹${discount}</td>
                      </tr>` : ''}
                      <tr style="border-top: 2px solid #0f172a;">
                        <td style="color: #0f172a; font-size: 15px; font-weight: 900; text-align: right; padding: 8px 14px 0 0;">Grand Total:</td>
                        <td style="color: #0c831f; font-size: 17px; font-weight: 900; text-align: right; padding-top: 8px;">₹${total}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Section E: Direct Admin Portal Link -->
              <table width="100%" cellspacing="0" cellpadding="0" style="border-top: 1px dashed #cbd5e1; padding-top: 24px; text-align: center;">
                <tr>
                  <td align="center">
                    <a href="${adminOrderUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 14px; font-weight: 800; letter-spacing: 0.02em; box-shadow: 0 4px 12px rgba(15,23,42,0.25);">
                      📦 Open Order in Admin Dashboard &rarr;
                    </a>
                    <p style="margin: 10px 0 0; font-size: 11px; color: #64748b;">
                      Admin authentication required. Do not share this URL with non-staff members.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; color: #94a3b8; padding: 20px 28px; text-align: center; font-size: 11.5px; border-top: 1px solid #1e293b;">
              <p style="margin: 0 0 4px; font-weight: 700; color: #f8fafc;">
                Fresh Vegetables Organic — Farm to Kitchen Dispatch Service
              </p>
              <p style="margin: 0; color: #64748b;">
                Sent automatically by the Fresh Vegetables Store Engine to ${escapeHtml(recipient)}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Plain Text Fallback
    const plainTextContent = `
NEW VEGETABLE ORDER RECEIVED — ORDER #${orderNumber}
====================================================
Date: ${formattedDate}
Order ID: ${order.id}
Status: ${orderStatusUpper}
Payment Method: ${paymentMethodUpper} (${paymentStatusUpper})

CUSTOMER INFORMATION:
- Name: ${customerName}
- Phone: ${customerPhone}
- Email: ${customerEmail}
- Delivery Notes: ${order.notes || 'None'}

DELIVERY ADDRESS:
${formattedAddress}
${mapsUrl ? `Google Maps Link: ${mapsUrl}` : 'No Google Maps link available.'}

ORDERED PRODUCTS:
${items.map((i) => `- ${i.product_name_snapshot} (${i.unit_snapshot}) x ${i.quantity} = ₹${Number(i.total || 0).toFixed(2)}`).join('\n')}

ORDER TOTALS:
- Subtotal: ₹${subtotal}
- Delivery Fee: ₹${deliveryCharge}
- Discount: -₹${discount}
- Grand Total: ₹${total}
- Payment Reference: ${transactionRef}

ADMIN DASHBOARD LINK:
${adminOrderUrl}
(Requires admin login credentials)
====================================================
Fresh Vegetables Organic Delivery Service
    `.trim();

    // 8. Send Email via Unified Multi-Engine Dispatcher (HTTPS first, then SMTP fallback)
    const dispatchResult = await dispatchEmail({
      to: recipient,
      subject,
      text: plainTextContent,
      html: htmlContent,
    });

    if (!dispatchResult.success) {
      throw new Error(dispatchResult.error || 'Failed to dispatch email');
    }

    console.log(`[OrderEmailService] ✅ Order notification email sent to ${recipient} via ${dispatchResult.provider} for Order #${orderNumber} (MessageId: ${dispatchResult.messageId})`);

    // 9. Update notification outbox and order records
    await db.query(
      `UPDATE order_notifications
       SET status = 'sent', sent_at = NOW(), error_message = NULL, updated_at = NOW()
       WHERE order_id = $1 AND notification_type = $2`,
      [orderId, notificationType]
    );

    await db.query(
      `UPDATE orders
       SET admin_email_sent = TRUE, admin_email_sent_at = NOW(), admin_email_error = NULL
       WHERE id = $1`,
      [orderId]
    );

    return { success: true, message: 'Email sent successfully' };
  } catch (error: any) {
    const errorMsg = error?.message || 'Unknown email delivery failure';
    console.error(`[OrderEmailService] ❌ Failed to send order notification email for ${orderId}:`, errorMsg);

    try {
      await db.query(
        `UPDATE order_notifications
         SET status = 'failed', error_message = $1, updated_at = NOW()
         WHERE order_id = $2 AND notification_type = $3`,
        [errorMsg, orderId, notificationType]
      );

      await db.query(
        `UPDATE orders
         SET admin_email_error = $1
         WHERE id = $2`,
        [errorMsg, orderId]
      );
    } catch (dbErr: any) {
      console.warn(`[OrderEmailService] Note: Failed to update order_notifications outbox:`, dbErr.message);
    }

    return { success: false, message: errorMsg };
  }
}

/**
 * Diagnostic test function for Admin to verify email configuration & delivery
 */
export async function testOrderEmailConnection(): Promise<{
  success: boolean;
  message: string;
  config: {
    activeProvider: string;
    hasResend: boolean;
    hasBrevo: boolean;
    hasGoogleRelay: boolean;
    hasSmtp: boolean;
    recipient: string;
  };
  details?: any;
}> {
  const recipient = env.ORDER_NOTIFICATION_EMAIL || 'freshvegitables29@gmail.com';
  const hasResend = Boolean(env.RESEND_API_KEY);
  const hasBrevo = Boolean(env.BREVO_API_KEY);
  const hasGoogleRelay = Boolean(env.GMAIL_RELAY_URL);
  const hasSmtp = Boolean(env.SMTP_USER && env.SMTP_PASS);

  const activeProvider = hasResend
    ? 'Resend API (HTTPS Port 443)'
    : hasBrevo
    ? 'Brevo API (HTTPS Port 443)'
    : hasGoogleRelay
    ? 'Google Apps Script Relay (HTTPS Port 443)'
    : hasSmtp
    ? `SMTP (${env.SMTP_HOST}:${env.SMTP_PORT})`
    : 'None configured';

  const config = {
    activeProvider,
    hasResend,
    hasBrevo,
    hasGoogleRelay,
    hasSmtp,
    recipient,
  };

  if (!hasResend && !hasBrevo && !hasGoogleRelay && !hasSmtp) {
    return {
      success: false,
      message:
        'No email provider configured. On Render Free Tier, SMTP ports (465/587) are blocked. Please configure RESEND_API_KEY, BREVO_API_KEY, or GMAIL_RELAY_URL in your Render Environment Variables.',
      config,
    };
  }

  const dispatchResult = await dispatchEmail({
    to: recipient,
    subject: `🔔 [DIAGNOSTIC TEST] Fresh Vegetables Order Email System Online!`,
    text: `Hello! This is a test email sent from Fresh Vegetables Organic using ${activeProvider}. Time: ${new Date().toISOString()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 2px solid #16a34a; border-radius: 12px; background: #f0fdf4;">
        <h2 style="color: #166534; margin: 0 0 12px;">✅ Order Notification System Online!</h2>
        <p style="color: #15803d; font-size: 14px; margin: 0 0 16px;">This diagnostic email confirms that your store email delivery pipeline is 100% operational.</p>
        <div style="background: #ffffff; border-radius: 8px; padding: 14px; border: 1px solid #bbf7d0;">
          <p style="margin: 4px 0; font-size: 13px;"><strong>Delivery Provider:</strong> ${activeProvider}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Notification Recipient:</strong> ${escapeHtml(recipient)}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Dispatched At:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
        </div>
      </div>
    `,
  });

  if (!dispatchResult.success) {
    return {
      success: false,
      message: dispatchResult.error || 'Failed to dispatch test email',
      config,
    };
  }

  return {
    success: true,
    message: `Test email successfully delivered to ${recipient} via ${dispatchResult.provider}!`,
    config,
    details: { messageId: dispatchResult.messageId },
  };
}


