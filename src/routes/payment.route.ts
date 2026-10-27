import { Router } from 'express';
import { initializePayment, handlePaystackWebhook } from '../controllers/payment.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// Student payment setup
router.post('/initialize', authenticateToken, initializePayment);

// Webhook endpoint called by Paystack servers directly
router.post('/webhook', handlePaystackWebhook);

export default router;