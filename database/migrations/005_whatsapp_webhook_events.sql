-- ============================================================
-- 005: WhatsApp Cloud API Webhook Events & Idempotency Store
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(150) NOT NULL UNIQUE, -- WAMID or event identifier for deduplication
  event_type VARCHAR(50) NOT NULL, -- 'message', 'status'
  status VARCHAR(50), -- 'sent', 'delivered', 'read', 'failed' (for status updates)
  message_type VARCHAR(50), -- 'text', 'interactive', 'button', etc. (for messages)
  phone_masked VARCHAR(50), -- masked phone (e.g. +91 ******0384)
  payload_metadata JSONB, -- non-sensitive metadata only (timestamps, error codes, IDs)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_events_event_id ON whatsapp_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_events_type_status ON whatsapp_webhook_events(event_type, status);
