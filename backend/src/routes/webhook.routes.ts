import { Router } from 'express';
import {
  handleWhatsAppVerification,
  handleWhatsAppWebhook,
} from '../controllers/webhook.controller';

const router = Router();

// GET /api/webhooks/whatsapp - Meta subscription verification handshake
router.get('/whatsapp', handleWhatsAppVerification);

// POST /api/webhooks/whatsapp - Meta webhook event notifications (messages & delivery statuses)
router.post('/whatsapp', handleWhatsAppWebhook);

export default router;
